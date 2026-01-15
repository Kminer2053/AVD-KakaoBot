// utils/logger.js

function log(level, message) {
  var timestamp = new Date().toISOString();
  var prefix = '[' + timestamp + '] [' + level + '] ';
  Log.i(prefix + message);
}

function info(message) {
  log('INFO', message);
}

function error(message) {
  log('ERROR', message);
  Log.e(message);
}

module.exports = {
  info: info,
  error: error
};
