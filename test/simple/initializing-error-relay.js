
var tcpnet = require('../../tcpnet.js');
var test = require('tap').test;
var events = require('events');
var async = require('async');
var net = require('net');

var serviceA, serviceB;
var socketA, socketB;
var testSockets = [];

// this will emit a socket event once a net.connect has been created
var testEmitter = new events.EventEmitter();
var _connect = net.connect;
net.connect = function () {
  var socket = _connect.apply(this, arguments);

  process.nextTick(function () {
    testEmitter.emit('socket', socket);
  });

  return socket;
};

function createService(done) {
  var service;
  var fakeError;

  // create a test service
  service = tcpnet('test-service');
  service.listen();

  // whatever error there is relayed to the service, it should be equal
  // to the fake error.
  service.once('error', function (err) {
    done(null, fakeError === err);
  });

  // In one end the socket will appear in the tcp server
  service._server.once('connection', function (socket) {
    // there is no socket initializing
    done(null, true);
  });

  // In one end the socket will appear as a net.connect call
  testEmitter.once('socket', function (socket) {

    // prevent double test for client socket relay
    if (testSockets.indexOf(socket) !== -1) return;
    testSockets.push(socket);

    // emit fake error
    fakeError = new Error('fake client socket error');
    socket.emit('error', fakeError);
  });

  // Monkey patch net connect to simulate an error in the connection
  return service;
}

test('error relay in handshake', function (t) {

  async.parallel({
    a: function (done) {
      serviceA = createService(done);
      serviceA.once('connection', function (socket) {
        socketA = socket;
      });
    },

    b: function (done) {
      serviceB = createService(done);
      serviceB.once('connection', function (socket) {
        socketB = socket;
      });
    }
  }, function (err, result) {
    t.equal(err, null);
    t.ok(result.a);
    t.ok(result.b);
    t.end();
  });
});

function testSocket(num, socket, done) {
  var fakeError = new Error('fake socket error');

  socket.once('error', function (err) {
    done(null, err === fakeError);
  });

  socket.emit('error', fakeError);
}

test('emit error after handshake', function (t) {
  async.parallel({
    a: function (done) {
      if (socketA) {
        testSocket(1, socketA, done);
      } else {
        serviceA.once('connection', function (socket) {
          testSocket(1, socket, done);
        });
      }
    },

    b: function (done) {
      if (socketB) {
        testSocket(2, socketB, done);
      } else {
        serviceB.once('connection', function (socket) {
          testSocket(2, socket, done);
        });
      }
    }
  }, function (err, result) {
    t.equal(err, null);
    t.ok(result.a);
    t.ok(result.b);
    t.end();
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
