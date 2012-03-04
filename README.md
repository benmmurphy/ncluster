Cluster solution based on node's cluster module.

#Features

* Restarts workers that die
* Zero downtime reloading of application when receiving SIGHUP
* Gracefully dies when receiving SIGQUIT
* Correctly reloads code when deployed with capistrano

# Hacks

* Overrides net._createServerHandle to track sockets open by master so they can be closed during graceful shutdown. If they are not closed then new clients will hang instead of receiving connection refused.
* Overrides net.Server.prototype.listen in worker to ensure an error is generated if a port cannot be bound to

#Issues

* Not enough testing
* Nodejs's cluster module doesn't appear to be fair (possibly why people have created their own nodejs http proxy balancers)

#Related

* http://learnboost.github.com/cluster/
* https://github.com/LearnBoost/up
* https://github.com/LearnBoost/distribute

#Usage

Example app.js

    var ncluster = require('ncluster');
    ncluster('./server.js', {workers: 5});

Example server.js

    var http = require('http');
    var http_server = http.createServer(function(req, res) {
      res.writeHead(200, {'Content-Type': 'text/plain'});
      res.end('Hello From Worker\n');
    });

    http_server.listen(3000);


    module.exports = http_server;

# Examples

https://github.com/benmmurphy/nodejs_vagrant_helloworld

