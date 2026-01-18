// utils/api.js
var config = require('../config');

// 서버에서 받은 설정 저장 (serverUrl, botToken)
var serverConfig = null;

function setServerConfig(conf) {
  serverConfig = conf;
}

function makeRequest(method, path, body) {
  try {
    // serverConfig가 있으면 우선 사용, 없으면 fallback (최초 연결용)
    var baseUrl = (serverConfig && serverConfig.serverUrl) || 'https://myteamdashboard.onrender.com';
    var token = (serverConfig && serverConfig.botToken) || '';
    
    var url = baseUrl + path;
    var response;
    
    if (method === 'GET') {
      response = org.jsoup.Jsoup.connect(url)
        .header('X-BOT-TOKEN', token)
        .ignoreContentType(true)
        .timeout(config.REQUEST_TIMEOUT_MS)
        .get();
    } else {
      response = org.jsoup.Jsoup.connect(url)
        .header('X-BOT-TOKEN', token)
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
  var result = makeRequest('GET', '/api/bot/config');
  if (result) {
    // 서버에서 받은 설정 저장
    setServerConfig({
      serverUrl: result.serverUrl,
      botToken: result.botToken
    });
  }
  return result;
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
