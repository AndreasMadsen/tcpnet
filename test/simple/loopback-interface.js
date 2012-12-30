
var tcpnet = require('../../tcpnet.js');
var test = require('tap').test;
var async = require('async');
var ifname = require('interface-name');
var mdns = require('mdns');

// Avahi system is expected to emit an error
if (mdns.isAvahi) {
  test('avahi system should emit error', function (t) {

    var serviceA = tcpnet('test-service');
        serviceA.listen(0, '127.0.0.1');

        serviceA.once('error', function (err) {
          t.equal(
            err.message,
            'loopback address is not supported on linux-avahi platform'
          );

          serviceA.close(function () {
            t.end();
          });
        });
  });

  return;
}

var serviceA = tcpnet('test-service');
    serviceA.listen(0, '127.0.0.1');
var serviceB = tcpnet('test-service');
    serviceB.listen(0, '127.0.0.1');

var LOOPBACK_NAME = ifname('127.0.0.1');
function allLoopback(info) {
  var wrong = info.adddresses.some(function (address) {
    ifname(address) !== LOOPBACK_NAME;
  });

  return wrong;
}

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

test('all adddresses are loopback', function (t) {
  t.ok(allLoopback(serviceA.address()), 'all ip addresses are loopback');
  t.ok(allLoopback(serviceB.address()), 'all ip addresses are loopback');
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
