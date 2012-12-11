
var tcpnet = require('../../tcpnet.js');
var test = require('tap').test;
var async = require('async');

var serviceA = tcpnet({
    name: 'test-service',
    uuid: '0A0'
  });
    serviceA.listen();

var serviceB = tcpnet({
    name: 'test-service',
    uuid: '00A'
  });
  serviceB.listen();

test('got connection on one service', function (t) {

  serviceA.once('connection', function () {

    // wait 200 ms and check for double connection
    setTimeout(function () {
      t.equal(serviceA.connections.length, 1);
      t.equal(serviceB.connections.length, 1);
      t.end();
    }, 200);
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
