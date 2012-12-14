
var tcpnet = require('../../tcpnet.js');
var test = require('tap').test;

var service = tcpnet('test-service');
    service.listen();

test('relay errors on tcp server', function (t) {
  var fakeError = new Error('fake server error');

  service.once('error', function (err) {
    t.equal(err, fakeError);
    t.end();
  });

  service._server.emit('error', fakeError);
});

test('close service', function (t) {

  service.close(function () {
    t.end();
  });
});
