Cluster solution based on node's cluster module.

#Features

* Restarts workers that die
* Zero downtime reloading of application when receiving SIGHUP
* Gracefully dies when receiving SIGQUIT
* Correctly reloads code when deployed with capistrano

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
    var express = require('express');


    var server = express.createServer(
        express.logger()
    );

    server.on("close", function() {
      process.exit(0);
    });

    server.on("listening", function() {
      process.send("ncluster:ready");
    });

    process.on("SIGQUIT", function() {
      server.close();
    });

    server.listen(3000);

    server.get('/', function(req, res){
      res.send('Hello World from: ' + process.pid);
    });
