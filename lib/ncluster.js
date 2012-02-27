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
    var file = process.env.NCLUSTER_MODULE;
    var server = require(file);
    new (require('./worker'))(server);
    return;
  } else {
    var master = require('./master');
    new master(module, opts);
  }

}

