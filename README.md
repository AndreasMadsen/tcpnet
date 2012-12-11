#tcpnet

> Create zero configuration horizontal tcp cluster

##Mad science

I have hacked to much vertical single OS cluster software, time for a change!

#API

```javascript
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
  console.log('uuid:', service._uuidString);
  console.log('opened on: ', addr.addresses, 'port:', addr.port);
});
```

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
