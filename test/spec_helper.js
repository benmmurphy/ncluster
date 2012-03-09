var http = require('http');
var child_process = require('child_process');

require('should');

module.exports.get = function (options, cb) {
  http.get(options, function(res) {
    eat_response(res, cb);
  }).on("error", function(e) {
    console.log("an error occured", e);
    cb(null, false, null);
  });
}

module.exports.eat_socket = function(socket, cb) {
  var buf = "";
  socket.on("data", function(data) {
    buf += data.toString();
  });

  socket.on("end", function() {
    cb(null, buf);
  });
}

module.exports.eat_request = function(req, cb) {
  req.on("response", function(res) {
    eat_response(res, cb);
  });
}

module.exports.tail_log = function(name) {
  name = name || "test_server";
  return child_process.spawn("tail", ['-n', '0', '-F', __dirname + "/../" + name + "/log/master.log"]);
}

module.exports.log_dir = function() {
  return __dirname + "/../test_server/log";
}

module.exports.spawn_cluster = function(options, name) {
  options = options || {workers : 1};
  name = name || "test_server";

  var child = child_process.spawn("node", [__dirname + "/../" + name + "/app.js", JSON.stringify(options)]);
  child.stdout.on("data", function(data) {
    console.log("CLUSTER: ", data.toString());
  });
  return child;
}

module.exports.after_connect = function (req, cb) {

  req.on("socket", function(sock) {
    sock.on("connect", function() {
     cb();
    });
  });
}

module.exports.eat_response = eat_response = function(res, cb) {
  var str = ""
  res.on('data', function(data) {
    str += data.toString();
  });
  
  res.on('end', function() {
    cb(null, true, str);
  });

  res.on("error", function(e) {
    console.log("an error occured", e);
    cb(null, false, null);
  });
}

module.exports.open_request = function (options, cb) {
  http.request(options, function(res) {
    cb(null, res);
  }).on('error', function(e) {
    cb(e);
  });
}

module.exports.wait_until_line = wait_until_line = function(log, line, cb) {
  var listener = function(data) {

    if (data.toString().indexOf(line) >= 0) {
      log.stdout.removeListener("data", listener);
      cb(null);
    }
  };

  log.stdout.on("data", listener);
}

module.exports.wait_until_initialized = function(log, cb) {
  wait_until_line(log, "Cluster initialized", cb);
}