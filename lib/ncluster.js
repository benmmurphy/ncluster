// example:
//
// ncluster('./server.js', {workers : 5})
//

// SIGNALS:
//   SIGQUIT : graceful shutdown
//   SIGHUP  : reload workers
//   SIGUSR2 : reopen log files

module.exports= start;

var cluster = require('cluster');





function start(module, opts) {
  if (cluster.isWorker) {
    var options = JSON.parse(process.env.NCLUSTER_OPTIONS);
    var worker = require('./worker');
    var server = require(options.file);
    new worker(server, options.heartbeat_interval);
    return;
  } else {
    var master = require('./master');
    new master(module, opts);
  }

}

