// utils/api.js
var config = require('../config');

function makeRequest(method, path, body) {
  try {
    var url = config.SERVER_URL + path;
    var response;
    
    if (method === 'GET') {
      response = org.jsoup.Jsoup.connect(url)
        .header('X-BOT-TOKEN', config.BOT_TOKEN)
        .ignoreContentType(true)
        .timeout(config.REQUEST_TIMEOUT_MS)
        .get();
    } else {
      response = org.jsoup.Jsoup.connect(url)
        .header('X-BOT-TOKEN', config.BOT_TOKEN)
        .header('Content-Type', 'application/json')
        .requestBody(JSON.stringify(body))
        .ignoreContentType(true)
        .timeout(config.REQUEST_TIMEOUT_MS)
        .method(org.jsoup.Connection.Method.POST)
        .execute();
    }
    
    var text = response.body();
    return JSON.parse(text);
    
  } catch (e) {
    Log.e('API 요청 실패 (' + path + '): ' + e);
    return null;
  }
}

function loadConfig() {
  return makeRequest('GET', '/api/bot/config');
}

function updateConfig(botConfig) {
  var result = makeRequest('POST', '/api/bot/config', {
    admins: botConfig.admins,
    rooms: botConfig.rooms
  });
  return result && result.success;
}

function pullMessages(deviceId, limit) {
  return makeRequest('POST', '/api/bot/outbox/pull', {
    deviceId: deviceId,
    limit: limit
  });
}

function sendAck(deviceId, results) {
  return makeRequest('POST', '/api/bot/outbox/ack', {
    deviceId: deviceId,
    results: results
  });
}

module.exports = {
  loadConfig: loadConfig,
  updateConfig: updateConfig,
  pullMessages: pullMessages,
  sendAck: sendAck
};
