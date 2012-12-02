
var tcpnet = require('../../tcpnet.js');
var createConfig = require('../config.js');
var test = require('tap').test;

var service = tcpnet(createConfig());

test('got listening event', function (t) {

  service.once('listening', function () {
      var addr = service.address();

      t.type(addr.port, 'number');
      t.type(addr.address, 'string');
      t.end();
  });
});

test('can close without connections', function (t) {
  service.close(function () {
    t.equal(service.connections.length, 0);
    t.end();
  });
});
