var http = require('http');
var cluster = require('cluster');

var server = http.createServer(function(req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('Hello From Worker\n');
});

server.listen(3000);

module.exports = server;
