
var tcpnet = require('../../tcpnet.js');
var createConfig = require('../config.js');
var test = require('tap').test;
var async = require('async');

var serviceA = tcpnet(createConfig());
var serviceB = null;

test('initializing service B after A is ready', function (t) {
  serviceA.once('listening', function () {
    serviceB = tcpnet(createConfig());
    t.end();
  });
});

test('got connection in both services', function (t) {

  async.parallel({
    a: function (done) {
      serviceA.once('connection', function (socket) {
        done(null, socket);
      });
    },

    b: function (done) {
      serviceB.once('connection', function (socket) {
        done(null, socket);
      });
    }
  }, function (err, sockets) {
    t.equal(err, null);

    t.equal(serviceA.connections.length, 1);
    t.equal(serviceA.connections[0], sockets.a);

    t.equal(serviceB.connections.length, 1);
    t.equal(serviceB.connections[0], sockets.b);

    t.end();
  });
});

test('remote object set on server', function (t) {

  // check types of properties
  t.type(serviceA.connections[0].remote.addresses[0], 'string');
  t.type(serviceA.connections[0].remote.port, 'number');

  t.type(serviceB.connections[0].remote.addresses[0], 'string');
  t.type(serviceB.connections[0].remote.port, 'number');

  // Since the services are on same mashine, they share address
  t.deepEqual(
    serviceA.connections[0].remote.addresses.sort(),
    serviceB.connections[0].remote.addresses.sort()
  );

  t.end();
});

test('can perform two way communication', function (t) {
  var socketA = serviceA.connections[0];
  var socketB = serviceB.connections[0];

  // data transfer A -> B
  socketA.write('a sends');
  socketB.once('data', function (chunk) {
    t.equal(chunk.toString(), 'a sends');

    // data transfer B -> A
    socketB.write('b sends');
    socketA.once('data', function (chunk) {
      t.equal(chunk.toString(), 'b sends');

      // done
      t.end();
    });
  });
});

test('close services', function (t) {

  async.parallel([
    serviceA.close.bind(serviceA),
    serviceB.close.bind(serviceB)
  ], function (err) {
    t.equal(err, null);
    t.end();
  });
});
