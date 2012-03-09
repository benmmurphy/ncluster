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

function Worker(server, heartbeat_interval) {
  this.keep_alive_timeout = 5000;
  this.open = true;
  this.heartbeat_interval = heartbeat_interval;
  this.servers = Array.isArray(server) ? server : [server];
  this.server_closes = 0;
  this.servers_listening = 0;
  this.setup_no_keep_alive_when_shutting_down();
  this.setup_keep_alive_timeout();
  this.setup_clean_shutdown();
  this.setup_fire_ready();



  process.on("SIGQUIT", function() {
    this.open = false;
    this.servers.forEach(function(server) {
      server.close();
    });
  }.bind(this));


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

Worker.prototype.setup_keep_alive_timeout = function() {
  this.servers.forEach(function(server) {
    server.addListener("connection", function(connection) {
      connection.setTimeout(this.keep_alive_timeout);
    }.bind(this));
  }.bind(this));
}
Worker.prototype.setup_no_keep_alive_when_shutting_down = function() {

  this.servers.forEach(function(server) {
      server.listeners("request").unshift(function(req, resp) {
        if(!this.open) {
          resp.setHeader("Connection", "close");
        }
      }.bind(this));
  }.bind(this));
}

Worker.prototype.setup_clean_shutdown = function() {
  this.servers.forEach(function(server) {
    server.on("close", function() {
      ++this.server_closes;
      if (this.server_closes == this.servers.length) {
        process.exit(0);
      }
    }.bind(this));
  }.bind(this));
}

Worker.prototype.send_heartbeat = function() {
  try {
    process.send("ncluster:heartbeat");
  } catch (e) {
    this.suicide();
  }

  setTimeout(this.send_heartbeat.bind(this), this.heartbeat_interval);
};

Worker.prototype.setup_fire_ready = function() {
  this.servers.forEach(function(server) {
    var error = function() {
      console.error("[Worker] Failed to bind to port");
      process.exit(1);
    };
    server.on("error", error);
    server.on("listening", function() {
      server.removeListener("error", error);
      if (server.expected_port == null || server.address().port == server.expected_port) {
        ++this.servers_listening;
        if (this.servers_listening == this.servers.length) {
          process.send("ncluster:ready");
        }
      } else {
        console.error("[Worker] Failed to bind to port: %s", server.expected_port);
        process.exit(1);
      }
    }.bind(this));
  }.bind(this));
}

