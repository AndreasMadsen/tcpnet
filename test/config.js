var uuid = require('node-uuid');


module.exports = function () {
var create = new Array(32);
    uuid.v1(null, create, 0);
    uuid.v4(null, create, 16);

  return {
    port: 0, // random
    host: '0.0.0.0', // everything
    name: 'custom-name',
    uuid: create.join('')
  };
};
