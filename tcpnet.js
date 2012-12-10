
var net = require('net');
var util = require('util');
var mdns = require('mdns');
var isme = require('isme');
var events = require('events');
var async = require('async');
var os = require('os');

var serviceHost = os.hostname() + '-' + process.pid + '-';
var serviceCounter = 0;

function Service(options) {
  if (!(this instanceof Service)) return new Service(options);

  var self = this;

  // Collection of online sockets
  this._services = [];
  this.connections = [];

  // UUID: we need a string to send and a number to compare
  this._uuidNumber = parseInt(options.uuid, 16);
  this._uuidString = options.uuid;

  // Keeps a key and port
  this._serviceKey = mdns.tcp(options.name);
  this._serviceName = serviceHost + (serviceCounter++);
  this._servicePort = null;
  this._serviceAddresses = null;

  // New discovered services are stored in buffer until
  // service worker is ready
  this._serviceBuffer = [];

  // Keeps main objects, unfortunately the announce object
  // can't be created before the service server is online
  this._server = net.createServer();
  this._discover = mdns.createBrowser(this._serviceKey);
  this._announce = null;

  // Start service server
  this._server.listen(options.port, options.host);

  // Server is online
  this._server.once('listening', function () {
    self._servicePort = self._server.address().port;

    // Start announceing and discovering
    self._announce = mdns.createAdvertisement(
      self._serviceKey,
      self._servicePort,
      {
        txtRecord: { uuid: self._uuidString },

        // workaround for some wird bug
        // ref: https://github.com/agnat/node_mdns/issues/51
        name: self._serviceName
      }
    );

    self._announce.start();
    self._discover.start();

    // Listening event will be emited once an
    // self announcement has been made, see
    // serviceUp handler below
  });

  // Got connection start handshake
  this._server.on('connection', function (socket) {

    // The first data chunk should be a JSON string, containing information
    // about the remote service.
    socket.once('data', function (chunk) {
      var remote = JSON.parse(chunk.toString());

      // Done, not ready to claim this a connection
      self._addSocket(socket, remote);
    });
  });

  // Used when this service is online but an announcement was made
  function offline(service) {

    // Use self announcement to catch broadcasted public ip
    if (self._selfAnnouncement(service)) {
      self._serviceAddresses = service.addresses;

      // Switch to online mode
      self._discover.removeListener('serviceUp', offline);
      self._discover.on('serviceUp', online);

      // Emit listening
      self.emit('listening');

      // Connect to buffered services
      self._serviceBuffer.forEach(self._addService.bind(self));
      self._serviceBuffer = [];

      return;
    }

    // When offline, then store service in buffer
    self._serviceBuffer.push(service);
  }
  this._discover.on('serviceUp', offline);

  // Used when this service is online
  function online(service) {

    // Skip self announcement
    if (self._selfAnnouncement(service)) return;

    self._addService(service);
  }
}
util.inherits(Service, events.EventEmitter);
module.exports = Service;

Service.prototype._addService = function (service) {
  var self = this;

  // Get IPv4 addresses
  // TODO: look intro IPv6 support
  var addresses = service.addresses.filter(net.isIPv4.bind(net));

  // Create remote connection object
  var remote = {
    port: service.port,
    addresses: service.addresses
  };

  // Prevent double connection
  this._services.push(remote);

  // The service worker with the highest number gets the pleasure of
  // initiating the TPC connection.
  if (this._uuidNumber <= parseInt(service.txtRecord.uuid, 16)) return;

  // Don't allow multiply connection to same service worker
  if (this._existConnection(remote)) return;

  // Connect to remote and start handshake
  var socket = net.connect({ port: service.port, host: addresses[0] });
  socket.once('connect', function () {

    // Inform remote about the service it just connected to
    socket.write(JSON.stringify({
      port: self._servicePort,
      addresses: self._serviceAddresses
    }), function () {

      // Done, not ready to claim this a connection
      self._addSocket(socket, remote);
    });
  });
};

// Remove remote object from services list
Service.prototype._removeService = function (remote) {
    var index = this._services.indexOf(remote);
    if (index === -1) return;

    this._services.splice(index, 1);
};

Service.prototype._addSocket = function (socket, remote) {
  var self = this;

  // Add remote info to socket object
  socket.remote = remote;

  // Add socket to connections list now
  this.connections.push(socket);

  // Remove socket from connection list once closed
  socket.once('close', function () {
    self._removeService(remote);
    self._removeSocket(socket);
  });

  // Done, emit connection event
  this.emit('connection', socket);
};

// Remove socket from connections list
Service.prototype._removeSocket = function (socket) {
    var index = this.connections.indexOf(socket);
    if (index === -1) return;

    this.connections.splice(index, 1);
};

Service.prototype._selfAnnouncement = function (service) {
  return (service.addresses.some(isme) && service.port == this._servicePort);
};

Service.prototype._existConnection = function (remote) {
  var connections = this.connections;
  var i = connections.length;

  // If the remote object was found in connections list, then it exist
  while (i--) {
    var serviceInfo = this._services[i];

    if (matchArray(serviceInfo.addresses, remote.addresses) &&
        serviceInfo.port == remote.port) {
      return true;
    }
  }

  // No matching remote object was found
  return false;
};

function matchArray(arr1, arr2) {
  if (arr1.length !== arr2.length) return false;

  var i = arr1.length;
  while (i--) {
    if (arr1[i] !== arr2[i]) return false;
  }
}

Service.prototype.address = function () {
  return this._server.address();
};

Service.prototype.close = function (callback) {
  var self = this;

  // Callback is just a close event handler
  if (callback) this.once('close', callback),

  // Stop announceing and discovering
  this._announce.stop();
  this._discover.stop();

  async.parallel([

    // Close all sockets
    function (done) {
      async.forEach(self.connections.slice(0), function(socket, eachDone) {
        socket.end();
        socket.once('close', function () { eachDone(null); });
      }, done);
    },

    // Close connection server
    function (done) {
      self._server.close(done);
    }
  ], function () {
    self.emit('close');
  });
};
