
var tcpnet = require('../../tcpnet.js');
var test = require('tap').test;
var async = require('async');

var service = [];

function pingHandler(socket) {
  socket.on('data', function (chunk) {
    if (chunk.toString() === 'ping') socket.write('pong');
  });
}

function pingConnection(service, callback) {
  async.every(service.connections, function (socket, done) {
    socket.write('ping');
    socket.once('data', function (chunk) {
      return done(chunk.toString() === 'pong');
    });
  }, callback);
}

test('initializing service', function (t) {
  var A = tcpnet('test-service', pingHandler);
      A.listen();

  service.push(A);

  A.once('listening', function () {
    t.equal(A.connections.length, 0);
    t.end();
  });
});

test('one open connection', function (t) {
  var B = tcpnet('test-service', pingHandler);
      B.listen();

  service.push(B);

  var listeningEmit = false;
  B.once('listening', function () {
    listeningEmit = true;
  });

  B.once('connection', function () {
    t.equal(listeningEmit, true);

    // give it 100 ms to recessive more connections (too many)
    setTimeout(function () {
      t.equal(service[0].connections.length, 1);
      t.equal(service[1].connections.length, 1);

      pingConnection(B, function (sucess) {
        t.ok(sucess);
        t.end();
      });
    }, 100);
  });
});

test('two open connection', function (t) {
  var C = tcpnet('test-service', pingHandler);
      C.listen();

  service.push(C);

  var listeningEmit = false;
  C.once('listening', function () {
    listeningEmit = true;
  });

  C.once('connection', function () {
    t.equal(listeningEmit, true);

    // give it 100 ms to recessive more connections (too many)
    setTimeout(function () {
      t.equal(service[0].connections.length, 2);
      t.equal(service[1].connections.length, 2);
      t.equal(service[2].connections.length, 2);

      pingConnection(C, function (sucess) {
        t.ok(sucess);
        t.end();
      });
    }, 100);
  });
});

test('close one service', function (t) {
  var closeEmit = false;
  service[2].once('close', function () {
    closeEmit = true;
  });

  service[2].close(function () {
    t.equal(closeEmit, true);

    t.equal(service[0].connections.length, 1);
    t.equal(service[1].connections.length, 1);
    t.equal(service[2].connections.length, 0);

    pingConnection(service[1], function (sucess) {
      t.ok(sucess);
      t.end();
    });
  });
});

test('close one service', function (t) {
  var closeEmit = false;
  service[1].once('close', function () {
    closeEmit = true;
  });

  service[1].close(function () {
    t.equal(closeEmit, true);

    t.equal(service[0].connections.length, 0);
    t.equal(service[1].connections.length, 0);
    t.equal(service[2].connections.length, 0);

    t.end();
  });
});

test('cleanup: close last service', function (t) {
  var closeEmit = false;
  service[0].once('close', function () {
    closeEmit = true;
  });

  service[0].close(function () {
    t.equal(closeEmit, true);

    t.equal(service[0].connections.length, 0);
    t.equal(service[1].connections.length, 0);
    t.equal(service[2].connections.length, 0);

    t.end();
  });
});
