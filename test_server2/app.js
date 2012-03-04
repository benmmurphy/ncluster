var ncluster = require('../lib/ncluster');

var options = JSON.parse(process.argv[2]);

ncluster('server.js', options);
