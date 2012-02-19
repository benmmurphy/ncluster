module.exports = ProcessMaster;

var cluster = require('cluster');
var fs = require('fs');
var os = require('os');
var path = require('path');
var events = require('events');

/*
 * Process master has the following states:
 * starting, started, stopping, stopped
 *
 * starting -> stopping -> stopped
 *   |        ^    
 *   V       /     
 * started  /
 * 
 */
  
function ProcessMaster(id, module, opts, log) {
  this.id = id;
  this.log = log;
  this.workers = [];
  this.workers_killed = 0;
  this.options = opts;
  this.module = module;

  this.state = "starting";

  this.code_path = fs.realpathSync(this.relative_path(this.module));
  cluster.on("death", this.death.bind(this));
  this.workers = this.start_workers();
}

ProcessMaster.prototype.__proto__ = events.EventEmitter.prototype;

ProcessMaster.prototype.update_code_path = function() {
  process.env.NCLUSTER_MODULE = this.code_path;
}

ProcessMaster.prototype.relative_path = function(p) {
  return path.resolve(this.options.dir, p);
}

ProcessMaster.prototype.all_workers_initialized = function(workers) {
  for (var i = 0; i < workers.length; ++i) {
    if (!workers[i].initialized) {
      return false;
    }
  }
  return true;
}


ProcessMaster.prototype.handle_worker_message = function(worker, message) {
  if (message == "ncluster:ready") {
    this.handle_worker_ready(worker);
  }
}
ProcessMaster.prototype.handle_worker_ready = function(worker) {

  worker.initialized = true;
  this.log.info("[Process Master %s] Worker initialized: %s", this.id, worker.pid);

  if (this.state === "starting") {
    if (this.all_workers_initialized(this.workers)) {
      this.state = "started";
      this.log.info("[Process Master %s] ProcessMaster started", this.id);
      this.emit("started", this);
    }
  }

}


ProcessMaster.prototype.create_worker = function() {
  this.update_code_path();
  var worker = cluster.fork();

  var t = this;
  worker.on("message", function(message) { t.handle_worker_message(worker, message); });
  this.log.info("[Process Master %s] Starting worker: %s", this.id, worker.pid);
  return worker;
}


ProcessMaster.prototype.start_workers = function() {
  this.log.info("[Process Master %s] Starting %s workers", this.id, this.options.workers);
  var workers = [];
  for (var i = 0; i < this.options.workers; ++i) {
    var worker = this.create_worker();
    workers.push(worker);
  }

  return workers;
}



ProcessMaster.prototype.stop = function() {
  if (this.state == "starting" || this.state == "started") {
    this.log.info("[Process Master %s] Stopping workers", this.id);
    this.state = "stopping";
    this.kill_workers(this.workers, "SIGQUIT");
    this.emit("stopping", this);
  }
}



ProcessMaster.prototype.kill_workers = function(workers, signal) {
  for (var i = 0; i < workers.length; ++i) {
   var worker = workers[i];
   this.log.info("[Process Master %s] Sending worker: %s signal %s", this.id, worker.pid, signal);
   worker.kill(signal);
  }
}


ProcessMaster.prototype.death = function(worker) {
  var idx = this.workers.indexOf(worker);
  if (idx < 0) {
    return;
  }

  this.log.info("[Process Master %s] Worker %s died. State: %s", this.id, worker.pid, this.state);

  if (this.state == "starting" || this.state == "started") {
    this.death_while_running(worker, idx);
  } else {
    this.death_when_shutting_down(worker, idx);
  }
}

ProcessMaster.prototype.check_for_stopped = function() {
  if (this.workers.length == 0) {
    this.log.info("[Process Master %s] All workers gracefully terminated.", this.id);
    this.state = "stopped";
    this.emit("stopped", this);
  }
}

ProcessMaster.prototype.death_when_shutting_down = function(worker, idx) {

  this.workers.splice(idx, 1);
  this.check_for_stopped();
}

ProcessMaster.prototype.check_for_bad_state = function() {
  if (new Date - this.startup < 20000) {
    if (++this.workers_killed == 20) {
      return true;
    }
  }

  return false;
}

ProcessMaster.prototype.set_log = function(log) {
  this.log = log;
}

ProcessMaster.prototype.death_while_running = function(worker, idx) {
  if (this.state == "starting" && this.check_for_bad_state()) {

    this.stop();

    return;
  }


  this.workers[idx] = this.create_worker();

}

