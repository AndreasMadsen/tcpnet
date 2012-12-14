
var tcpnet = require('../../tcpnet.js');
var test = require('tap').test;
var async = require('async');

var serviceA = tcpnet('test-service');
    serviceA.listen();
var serviceB = tcpnet('test-service');
    serviceB.listen();

test('got correct data chunk, when writing immediately', function (t) {

  async.parallel({
    a: function (done) {
      serviceA.once('connection', function (socket) {
        socket.write('data chunk from A');

        socket.once('data', function (chunk) {
          done(null, chunk.toString());
        });
      });
    },

    b: function (done) {
      serviceB.once('connection', function (socket) {
        socket.write('data chunk from B');

        socket.once('data', function (chunk) {
          done(null, chunk.toString());
        });
      });
    }
  }, function (err, chunks) {
    t.equal(err, null);

    t.equal(chunks.a, 'data chunk from B');
    t.equal(chunks.b, 'data chunk from A');

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
