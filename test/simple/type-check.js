
var tcpnet = require('../../tcpnet.js');
var test = require('tap').test;

test('no service name', function (t) {
  try {
    tcpnet();
  } catch (e) {
    t.equal(e.message, 'first argument must be a string or an object');
    t.ok(e instanceof TypeError);
    t.end();
  }
});

test('bad service name type', function (t) {
  try {
    tcpnet(null);
  } catch (e) {
    t.equal(e.message, 'first argument must be a string or an object');
    t.ok(e instanceof TypeError);
    t.end();
  }
});

test('no service name in settings', function (t) {
  try {
    tcpnet({});
  } catch (e) {
    t.equal(e.message, 'service name must be a string type');
    t.ok(e instanceof TypeError);
    t.end();
  }
});

test('bad service name in settings', function (t) {
  try {
    tcpnet({ name: null });
  } catch (e) {
    t.equal(e.message, 'service name must be a string type');
    t.ok(e instanceof TypeError);
    t.end();
  }
});

test('bad uuid type in settings', function (t) {
  try {
    tcpnet({ name: 'valid', uuid: null });
  } catch (e) {
    t.equal(e.message, 'service uuid must be a string type');
    t.ok(e instanceof TypeError);
    t.end();
  }
});

test('bad uuid string in settings', function (t) {
  try {
    tcpnet({ name: 'valid', uuid: 'NOT-HEX' });
  } catch (e) {
    t.equal(e.message, 'service uuid must be a hex string');
    t.ok(e instanceof TypeError);
    t.end();
  }
});
