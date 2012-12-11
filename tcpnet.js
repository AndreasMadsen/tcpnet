
var net = require('net');
var util = require('util');
var events = require('events');
var async = require('async');

var mdns = require('mdns');
var isme = require('isme');
var gmid = require('gmid');

var IS_HEX_STRING = /^[0123456789ABCDEF]+$/;

function compareHex(hexA, hexB) {
  for (var i = 0, l = hexA.length; i < l; i++) {
    // if hex digits are the same nothing can be concluded
    if (hexA[i] === hexB[i]) continue;

    // At this point the hex digits arn't the same, compare the size
    // and return true if hexA was greater than hexB
    return (parseInt(hexA[i], 16) > parseInt(hexB[i], 16));
  }

  // If they where totally equal, something went wrong and
  // it should be ignored, thats a `return true`.
  return true;
}

function isObject(value) {
  return (typeof value === 'object' && value !== null);
}

function Service(settings, connectionHandler) {
  if (!(this instanceof Service)) {
    return new Service(settings, connectionHandler);
  }

  // Check that settings is of correct type
  if (typeof settings !== 'string' && !isObject(settings)) {
    throw new TypeError('first argument must be a string or an object');
  }

  // Create settings object
  if (typeof settings === 'string') {
    settings = {
      name: settings
    };
  }
  if (settings.hasOwnProperty('uuid') === false) {
    settings.uuid = gmid();
  }

  // Check that the service name property is of correct type
  if (typeof settings.name !== 'string') {
    throw new TypeError('service name must be a string type');
  }

  // Check that the service uuid property is of correct type
  if (typeof settings.uuid !== 'string') {
    throw new TypeError('service uuid must be a string type');
  }
  settings.uuid = settings.uuid.toUpperCase();

  // Check that service uuid is a hex string
  if (IS_HEX_STRING.test(settings.uuid) === false) {
    throw new TypeError('service uuid must be a hex string');
  }

  // Collection of online sockets
  this.connections = [];

  // Add connection handler if given
  if (connectionHandler) this.on('connection', connectionHandler);

  // Contains unique ID and a service key (given by service name)
  this._uuid = settings.uuid;
  this._key = mdns.tcp(settings.name);

  // Collection of services
  this._services = [];
  this._serviceBuffer = [];

  // Keeps addresses and port
  this._address = {
    addresses: null,
    port: null
  };

  // Keeps main objects, unfortunately the announce object
  // can't be created before the service server is online
  this._server = net.createServer();
  this._discover = mdns.createBrowser(this._key);
  this._announce = null;
}
util.inherits(Service, events.EventEmitter);
module.exports = Service;

Service.prototype.listen = function () {
  var self = this;
  var args = Array.prototype.slice.call(arguments);

  var callback, port, address;

  // Extract callback
  if (typeof args[args.length - 1] === 'function') {
    callback = args.pop();
  }

  // Extract port
  port = args.pop() || 0;

  // Extract address
  address = args.pop() || "0.0.0.0";

  // Start service server
  this._server.listen(port, address);

  // Server is online
  this._server.once('listening', function () {
    port = self._address.port = self._server.address().port;

    // Start announceing and discovering
    self._announce = mdns.createAdvertisement(
      self._key, port, {
        // workaround for some wird bug
        // ref: https://github.com/agnat/node_mdns/issues/51
        name: self._uuid
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
      self._address.addresses = service.addresses;

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
};

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
  if (compareHex(this._uuid, service.name)) return;

  // Don't allow multiply connection to same service worker
  if (this._existConnection(remote)) return;

  // Connect to remote and start handshake
  var socket = net.connect({ port: service.port, host: addresses[0] });
  socket.once('connect', function () {

    // Inform remote about the service it just connected to
    socket.write(JSON.stringify(self._address), function () {

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
  return (service.addresses.some(isme) &&
          service.port == this._address.port &&
          service.name === this._uuid);
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
  // addresses is the last property there will be set
  if (this._address.addresses === null) {
    return null;
  }

  return this._address;
};

Service.prototype.close = function (callback) {
  var self = this;

  // reset address info
  this._address = {
    port: null,
    addresses: null
  };

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

    // Close connection server, note the server.close callback
    // won't be executed before all connected sockets are closed.
    function (done) {
      self._server.close(done);
    }
  ], function () {
    self.emit('close');
  });
};
