var cluster = require('cluster');
module.exports = Worker;

var net = require('net');

var expected_port = null;
var original_listen = net.Server.prototype.listen;
net.Server.prototype.listen = function() {
  if (arguments.length >= 1 && typeof(arguments[0]) == 'number') {
    expected_port = arguments[0];
  }

  original_listen.apply(this, arguments);
};

function Worker(server) {
  server.on("close", function() {
    process.exit(0);
  });

  server.on("listening", function() {
    if (expected_port == null || server.address().port == expected_port) {
      process.send("ncluster:ready");
    } else {
      console.log("[Worker] Failed to bind to port: %s", expected_port);
    }
  });

  process.on("SIGQUIT", function() {
    server.close();
  });


  process.on("disconnect", function() {
    this.suicide();
  }.bind(this));

  cluster.on("death", function() {
    process.exit(1);
  });

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

