var http = require('http');
var net = require('net');
var fs = require('fs');
var path = require('path');

var http_server = http.createServer(function(req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('Hello From Worker');
});

http_server.listen(3000);

module.exports = [http_server];
