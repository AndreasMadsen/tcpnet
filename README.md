#tcpnet

> Creates TCP connections between nodes without configuration.

## Installation

```sheel
npm install tcpnet
```

If the module dosn't work checkout the `node-mdns` [install instructions](https://github.com/agnat/node_mdns#installation).

## Example

```javascript
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
```

Now startup a few node.js processes with this code, and you will see this:

```shell
$node demo.js

write to 2 nodes
message from a6c953a8c1f1
message from 4eba8c4e76e9
write to 2 nodes
message from a6c953a8c1f1
message from 4eba8c4e76e9
```

## API documentation

> In more detail this is a module for creating a [fully connected](http://en.wikipedia.org/wiki/File:NetworkTopology-FullyConnected.png)
node cluster, this means that each node is aware of all other running nodes by
a TCP connection. For the time being this is limited to a local network, that
means you can't connect nodes across the internet, however connection nodes
on a local network (switch or router) works perfectly. But thoughts are being
made.

### service = tcpnet(settings, [connection])

This function creates a new service instance.

The `settings` argument is required and can be a `string` or an `object`.
Starting with the `string` case. This is the name of the service and is
the only thing there must be shared between all services (nodes).

Example: this code creates two services, they share the same name so they
will automaticly be connected.

```javascript
var serviceA = tcpnet('my-cluster');
    serviceA.listen();

var serviceB = tcpnet('my-cluster');
    serviceB.listen();
```

The `settings` argument can also be an `object`, this provides some more
options, there are given by the following paramenters:

* `name` required - exactly the same as the `string` case.
* `uuid` optional - each service instance **must** have a unique ID,
 if two service instances share the same connection they can't connect
 and may not be able to reach all other servies, with diffrent IDs.
 By default the uuid is created by the [gmid](https://github.com/AndreasMadsen/gmid)
 module. Note there are two requirements for the uuid. One, it must be a
 hexidecimal string (e.g. `BADA55`). Two, they all ids must have a fixed
 length (e.g. `AA` and `CCCCCC` won't work).

The next argument `connection` is a optional function there if given, will
be added as a `connection` event handler.

Example: this code will do the same as the one below:

```javascript
var service = tcpnet('my-cluster', function (socket) {
  // do something with the TCP socket
});

service.listen();
```

```javascript
var service = tcpnet('my-cluster');

service.on('connection', function (socket) {
  // do something with the TCP socket
});

service.listen();
```

### service.listen([port], [address], [callback])

The first argument `port` is no big surprise, its the port that the
service will use to receive other connections. By default `port` is `0`
which is just a random available `port` assigned by the OS.

The second argument `address` is the address you want to listen on, by
default `address` is `0.0.0.0` which is all available addresses (localhost
and public). Do also note that `address` can be a domain (e.q. `localhost`), it
will just be resoved to a IP address by a DNS lookup.

Example: 3 ways to listen on only the loopback interface.

```javascript
service.listen(0, '127.0.0.1');
service.listen(0, '::1');
service.listen(0, 'localhost');
```

_NOTE: because there apear to be a bug in `MDNS` a public only address
(e.q. `192.168.0.198`) is not allowed, if you wan't the service to be public
you will have to use `0.0.0.0` for the time being._

The third argument `callback` is just an `listening` event handler.

```javascript
service.listen(function () {
  console.log('service is ready');
});
```

### service.address()

This method will return an object containing two properties:

* `port`
* `addresses`

NOTE: do not use this before the `listening` has emitted, if you do so it will
return `null`.

Example: show the port and addresses that the service is listening on:

```javascript
service.listen(0, '0.0.0.0', function () {
  console.log('service is ready and listening on:');

  var info = service.address();
  info.addresses.forEach(function (address) {
    console.log('- ' + address + ':' + info.port);
  });
});

/*  Output could be:
 * - 127.0.0.1:52740
 * - 192.168.0.198:52740
 * - ::1:52740
 * - fe80::5ab0:35ff:fe84:84b1:52740
*/
```

### service.connections

This is a dynamic array containing all online sockets. This means that sockets
will be added once the `connection` event fires and removed once socket `close`
event fires.

Example: multicast a single message from this service to all other online
services.

```javascript
service.connections.forEach(function (socket) {
  socket.write('hallo message to you from me\n');
});
```

### service.close([callback])

This method will close the service and call `socket.end()` on all online
connections.

The optional `callback` arguments will be assigned as an `close` event handler.

```javascript
service.close(function () {
  // everything related to the service is now closed, unless there are other
  // this running node will automaticly shutdown this process.
});
```

### Event: connection

This event is emitted once a new socket becomes online, to detect the when
is offline use the socket `close` event:

Example: how to detect remote service shutdown

```javascript
service.on('connection', function (socket) {
  socket.once('close', function () {
    console.log('the service is most likely dead now');
  });
});
```

### Event: error

If an `error` occurres in the `server` or between establing a `TCP` connection
and the actuall `connection` event the `error` event will emit. Be aware that
if no `error` handler exist the error will be throwen.

Example: on one way to handle errors (but almost like just throwing)

```javascript
service.on('error', function (err) {
  console.error(err.stack);

  // oh no, an error we better just close the service
  service.close(function () {

    // if anything else is running, then it won't be shutdown gracefully
    process.exit(1);
  });
});
```

### Event: listening

Once the service is online this event will emit, note that calling
`service.address()` is quite useless if this event hasn't been emitted.

### Event: close

The service is now closed dude to a `service.close` call.

##License

**The software is license under "MIT"**

> Copyright (c) 2012 Andreas Madsen
>
> Permission is hereby granted, free of charge, to any person obtaining a copy
> of this software and associated documentation files (the "Software"), to deal
> in the Software without restriction, including without limitation the rights
> to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in
> all copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
> FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
> AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
> LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
> OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
> THE SOFTWARE.
