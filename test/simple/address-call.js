
var tcpnet = require('../../tcpnet.js');
var test = require('tap').test;

test('address returns', function (t) {

  var service = tcpnet('test-service');

  t.equal(service.address(), null);

  service.listen(function () {

   t.type(service.address().port, 'number');
   t.type(service.address().addresses, 'object');

    service.close(function () {
      t.equal(service.address(), null);

      t.end();
    });
  });
});

