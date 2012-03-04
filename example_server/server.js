var http = require('http');
var net = require('net');
var crypto = require('crypto');
var fs = require('fs');
var path = require('path');
var https = require('https');

var root = path.dirname(process.argv[1]);
var privateKey = fs.readFileSync(path.resolve(root, 'key.pem'));
var certificate = fs.readFileSync(path.resolve(root, 'cert.pem'));

var credentials = crypto.createCredentials({key: privateKey, cert: certificate});

var http_server = http.createServer(function(req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('Hello From Worker\n');
});

http_server.listen(3000);

var https_server = https.createServer({key: privateKey, cert: certificate}, function(req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('Hello From SSL Worker\n');
});


https_server.listen(3443);


module.exports = [http_server, https_server];
