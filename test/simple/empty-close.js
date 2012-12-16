
var tcpnet = require('../../tcpnet.js');
var test = require('tap').test;

var service = tcpnet('test-service');
    service.listen();

test('got listening event', function (t) {

  service.once('listening', function () {
    var addr = service.address();

    t.type(addr.port, 'number');
    t.type(addr.addresses, 'object');
    t.type(addr.addresses[0], 'string');
    t.end();
  });
});

test('can close without connections', function (t) {

  service.close(function () {
    t.equal(service.connections.length, 0);
    t.end();
  });
});

test('can close without listen', function (t) {
  service = tcpnet('test-service');

  service.close(function () {
    t.equal(service.connections.length, 0);
    t.end();
  });
});

test('can close fast after listen', function (t) {
  service = tcpnet('test-service');
  service.listen();
  service.close(function () {
    t.equal(service.connections.length, 0);
    t.end();
  });
});
