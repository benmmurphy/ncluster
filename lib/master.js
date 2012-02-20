module.exports = Master;

var cluster = require('cluster');
var fs = require('fs');
var os = require('os');
var path = require('path');
var Log = require('log');

var ProcessMaster = require('./process_master');

function Master(module, opts) {
  this.module =  module;
  this.next_process_master_id = 1;

  opts = opts || {}
  if (opts.workers == null) {
    opts.workers = os.cpus().length;
  }

  if (opts.dir == null) {
    opts.dir = path.dirname(process.argv[1]);
  }


  if (opts.ready_message == null) {
    opts.ready_message = true;
  }

  if (opts.log_dir == null) {
    opts.log_dir = "log";
  }


  this.options = opts;
  

  this.open_log();

  this.state = "starting";

  process.on("SIGQUIT", this.graceful_shutdown.bind(this));
  process.on("SIGHUP", this.graceful_restart.bind(this));
  process.on("SIGUSR2", this.reopen_logs.bind(this));

  this.old_master = null;
  this.current_master = null;

  this.log_lock = 0;
  this.new_master = this.start_master();
  
}


Master.prototype.relative_path = function(p) {
  return path.resolve(this.options.dir, p);
}

Master.prototype.open_log = function() {
  
  this.log = new Log('info', fs.createWriteStream(this.relative_path(this.options.log_dir) + "/master.log", {flags: "a"}));
  
}

Master.prototype.process_master_started = function(master) {

  this.log.info("[Master] New process master (%s) started", master.id);

  if (this.state == "new_master") {
    if (master == this.new_master) {
      
      this.state = "reap_master";
      this.old_master = this.current_master;
      this.current_master = this.new_master;
      this.new_master = null;
      this.log.info("[Master] Stopping old process master (%s)", this.old_master.id);
      this.old_master.stop();
    }
  } else if (this.state == "starting") {
    
    if (master == this.new_master) {
      this.log.info("[Master] Cluster initialized");
      this.state = "started";
      this.current_master = this.new_master;
      this.new_master = null;
    }
  }

}

Master.prototype.delete_master = function(master) {
  if (this.old_master == master) {
    this.old_master = null;
  } else if (this.new_master == master) {
    this.new_master = null;
  } else if (this.current_master == master) {
    this.current_master = null;
  }
}

Master.prototype.exit = function(code) {
  this.log.stream.once('close', function() {
    process.exit(code);
  });

  this.log.stream.destroySoon();
}

Master.prototype.process_master_stopped = function(master) {

  this.log.info("[Master] Process master (%s) stopped", master.id);

  if (this.state == "starting") {
    if (master == this.new_master) {
      this.log.info("[Master] Process master (%s) could not be started. Giving up.", master.id);
      this.exit(1);
    }
  } else if (this.state == "new_master") {
    if (master == this.new_master) {
      this.log.info("[Master] Process master (%s) could not be started. Cancelling restart", master.id);
      this.new_master = null;
      this.state = "started";
    }
  } else if (this.state == "reap_master") {
    if (master == this.old_master) {
      this.log.info("[Master] Old master has shutdown (%s). Restart complete", master.id);
      this.state = "started";
      this.old_master = null;
    }
  } else if (this.state == "stopping") {
    this.delete_master(master);
    if (this.old_master == null && this.new_master == null && this.current_master == null) {
      this.log.info("[Master] All masters have been stopped. Goodbye.");
      this.exit(0);
    }
  }
}

Master.prototype.graceful_restart = function() {
  if (this.state != "started") {
    this.log.info("[Master] Ignoring restart signal sent when not in started state. Current state is: %s", this.state);
    return;
  }

  this.state = "new_master";

  this.new_master = this.start_master();

}

Master.prototype.start_master = function() {
  var master = new ProcessMaster(this.next_process_master_id++, this.module, this.options, this.log);
  master.on("started", this.process_master_started.bind(this));
  master.on("stopped", this.process_master_stopped.bind(this));
  return master;
}

Master.prototype.graceful_shutdown = function() {
  if (this.state != "stopping" && this.state != "stopped") {
    this.log.info("[Master] Shutting down");
  
    this.state = "stopping";
    this.each_master(function(master) {
      master.stop();
    });
  } else {
    this.log.info("[Master] Ignoring shutdown signal. Current state is: %s", this.state);
  }
}


Master.prototype.each_master = function(cb) {
  if (this.current_master != null) { 
    cb(this.current_master);
  }
  if (this.old_master != null) {
    cb(this.old_master);
  }
  if (this.new_master != null) {
    cb(this.new_master);
  }
}

Master.prototype.set_log = function(log) {
  this.log= log;
  this.each_master(function(master) {
    master.set_log(log);
  });
}

Master.prototype.reopen_master_log_file = function() {
  this.log.info("[Master] Opening New Master Log File");
  var stream = fs.createWriteStream(this.options.log_dir + "/master.log", {flags: "a"});
  var error_open_handler = function() {
      this.log.error("[Master] Could not open new master log file");
      this.log_lock--;
  }.bind(this);
  stream.addListener("error", error_open_handler);
  stream.addListener("open", function() {
    /* swap logs */
    this.log.stream.destroySoon();
    this.set_log(new Log("info", stream));
    this.log.info("[Master] New Master Log File Opened");
    this.log_lock--;
    stream.removeListener(error_open_handler);
  }.bind(this));
  this.log_lock++;
}

Master.prototype.reopen_logs = function() {
  if (this.log_lock == 0) {
    this.log.info("[Master] Ignoring log reopen. Already reopening logs");
    return;
  }

  this.reopen_master_log_file();

}
