var tcpnet = require('./tcpnet.js');

var service = tcpnet('custom-name', function (socket) {
  socket.pipe(process.stdout, {end: false});
});

service.listen();

// write a message every one sec to all other services with same name
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
  console.log('opened on: ', addr.addresses, 'port:', addr.port);
});