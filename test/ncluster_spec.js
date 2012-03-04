var child_process = require('child_process');
var http = require('http');
var async = require('async');
var helper = require('./spec_helper');
var net = require('net');
var fs = require('fs');
var path = require('path');

describe("ncluster", function() {

  var child = null;
  var server = null;

  var spawn_cluster = function() {
    child = helper.spawn_cluster.apply(helper, arguments);
    child.on("exit", function() {
      child = null;
    });
  };

  it("should continue to serve open requests when shutting down", function(done) {
    var tail = helper.tail_log();

    spawn_cluster();

    var request = null;

    async.waterfall([
      function(cb) {
        helper.wait_until_initialized(tail, cb);
      },

      function(cb) {
        request =  http.request({method: 'POST', host: 'localhost', port: 3000, path: '/', agent: false});
        helper.after_connect(request, cb);
      },

      function(cb) {
        child.kill("SIGQUIT");
        helper.wait_until_line(tail, "SIGQUIT", cb);
      },

      function(cb) {
        helper.get({host: 'localhost', port: 3000}, cb);
      },

      function(ok, data, cb) {
        ok.should.equal(false);
        request.end();
        helper.eat_request(request, cb);
      },

      function(ok, data, cb) {
        ok.should.equal(true);
        data.should.equal("Hello From Worker");
        child.on("exit", function() {done(); });
      }

    ]);

    
  });

  it("should reopen log files when receiving SIGUSR2", function(done) {
    var tail = helper.tail_log();

    spawn_cluster();

    var request = null;

    async.waterfall([
      function(cb) {
        helper.wait_until_initialized(tail, cb);
      },

      function(cb) {
        fs.renameSync(path.join(helper.log_dir(), "master.log"), path.join(helper.log_dir(), "master.log.2"));
        child.kill("SIGUSR2");
        helper.wait_until_line(tail, "New Master Log File Opened", cb);
      },

      function(cb) {
        helper.get({host: 'localhost', port: 3000}, cb);
      },

      function(ok, data, cb) {
        data.should.equal("Hello From Worker");
        done();
      }

    ]);
  });

  it("should shutdown if it can't bind to the port", function(done) {
    this.timeout(5000);
    
    server = new net.Server();
    server.listen(3000);

    server.on("listening", function() {
        spawn_cluster();
        child.on("exit", function() {
            child = null;
            done();
        });
    });
        
  });

  it("should shutdown if it can't bind to the port and there are multiple workers", function(done) {
    this.timeout(5000);
    
    server = new net.Server();
    server.listen(3000);

    server.on("listening", function() {
        spawn_cluster({workers: 2});
        child.on("exit", function() {
            child = null;
            done();
        });
    });
        
  });

  it("should reload code when receiving the HUP signal", function(done) {
   
     
    try {
      fs.unlinkSync(path.join(__dirname, "..", "current"));
    } catch(e) {
      //ignore
    }
    fs.symlinkSync(path.join(__dirname, "..", "test_server"), path.join(__dirname, "..", "current"), 'dir');
    var tail = helper.tail_log("test_server");
    spawn_cluster({workers: 1}, "current");
    async.waterfall([
      function(cb) {
        helper.wait_until_initialized(tail, cb);
      },

      function(cb) {
        helper.get({host: 'localhost', port: 3000}, cb);
      },

      function(ok, data, cb) {
        data.should.equal("Hello From Worker");
        fs.unlinkSync(path.join(__dirname, "..", "current"));
        fs.symlinkSync(path.join( __dirname, "..", "test_server2"), path.join(__dirname, "..", "current"), 'dir');
        helper.get({host: 'localhost', port: 3000, path: '/dynamic'}, cb);
      },

      function(ok, data, cb) {
        data.should.equal("Dynamic From Worker");
        child.kill("SIGHUP");
        helper.wait_until_line(tail, "Restart complete", cb);
      },

      function(cb) {
        helper.get({host: 'localhost', port: 3000}, cb);
      },

      function(ok, data, cb) {
        data.should.equal("Hello From New Worker");
        done();
      }
    ]);
  });

  it("should restart workers that don't send heartbeat signals", function(done) {
    var tail = helper.tail_log();

    spawn_cluster();

    var request = null;

    async.waterfall([
      function(cb) {
        helper.wait_until_initialized(tail, cb);
      },

      function(cb) {
        helper.get({host: 'localhost', port: 3000, path: '/block_run_loop'}, cb);
      },

      function(ok, data, cb) {
        data.should.equal("BLOCKED");
        helper.wait_until_line(tail, "Starting worker", cb);
      },

      function(cb) {
        helper.get({host: 'localhost', port: 3000}, cb);
      },

      function(ok, data, cb) {
        data.should.equal("Hello From Worker");
        done();
      }
    ]);
  });





  afterEach(function(done) {

    async.waterfall([
      function(cb) {
        if (child == null) {
          cb();
        } else {
          child.kill("SIGKILL");
          child.on("exit", function() {
            cb();
          });
          child = null;
        }
      },

      function(cb) {

        if (server != null) {
          server.close();
          server = null;
        }
        done();
      }
    ]);
  });
});


