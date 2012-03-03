var child_process = require('child_process');
var http = require('http');
var async = require('async');
require('should');

describe("ncluster", function() {

  var child = null;

  it("should continue to serve open requests when shutting down", function(done) {
    var tail = child_process.spawn("tail", ['-n', '0', '-f', __dirname + "/../test_server/log/master.log"]);

    child = child_process.spawn("node", [__dirname + "/../test_server/app.js"]);

    var request = null;

    async.waterfall([
      function(cb) {
        wait_until_initialized(tail, cb);
      },

      function(cb) {
        request =  http.request({method: 'POST', host: 'localhost', port: 3000, path: '/', agent: false});
        after_connect(request, cb);
      },

      function(cb) {
        child.kill("SIGQUIT");
        wait_until_line(tail, "SIGQUIT", cb);
      },

      function(cb) {
        setTimeout(cb, 200);
      },

      function(cb) {
        request.end();
        eat_request(request, cb);
      },

      function(ok, data, cb) {
        ok.should.equal(true);
        data.should.equal("Hello From Worker");
        child.on("exit", function() {done(); });
      }

    ]);

    
  });

  afterEach(function() {
    if (child != null) {
      child.kill("SIGKILL");
    }
  });
});


function get(options, cb) {
  http.get(options, function(res) {
    eat_response(res, cb);
  }).on("error", function(e) {
    console.log("an error occured", e);
    cb(null, false);
  });
}

function eat_request(req, cb) {
  req.on("response", function(res) {
    eat_response(res, cb);
  });
}

function after_connect(req, cb) {

  req.on("socket", function(sock) {
    sock.on("connect", function() {
     cb();
    });
  });
}

function eat_response(res, cb) {
  var str = ""
  res.on('data', function(data) {
    str += data.toString();
  });
  
  res.on('end', function() {
    cb(null, true, str);
  });

  res.on("error", function(e) {
    console.log("an error occured", e);
    cb(null, false);
  });
}

function open_request(options, cb) {
  http.request(options, function(res) {
    cb(null, res);
  }).on('error', function(e) {
    cb(e);
  });
}

function wait_until_line(log, line, cb) {
  var listener = function(data) {

    if (data.toString().indexOf(line) >= 0) {
      log.stdout.removeListener("data", listener);
      cb(null);
    }
  };

  log.stdout.on("data", listener);
}

function wait_until_initialized(log, cb) {
  wait_until_line(log, "Cluster initialized", cb);
}


