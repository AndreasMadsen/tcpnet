
var os = require('os');
var net = require('net');
var dns = require('dns');
var util = require('util');
var mdns = require('mdns');
var isme = require('isme');
var gmid = require('gmid');
var async = require('async');
var events = require('events');

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

  var self = this;

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

  // helps handling fast close
  this._closed = false;

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

  // do the service listen on localhost
  this._internalAllowed = false;

  this._relayError = function (err) {
    self.emit('error', err);
  };

  // Keeps main objects, unfortunately the announce object
  // can't be created before the service server is online
  this._server = net.createServer();
  this._server.on('error', this._relayError);

  this._discover = null;
  this._announce = null;
}
util.inherits(Service, events.EventEmitter);
module.exports = Service;

Service.prototype.listen = function () {
  var self = this;
  var args = Array.prototype.slice.call(arguments);

  var port, address;

  // Extract callback
  if (typeof args[args.length - 1] === 'function') {
    this.once('listening', args.pop());
  }

  // Extract address
  if (args.length === 2) {
    address = args.pop() || "0.0.0.0";
  } else {
    address = "0.0.0.0";
  }
  if (typeof address !== 'string') {
    throw new TypeError('address must be a string');
  }

  // Extract port
  port = args.pop() || 0;
  if (typeof port !== 'number') {
    throw new TypeError('port must be a number');
  }

  // Transform hostname/address to an IP address
  dns.lookup(address, function (err, address) {
    if (self._closed) return;
    if (err) return self.emit('error', err);

    // Start service server
    self._server.listen(port, address);

    // Server is online
    self._server.once('listening', function () {
      if (self._closed) return;

      self._address.port = self._server.address().port;

      // Start announceing and discovering
      self._startService(address);
      self._discover.on('serviceUp', offline);
    });

    // Got connection start handshake
    self._server.on('connection', function (socket) {
      // Relay errors to the service object, when initializing is done the
      // error handler is removed.
      socket.on('error', self._relayError);

      self._addSocket(socket);
    });
  });

  // Used when this service is online but an announcement was made
  function offline(service) {

    // Use self announcement to catch broadcasted public ip
    if (self._selfAnnouncement(service)) {
      self._address.addresses = self._getAddresses(service);

      // Switch to online mode
      self._discover.removeListener('serviceUp', offline);
      self._discover.on('serviceUp', online);

      // Emit listening
      self.emit('listening');

      // Connect to buffered services
      self._serviceBuffer.forEach(self._createConnection.bind(self));
      self._serviceBuffer = [];

      return;
    }

    // When offline, then store service in buffer
    self._serviceBuffer.push(service);
  }

  // Used when this service is online
  function online(service) {
    // Skip self announcement
    if (self._selfAnnouncement(service)) return;

    self._createConnection(service);
  }
};

Service.prototype._createConnection = function (service) {
  var self = this;

  // Create remote connection object
  var remote = service.name;

  // The service worker with the highest number gets the pleasure of
  // initiating the TPC connection.
  if (compareHex(this._uuid, remote)) return;

  // Don't allow multiply connection to same service worker
  if (this._services.indexOf(remote) !== -1) return;
  this._services.push(remote);

  // Connect to remote and start handshake
  var addresses = this._getAddresses(service);
  var socket = net.connect({ port: service.port, host: addresses[0] });

  // Relay errors to the service object, when initializing is done the
  // error handler is removed.
  socket.on('error', this._relayError);

  // remove the uuid safe guard once the socket is closed
  socket.once('close', function () {
    var index = self._services.indexOf(remote);
    if (index === -1) return;
    self._services.splice(index, 1);
  });

  socket.once('connect', function () {
    self._addSocket(socket);
  });
};

Service.prototype._addSocket = function (socket) {
  var self = this;

  // Add socket to connections list now
  this.connections.push(socket);

  // Remove socket from connection list once closed
  socket.once('close', function () {
    self._removeSocket(socket);
  });

  // Remove initializing error handler, its up to the user to
  // handle errors now.
  socket.removeListener('error', self._relayError);

  // Done, emit connection event
  this.emit('connection', socket);
};

// Remove socket from connections list
Service.prototype._removeSocket = function (socket) {
    var index = this.connections.indexOf(socket);
    if (index === -1) return;

    this.connections.splice(index, 1);
};

// returns an object containing sorted internal IPv4 and IPv6 addresses
function getInternalAddresses() {
  var result = {
    IPv4: [],
    IPv6: []
  };

  var interfaces = os.networkInterfaces();
  for (var name in interfaces) {
    if (interfaces.hasOwnProperty(name) === false) continue;

    var addresses = interfaces[name];
    for (var i = 0; i < addresses.length; i++) {
      if (addresses[i].internal === false) continue;

      result[ addresses[i].family ].push(addresses[i].address);
    }
  }

  return result;
}

Service.prototype._getAddresses = function (service) {
  var addresses = {
    IPv4: service.addresses.filter(net.isIPv4.bind(net)),
    IPv6: service.addresses.filter(net.isIPv6.bind(net))
  };

  // Add localhost addresses as a connection optimization and
  // a necessity when listening only on localhost
  if (this._internalAllowed &&
     (service.addresses.length === 0 || service.addresses.some(isme))) {

    var internals = getInternalAddresses();
    addresses.IPv4 = [].concat(addresses.IPv4, internals.IPv4);
    addresses.IPv6 = [].concat(addresses.IPv6, internals.IPv6);
  }

  // the addresses is sorted in IPv4 first and IPv6 first,
  // if localhost is allowed, it will be the first item in
  // the list.
  return [].concat(addresses.IPv4, addresses.IPv6);
};

Service.prototype._selfAnnouncement = function (service) {
  return (service.name === this._uuid);
};

Service.prototype._startService = function (address) {
  // TODO: swtch this out with a C call to if_nametoindex once the mdns bug
  // is fixed.
  // ref: https://github.com/agnat/node_mdns/issues/55
  var index;
  if (isme(address, 'any')) {
    this._internalAllowed = true;
    index = 0;
  } else if (isme(address, 'local')) {
    this._internalAllowed = true;
    index = -1;
  } else {
    this.emit('error',
      new Error('specfic none internal addresses are not yet supported' +
                ' try 0.0.0.0 insted'));
    return;
  }

  this._discover = mdns.createBrowser(this._key, {
    interfaceIndex: index
  });

  this._discover.on('error', this._relayError);

  this._discover.start();

  this._announce = mdns.createAdvertisement(
    this._key, this._address.port, {
      // workaround for some wird bug
      // ref: https://github.com/agnat/node_mdns/issues/51
      name: this._uuid,

      interfaceIndex: index
    }
  );

  this._announce.on('error', this._relayError);

  this._announce.start();
};

// Stop announceing and discovering
Service.prototype._stopService = function () {
  if (this._announce) this._announce.stop();
  if (this._discover) this._discover.stop();
};

Service.prototype.address = function () {
  // addresses is the last property there will be set
  if (this._address.addresses === null) {
    return null;
  }

  return this._address;
};

Service.prototype.close = function (callback) {
  var self = this;

  this._closed = true;

  // reset address info
  this._address = {
    port: null,
    addresses: null
  };

  // Callback is just a close event handler
  if (callback) this.once('close', callback),

  // Stop announceing and discovering
  this._stopService();

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
      if (self._server.address() === null) return done(null);
      self._server.close(done);
    }
  ], function () {
    self.emit('close');
  });
};
