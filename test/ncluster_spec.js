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
  var tail = null;

  var wait_for_child = function(done) {
    if (child == null || child.exitCode != null) {
      child = null;
      done();
    } else {
      child.on("exit", function() {
        child = null; 
        done();
      });
    }
  };

  var spawn_cluster = function() {
    child = helper.spawn_cluster.apply(helper, arguments);
    child.on("exit", function() {
      child = null;
    });
  };

  it("should force kill open children when shutting down", function(done) {
    this.timeout(10000);
    tail = helper.tail_log();
    spawn_cluster({kill_wait_timeout: 500});

    var request = null;
    async.waterfall([
      function(cb) {
        helper.wait_until_initialized(tail, cb);
      },

      function(cb) {
        request = http.request({method: 'POST', host: 'localhost', port: 3000, path: '/', agent: false});
        helper.after_connect(request, cb);
      },

      function(cb) {
        request.on("error", function() {console.log("LOLLOLS");});
        child.kill("SIGQUIT");
        helper.wait_until_line(tail, "SIGQUIT", cb);
      },

      function(cb) {
        helper.wait_until_line(tail, "SIGKILL", cb);
      },

      function(cb) {
        request.abort();
        wait_for_child(done);
      }
   ]);

  });
  it("should continue to serve open requests when shutting down", function(done) {
    this.timeout(10000);
    tail = helper.tail_log();

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
        setTimeout(cb, 500); /* we might still be in backlog :( */
      },

      function(cb) {
        child.kill("SIGQUIT");
        helper.wait_until_line(tail, "SIGQUIT", cb);
      },

      function(cb) {
        setTimeout(cb, 500);
      },

      function(cb) {
        helper.get({host: 'localhost', port: 3000, agent: false}, cb);
      },

      function(ok, data, cb) {
        ok.should.equal(false);
        request.end();
        helper.eat_request(request, cb);
      },

      function(ok, data, cb) {
        ok.should.equal(true);
        data.should.equal("Hello From Worker");
        wait_for_child(done);
      }

    ]);

    
  });

  it("should reopen log files when receiving SIGUSR2", function(done) {
    this.timeout(10000);
    tail = helper.tail_log();

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
        helper.get({host: 'localhost', port: 3000, agent: false}, cb);
      },

      function(ok, data, cb) {
        data.should.equal("Hello From Worker");
        done();
      }

    ]);
  });

  it("should shutdown if it can't bind to the port", function(done) {
    this.timeout(10000);
    
    server = new net.Server();
    server.listen(3000);

    server.on("listening", function() {
        spawn_cluster();
        wait_for_child(done);
    });
        
  });

  it("should shutdown if it can't bind to the port and there are multiple workers", function(done) {
    this.timeout(10000);
    
    server = new net.Server();
    server.listen(3000);

    server.on("listening", function() {
        spawn_cluster({workers: 2});
        wait_for_child(done);
    });
        
  });

  it("should reload code when receiving the HUP signal", function(done) {
    this.timeout(10000); 
     
    try {
      fs.unlinkSync(path.join(__dirname, "..", "current"));
    } catch(e) {
      //ignore
    }
    fs.symlinkSync(path.join(__dirname, "..", "test_server"), path.join(__dirname, "..", "current"), 'dir');
    tail = helper.tail_log("test_server");
    spawn_cluster({workers: 1}, "current");
    async.waterfall([
      function(cb) {
        helper.wait_until_initialized(tail, cb);
      },

      function(cb) {
        helper.get({host: 'localhost', port: 3000, agent: false}, cb);
      },

      function(ok, data, cb) {
        data.should.equal("Hello From Worker");
        fs.unlinkSync(path.join(__dirname, "..", "current"));
        fs.symlinkSync(path.join( __dirname, "..", "test_server2"), path.join(__dirname, "..", "current"), 'dir');
        helper.get({host: 'localhost', port: 3000, path: '/dynamic', agent: false}, cb);
      },

      function(ok, data, cb) {
        data.should.equal("Dynamic From Worker");
        child.kill("SIGHUP");
        helper.wait_until_line(tail, "Restart complete", cb);
      },

      function(cb) {
        helper.get({host: 'localhost', port: 3000, agent: false}, cb);
      },

      function(ok, data, cb) {
        ok.should.equal(true);
        data.should.equal("Hello From New Worker");
        done();
      }
    ]);
  });

  it("should close keep alive connections when shutting down", function(done) {
    this.timeout(10000);
    tail = helper.tail_log();

    spawn_cluster();
    var socket = null;

    async.waterfall([

      function(cb) {
        helper.wait_until_initialized(tail, cb);
      },

      function(cb) {
        socket = net.connect(3000, 'localhost', cb);
      },

      function(cb) {
        setTimeout(cb, 500); /* we still might be in kernel backlog */
      },

      function(cb) {
        child.kill("SIGQUIT");
        helper.wait_until_line(tail, "SIGQUIT", cb);
      },

      function(cb) {
        setTimeout(cb, 1000);
      },

      function(cb) {
        socket.write("GET / HTTP/1.1\r\nHost:localhost\r\n\r\n");
        helper.eat_socket(socket, cb);
      },

      function(data, cb) {
        data.should.match(/Hello From Worker/);
        data.should.match(/Connection: close/);
        helper.get({host: 'localhost', port: 3000, agent: false}, cb);
      },

      function(ok, data, cb) {
        ok.should.equal(false);
        wait_for_child(done);
      }
    ]);

  });

  it("should restart workers that don't send heartbeat signals", function(done) {
    this.timeout(10000);
    tail = helper.tail_log();

    spawn_cluster({heartbeat_timeout: 1000, heartbeat_interval: 100});

    var request = null;

    async.waterfall([
      function(cb) {
        helper.wait_until_initialized(tail, cb);
      },

      function(cb) {
        helper.get({host: 'localhost', port: 3000, path: '/block_run_loop', agent: false}, cb);
      },

      function(ok, data, cb) {
        ok.should.equal(true);
        data.should.equal("BLOCKED");
        helper.wait_until_line(tail, "Starting worker", cb);
      },

      function(cb) {
        helper.get({host: 'localhost', port: 3000, agent: false}, cb);
      },

      function(ok, data, cb) {
        data.should.equal("Hello From Worker");
        done();
      }
    ]);
  });





  afterEach(function(done) {
    if (child == null || child.exitCode != null) {
      child = null;
      done();
    } else {
      child.kill("SIGQUIT");
      wait_for_child(done);
    }
  });

  afterEach(function() {
    if (tail != null) {
      tail.kill("SIGKILL");
      tail = null;
    }
  });

  afterEach(function(done) {

    if (server != null) {
      server.close();
      server = null;
    }
    done();
  });
});


