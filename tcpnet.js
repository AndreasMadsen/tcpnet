
var net = require('net');
var util = require('util');
var mdns = require('mdns');
var isme = require('isme');
var events = require('events');

function Service(options) {
  if (!(this instanceof Service)) return new Service(options);

  var self = this;

  this.connections = [];

  this._serviceKey = mdns.tcp(options.name);
  this._discover = mdns.createBrowser(this._serviceKey);
  this._announce = null;

  this._uuidNumber = parseInt(options.uuid, 16);
  this._uuidString = options.uuid;
  this._port = -1;
  this._server = net.createServer();
  this._server.listen(options.port, options.host, function () {
    self._port = this.address().port;

    self._announce = mdns.createAdvertisement(self._serviceKey, self._port, {
      txtRecord: { uuid: self._uuidString }
    });
    self._announce.start();
    self._discover.start();

    self.emit('listening');
  });

  this._server.on('connection', function (socket) {
    console.log('server got socket');
    self._addResciveSocket(socket);
  });

  this._discover.on('serviceUp', function(service) {
    var addresses = service.addresses.filter(net.isIPv4.bind(net));

    // Don't connect to this service worker
    if (addresses.some(isme) && service.port == self._port) {
      return;
    }

    // The service worker with the highest number gets the pleasure of
    // initiating the TPC connection.
    if (self._uuidNumber <= parseInt(service.txtRecord.uuid, 16)) {
      return;
    }

    var addr = {
      port: service.port,
      host: addresses[0]
    };

    // Don't allow multiply connection to same service worker
    if (self._existConnection(addr)) {
      return;
    }

    var socket = net.connect(addr);
    socket.once('connect', function () {
      self._addSendSocket(socket, addr);
    });
  });
}
util.inherits(Service, events.EventEmitter);
module.exports = Service;

Service.prototype._addSendSocket = function (socket, address) {
  var self = this;

  socket.write(JSON.stringify(address));
  socket.once('data', function (chunk) {
    self._addSocket(socket);
  });
};

Service.prototype._addResciveSocket = function (socket) {
  var self = this;

  socket.once('data', function (chunk) {
    socket.address = JSON.parse(chunk.toString());
    socket.write('negotiated', function () {
      self._addSocket(socket);
    });
  });
};

Service.prototype._addSocket = function (socket) {
  var self = this;

  this.connections.push(socket);

  socket.once('close', function () {
    self.connections.splice(self.connections.indexOf(socket), 1);
  });

  this.emit('connection', socket);
};

Service.prototype._existConnection = function (address) {
  var i = this.connections.length;
  while (i--) {
    if (this.connections[i].address.host == address.host &&
        this.connections[i].address.port == address.port) {
      return true;
    }
  }

  return false;
};

Service.prototype.address = function () {
  return this._server.address.apply(this._server, arguments);
};

Service.prototype.close = function () {
  self._announce.stop();
  self._discover.stop();

  return this._server.close.apply(this._server, arguments);
};
