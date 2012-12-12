
var tcpnet = require('../../tcpnet.js');
var test = require('tap').test;
var async = require('async');

function createService(done) {
  var service;

  var result = {
    connectionFired: false,
    connectionEmitted: false,
    listeningFired: false,
    listeningEmitted: false
  };

  service = tcpnet('test-service', function () {
    result.connectionFired = true;
  });

  service.listen(function () {
    result.listeningFired = true;
  });

  service.once('listening', function () {
    result.listeningEmitted = true;
  });

  service.once('connection', function () {
    result.connectionEmitted = true;
    done(null, result);
  });

  return service;
}

function closeService(service, done) {
  var result = {
    closeFired: false,
    closeEmitted: false
  };

  service.close(function () {
    result.closeFired = true;
  });

  service.once('close', function () {
    result.closeEmitted = true;
    done(null, result);
  });
}

var serviceA, serviceB;

test('connection event fired in both argument an event emitter', function (t) {
  async.parallel({
    a: function (done) {
      serviceA = createService(done);
    },

    b: function (done) {
      serviceB = createService(done);
    }
  }, function (err, result) {
    t.equal(err, null);

    t.deepEqual(result.a, {
      connectionFired: true,
      connectionEmitted: true,
      listeningFired: true,
      listeningEmitted: true
    });
    t.deepEqual(result.b, {
      connectionFired: true,
      connectionEmitted: true,
      listeningFired: true,
      listeningEmitted: true
    });

    t.end();
  });
});

test('close services', function (t) {

  async.parallel({
    a: function (done) {
      closeService(serviceA, done);
    },

    b: function (done) {
      closeService(serviceB, done);
    }
  }, function (err, result) {
    t.equal(err, null);

    t.deepEqual(result.a, {
      closeFired: true,
      closeEmitted: true
    });
    t.deepEqual(result.b, {
      closeFired: true,
      closeEmitted: true
    });

    t.end();
  });
});
