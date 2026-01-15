// handlers/commandHandler.js
var config = require('../config');

// 명령어 목록
var COMMANDS = {
  '리스크': 'risk',
  '제휴': 'partnership', 
  '기술': 'tech',
  '일정': 'schedule',
  '뉴스': 'news',
  '도움말': 'help',
  '헬프': 'help'
};

function handleCommand(room, msg, sender, replier) {
  try {
    var command = msg.trim();
    
    // 명령어 확인
    if (!COMMANDS[command]) {
      return; // 알 수 없는 명령어는 무시
    }
    
    // 백엔드 API 호출
    var response = callBackendAPI(room, msg, sender);
    
    if (response && response.message) {
      replier.reply(response.message);
    } else if (response && response.error) {
      replier.reply('오류: ' + response.error);
    } else {
      replier.reply('응답을 받지 못했습니다.');
    }
    
  } catch (e) {
    Log.e('명령어 처리 오류: ' + e);
    replier.reply('명령어 처리 중 오류가 발생했습니다.');
  }
}

function callBackendAPI(room, msg, sender) {
  try {
    var url = config.SERVER_URL + '/kakao/message';
    var requestBody = JSON.stringify({
      room: room,
      message: msg,
      sender: sender
    });
    
    var response = org.jsoup.Jsoup.connect(url)
      .header('Content-Type', 'application/json')
      .requestBody(requestBody)
      .ignoreContentType(true)
      .timeout(config.REQUEST_TIMEOUT_MS)
      .method(org.jsoup.Connection.Method.POST)
      .execute();
    
    var text = response.body();
    return JSON.parse(text);
    
  } catch (e) {
    Log.e('백엔드 API 호출 실패: ' + e);
    return { error: '서버 연결 실패' };
  }
}

module.exports = { handleCommand: handleCommand };
