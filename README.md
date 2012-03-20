Cluster solution based on node's cluster module.

[![Build Status](https://secure.travis-ci.org/benmmurphy/ncluster.png)](http://travis-ci.org/benmmurphy/ncluster)

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

# Default Configuration

    var defaults = {
      workers: os.cpus().length,
      dir: path.dirname(process.argv[1]),
      heartbeat_timeout: 10 * 1000,
      startup_timeout: 60 * 1000,
      log_dir: "log",
      kill_wait_timeout: 30 * 1000,
      heartbeat_interval: 500
    };

# Examples

https://github.com/benmmurphy/nodejs_vagrant_helloworld



