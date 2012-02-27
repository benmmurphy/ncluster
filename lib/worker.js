var cluster = require('cluster');
module.exports = Worker;

function Worker(server) {
  server.on("close", function() {
    process.exit(0);
  });

  server.on("listening", function() {
    process.send("ncluster:ready");
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

