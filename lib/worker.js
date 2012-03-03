var cluster = require('cluster');
module.exports = Worker;

var net = require('net');

var original_listen = net.Server.prototype.listen;

net.Server.prototype.listen = function() {
  if (arguments.length >= 1 && typeof(arguments[0]) == 'number') {
    this.expected_port = arguments[0];
  }

  original_listen.apply(this, arguments);
};

function Worker(server) {
  var servers = Array.isArray(server) ? server : [server];

  var serverCloses = 0;

  servers.forEach(function(server) {
    server.on("close", function() {
      ++serverCloses;
      if (serverCloses == servers.length) {
        process.exit(0);
      }
    });
  });

  var serversListening = 0;

  servers.forEach(function(server) {
    var error = function() {
      console.log("[Worker] Failed to bind to port");
      process.exit(1);
    };
    server.on("error", error);
    server.on("listening", function() {
      server.removeListener("error", error);
      if (server.expected_port == null || server.address().port == server.expected_port) {
        ++serversListening;
        if (serversListening == servers.length) {
          process.send("ncluster:ready");
        }
      } else {
        console.log("[Worker] Failed to bind to port: %s", server.expected_port);
        process.exit(1);
      }
    });
  });

  process.on("SIGQUIT", function() {
    servers.forEach(function(server) {
      server.close();
    });
  });


  process.on("disconnect", function() {
    this.suicide();
  }.bind(this));

  cluster.on("death", function() {
    this.suicide();
  }.bind(this));

  this.send_heartbeat();
};

Worker.prototype.suicide = function() {
  console.error("[Worker] Lost connection to master. Suiciding");
  process.exit(1);
};

Worker.prototype.send_heartbeat = function() {
  try {
    process.send("ncluster:heartbeat");
  } catch (e) {
    this.suicide();
  }

  setTimeout(this.send_heartbeat.bind(this), 100);
};

