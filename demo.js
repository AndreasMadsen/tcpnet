var tcpnet = require('tcpnet');

// Create a service called my-cluster, for every TCP connection
// pipe the output to the terminal
var service = tcpnet('my-cluster', function (socket) {
  socket.pipe(process.stdout);
});

// For every one second send a message to all other services on the network
var randomId = require('crypto').randomBytes(6).toString('hex');
setInterval(function () {
  console.log('write to ' + service.connections.length + ' nodes');
  service.connections.forEach(function (socket) {
    socket.write('message from ' + randomId  + '\n');
  });
}, 1000);

// Pick a random port, and use all available addresses
service.listen(0, '0.0.0.0');

//not really nessarry since this is a auto discovery service
service.once('listening', function () {
  console.log('service is ready and listening on:');

  var info = service.address();
  info.addresses.forEach(function (address) {
    console.log('- ' + address + ':' + info.port);
  });
});
