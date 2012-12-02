var tcpnet = require('./tcpnet.js');
var uuid = require('node-uuid');

var create = new Array(32);
    uuid.v1(null, create, 0);
    uuid.v4(null, create, 16);

var service = tcpnet({
    port: 0, // random
    host: '0.0.0.0', // everything
    name: 'custom-name',
    uuid: create.join('')
});

// collection of sockets
service.on('connection', function (socket) {
  socket.pipe(process.stdout, {end: false});
});

// write a message every 100 ms to all other services with same name
var randomId = Math.random().toString(10).slice(2);
setInterval(function () {
    console.log('write to ' + service.connections.length + ' worker');
    service.connections.forEach(function (socket) {
      socket.write('message from ' + randomId  + '\n');
    });
}, 1000);

// not really nessarry since this is a auto discovery service
service.once('listening', function () {
    var addr = service.address();
    console.log('opened on: ' + addr.address + ':' + addr.port);
});