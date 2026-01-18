// ========================================
// AVD 카카오톡 봇 (메신저봇R 단일 파일 버전)
// ========================================

// ========================================
// 1. 설정
// ========================================
var CONFIG = {
  // ========================================
  // ⚠️ 중요: 아래 두 값을 실행 전에 반드시 입력하세요!
  // ========================================
  
  // 초기 연결용 서버 URL (백엔드 서버 주소)
  // 예: 'https://myteamdashboard.onrender.com'
  INITIAL_SERVER_URL: '',  // ← 여기에 서버 주소 입력
  
  // 초기 연결용 봇 토큰 (백엔드 .env의 BOT_API_TOKEN과 동일한 값)
  // 백엔드 서버 관리자에게 문의하여 토큰 값을 받아서 입력하세요
  INITIAL_BOT_TOKEN: '',  // ← 여기에 토큰 입력
  
  // ========================================
  
  // 디바이스 ID (다중 봇 운영 시 구분용)
  DEVICE_ID: 'avd-bot-1',
  
  // Outbox 폴링 간격 (밀리초)
  POLL_INTERVAL_MS: 15000, // 15초
  
  // 한 번에 가져올 메시지 수
  PULL_LIMIT: 20,
  
  // 카톡 메시지 길이 제한
  MAX_MESSAGE_LENGTH: 3000,
  
  // HTTP 요청 타임아웃
  REQUEST_TIMEOUT_MS: 10000 // 10초
};

// ========================================
// 2. 전역 변수
// ========================================
var botConfig = null;
var serverConfig = null;
var pollingTimer = null;

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

// ========================================
// 3. Logger 유틸리티
// ========================================
function logInfo(message) {
  var timestamp = new Date().toISOString();
  Log.i('[' + timestamp + '] [INFO] ' + message);
}

function logError(message) {
  var timestamp = new Date().toISOString();
  Log.e('[' + timestamp + '] [ERROR] ' + message);
}

// ========================================
// 4. Message Formatter 유틸리티
// ========================================
function splitMessage(message, maxLength) {
  if (message.length <= maxLength) {
    return [message];
  }
  
  var chunks = [];
  var remaining = message;
  
  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }
    
    // 줄바꿈 기준으로 분할 시도
    var cutIndex = remaining.lastIndexOf('\n', maxLength);
    if (cutIndex === -1 || cutIndex < maxLength / 2) {
      // 줄바꿈이 없으면 공백 기준
      cutIndex = remaining.lastIndexOf(' ', maxLength);
      if (cutIndex === -1 || cutIndex < maxLength / 2) {
        // 공백도 없으면 강제 분할
        cutIndex = maxLength;
      }
    }
    
    chunks.push(remaining.substring(0, cutIndex));
    remaining = remaining.substring(cutIndex).trim();
  }
  
  return chunks;
}

// ========================================
// 5. API 유틸리티
// ========================================
function setServerConfig(conf) {
  serverConfig = conf;
}

function makeRequest(method, path, body) {
  try {
    // serverConfig가 있으면 우선 사용, 없으면 CONFIG의 초기값 사용
    var baseUrl = (serverConfig && serverConfig.serverUrl) || CONFIG.INITIAL_SERVER_URL;
    var token = (serverConfig && serverConfig.botToken) || CONFIG.INITIAL_BOT_TOKEN;
    
    // 초기값이 비어있으면 에러
    if (!baseUrl || !token) {
      Log.e('========================================');
      Log.e('초기 설정 오류: INITIAL_SERVER_URL 또는 INITIAL_BOT_TOKEN이 설정되지 않았습니다.');
      Log.e('bot.js 파일의 CONFIG 객체에서 위 두 값을 확인하고 입력하세요.');
      Log.e('========================================');
      logError('초기 설정 오류: INITIAL_SERVER_URL 또는 INITIAL_BOT_TOKEN이 설정되지 않았습니다.');
      return null;
    }
    
    var url = baseUrl + path;
    var response;
    
    if (method === 'GET') {
      response = org.jsoup.Jsoup.connect(url)
        .header('X-BOT-TOKEN', token)
        .ignoreContentType(true)
        .timeout(CONFIG.REQUEST_TIMEOUT_MS)
        .get();
    } else {
      response = org.jsoup.Jsoup.connect(url)
        .header('X-BOT-TOKEN', token)
        .header('Content-Type', 'application/json')
        .requestBody(JSON.stringify(body))
        .ignoreContentType(true)
        .timeout(CONFIG.REQUEST_TIMEOUT_MS)
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

function updateConfig(config) {
  var result = makeRequest('POST', '/api/bot/config', {
    admins: config.admins,
    rooms: config.rooms
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

// ========================================
// 6. Command Handler
// ========================================
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
    var baseUrl = (serverConfig && serverConfig.serverUrl) || 'https://myteamdashboard.onrender.com';
    var url = baseUrl + '/kakao/message';
    var requestBody = JSON.stringify({
      room: room,
      message: msg,
      sender: sender
    });
    
    var response = org.jsoup.Jsoup.connect(url)
      .header('Content-Type', 'application/json')
      .requestBody(requestBody)
      .ignoreContentType(true)
      .timeout(CONFIG.REQUEST_TIMEOUT_MS)
      .method(org.jsoup.Connection.Method.POST)
      .execute();
    
    var text = response.body();
    return JSON.parse(text);
    
  } catch (e) {
    Log.e('백엔드 API 호출 실패: ' + e);
    return { error: '서버 연결 실패' };
  }
}

// ========================================
// 7. Admin Handler
// ========================================
function handleAdminCommand(room, msg, sender, replier, config) {
  var parts = msg.trim().split(/\s+/);
  var cmd = parts[0];
  var arg1 = parts[1];
  var arg2 = parts[2];
  
  try {
    switch (cmd) {
      case '!방추가':
        if (!arg1) {
          replier.reply('사용법: !방추가 <방이름>');
          return;
        }
        addRoom(arg1, config, replier);
        break;
        
      case '!방삭제':
        if (!arg1) {
          replier.reply('사용법: !방삭제 <방이름>');
          return;
        }
        removeRoom(arg1, config, replier);
        break;
        
      case '!방':
        if (arg1 === 'on' && arg2) {
          toggleRoom(arg2, true, config, replier);
        } else if (arg1 === 'off' && arg2) {
          toggleRoom(arg2, false, config, replier);
        } else {
          replier.reply('사용법: !방 on/off <방이름>');
        }
        break;
        
      case '!일정알림':
        if (arg1 === 'on' && arg2) {
          toggleScheduleNotify(arg2, true, config, replier);
        } else if (arg1 === 'off' && arg2) {
          toggleScheduleNotify(arg2, false, config, replier);
        } else {
          replier.reply('사용법: !일정알림 on/off <방이름>');
        }
        break;
        
      case '!명령':
        if (arg1 === 'on' && arg2) {
          toggleCommands(arg2, true, config, replier);
        } else if (arg1 === 'off' && arg2) {
          toggleCommands(arg2, false, config, replier);
        } else {
          replier.reply('사용법: !명령 on/off <방이름>');
        }
        break;
        
      case '!방목록':
        listRooms(config, replier);
        break;
        
      case '!상태':
        showStatus(config, replier);
        break;
        
      default:
        replier.reply('알 수 없는 명령어: ' + cmd + '\n\n사용 가능한 명령어:\n!방추가, !방삭제, !방, !일정알림, !명령, !방목록, !상태');
    }
  } catch (e) {
    replier.reply('오류 발생: ' + e);
    Log.e('관리자 명령 오류: ' + e);
  }
}

function addRoom(roomName, config, replier) {
  // 이미 존재하는지 확인
  for (var i = 0; i < config.rooms.length; i++) {
    if (config.rooms[i].roomName === roomName) {
      replier.reply('이미 존재하는 방입니다: ' + roomName);
      return;
    }
  }
  
  config.rooms.push({
    roomName: roomName,
    enabled: true,
    scheduleNotify: true,
    commandsEnabled: true
  });
  
  var success = updateConfig(config);
  if (success) {
    replier.reply('방 추가 완료: ' + roomName);
  } else {
    replier.reply('방 추가 실패 (서버 오류)');
  }
}

function removeRoom(roomName, config, replier) {
  var found = false;
  var newRooms = [];
  
  for (var i = 0; i < config.rooms.length; i++) {
    if (config.rooms[i].roomName === roomName) {
      found = true;
    } else {
      newRooms.push(config.rooms[i]);
    }
  }
  
  if (!found) {
    replier.reply('방을 찾을 수 없습니다: ' + roomName);
    return;
  }
  
  config.rooms = newRooms;
  
  var success = updateConfig(config);
  if (success) {
    replier.reply('방 삭제 완료: ' + roomName);
  } else {
    replier.reply('방 삭제 실패 (서버 오류)');
  }
}

function toggleRoom(roomName, enabled, config, replier) {
  var room = null;
  for (var i = 0; i < config.rooms.length; i++) {
    if (config.rooms[i].roomName === roomName) {
      room = config.rooms[i];
      break;
    }
  }
  
  if (!room) {
    replier.reply('방을 찾을 수 없습니다: ' + roomName);
    return;
  }
  
  room.enabled = enabled;
  
  var success = updateConfig(config);
  if (success) {
    replier.reply(roomName + ' 방 ' + (enabled ? '활성화' : '비활성화') + ' 완료');
  } else {
    replier.reply('설정 변경 실패 (서버 오류)');
  }
}

function toggleScheduleNotify(roomName, enabled, config, replier) {
  var room = null;
  for (var i = 0; i < config.rooms.length; i++) {
    if (config.rooms[i].roomName === roomName) {
      room = config.rooms[i];
      break;
    }
  }
  
  if (!room) {
    replier.reply('방을 찾을 수 없습니다: ' + roomName);
    return;
  }
  
  room.scheduleNotify = enabled;
  
  var success = updateConfig(config);
  if (success) {
    replier.reply(roomName + ' 방 일정알림 ' + (enabled ? 'ON' : 'OFF') + ' 완료');
  } else {
    replier.reply('설정 변경 실패 (서버 오류)');
  }
}

function toggleCommands(roomName, enabled, config, replier) {
  var room = null;
  for (var i = 0; i < config.rooms.length; i++) {
    if (config.rooms[i].roomName === roomName) {
      room = config.rooms[i];
      break;
    }
  }
  
  if (!room) {
    replier.reply('방을 찾을 수 없습니다: ' + roomName);
    return;
  }
  
  room.commandsEnabled = enabled;
  
  var success = updateConfig(config);
  if (success) {
    replier.reply(roomName + ' 방 명령응답 ' + (enabled ? 'ON' : 'OFF') + ' 완료');
  } else {
    replier.reply('설정 변경 실패 (서버 오류)');
  }
}

function listRooms(config, replier) {
  if (config.rooms.length === 0) {
    replier.reply('등록된 방이 없습니다.');
    return;
  }
  
  var msg = '=== 방 목록 ===\n\n';
  for (var i = 0; i < config.rooms.length; i++) {
    var r = config.rooms[i];
    msg += (i + 1) + '. ' + r.roomName + '\n';
    msg += '   상태: ' + (r.enabled ? '활성' : '비활성') + '\n';
    msg += '   일정알림: ' + (r.scheduleNotify ? 'ON' : 'OFF') + '\n';
    msg += '   명령응답: ' + (r.commandsEnabled ? 'ON' : 'OFF') + '\n\n';
  }
  
  replier.reply(msg);
}

function showStatus(config, replier) {
  var enabledRooms = 0;
  for (var i = 0; i < config.rooms.length; i++) {
    if (config.rooms[i].enabled) {
      enabledRooms++;
    }
  }
  
  var serverUrl = (serverConfig && serverConfig.serverUrl) || '서버 설정 없음';
  var msg = '=== 봇 상태 ===\n\n' +
            '디바이스: ' + CONFIG.DEVICE_ID + '\n' +
            '서버: ' + serverUrl + '\n' +
            '폴링 간격: ' + (CONFIG.POLL_INTERVAL_MS / 1000) + '초\n' +
            '활성 방: ' + enabledRooms + '/' + config.rooms.length + '\n' +
            '관리자: ' + config.admins.join(', ');
  
  replier.reply(msg);
}

// ========================================
// 8. Outbox Handler
// ========================================
function startOutboxPolling(config) {
  if (pollingTimer) {
    clearInterval(pollingTimer);
  }
  
  pollingTimer = setInterval(function() {
    processOutbox(config);
  }, CONFIG.POLL_INTERVAL_MS);
  
  // 즉시 첫 실행
  processOutbox(config);
  
  Log.i('Outbox 폴링 시작 (간격: ' + (CONFIG.POLL_INTERVAL_MS / 1000) + '초)');
}

function processOutbox(config) {
  try {
    // 1. 메시지 Pull
    var response = pullMessages(CONFIG.DEVICE_ID, CONFIG.PULL_LIMIT);
    
    if (!response || !response.items || response.items.length === 0) {
      return;
    }
    
    Log.i('메시지 ' + response.items.length + '개 수신');
    
    var results = [];
    
    // 2. 각 메시지 처리
    for (var i = 0; i < response.items.length; i++) {
      var item = response.items[i];
      
      try {
        // 방 설정 확인
        var roomConfig = null;
        for (var j = 0; j < config.rooms.length; j++) {
          if (config.rooms[j].roomName === item.targetRoom) {
            roomConfig = config.rooms[j];
            break;
          }
        }
        
        if (!roomConfig || !roomConfig.enabled) {
          results.push({
            id: item.id,
            status: 'failed',
            error: 'room disabled'
          });
          continue;
        }
        
        // 메시지 분할 (3000자 초과 시)
        var messages = splitMessage(item.message, CONFIG.MAX_MESSAGE_LENGTH);
        
        // 메시지 전송
        var success = true;
        for (var k = 0; k < messages.length; k++) {
          var sent = Api.replyRoom(item.targetRoom, messages[k]);
          if (!sent) {
            success = false;
            break;
          }
          
          // 분할 메시지 사이 딜레이
          if (k < messages.length - 1) {
            java.lang.Thread.sleep(500);
          }
        }
        
        if (success) {
          results.push({
            id: item.id,
            status: 'sent'
          });
          Log.i('전송 성공: ' + item.targetRoom);
        } else {
          results.push({
            id: item.id,
            status: 'failed',
            error: 'send failed'
          });
          Log.e('전송 실패: ' + item.targetRoom);
        }
        
      } catch (e) {
        results.push({
          id: item.id,
          status: 'failed',
          error: String(e)
        });
        Log.e('메시지 처리 오류: ' + e);
      }
    }
    
    // 3. ACK 전송
    sendAck(CONFIG.DEVICE_ID, results);
    
  } catch (e) {
    Log.e('Outbox 처리 오류: ' + e);
  }
}

// ========================================
// 9. 메인 봇 함수
// ========================================

// 봇 시작 시 초기화
function onStartCompile() {
  try {
    logInfo('=== 카카오봇 초기화 시작 ===');
    
    // 서버에서 설정 로드
    botConfig = loadConfig();
    
    if (botConfig) {
      logInfo('카카오봇 초기화 완료');
      logInfo('관리자: ' + botConfig.admins.join(', '));
      
      var enabledRooms = 0;
      for (var i = 0; i < botConfig.rooms.length; i++) {
        if (botConfig.rooms[i].enabled) {
          enabledRooms++;
        }
      }
      logInfo('활성 방: ' + enabledRooms + '/' + botConfig.rooms.length);
      
      // Outbox 폴링 시작
      startOutboxPolling(botConfig);
      
    } else {
      logError('설정 로드 실패 - 서버 연결을 확인하세요');
    }
  } catch (e) {
    logError('초기화 오류: ' + e);
  }
}

// 메시지 수신 시
function response(room, msg, sender, isGroupChat, replier, imageDB, packageName) {
  try {
    // 설정이 로드되지 않았으면 무시
    if (!botConfig) {
      return;
    }
    
    // 관리자 명령어 처리 (! 로 시작)
    if (msg.startsWith('!')) {
      // 관리자 확인
      var isAdmin = false;
      for (var j = 0; j < botConfig.admins.length; j++) {
        if (botConfig.admins[j] === sender) {
          isAdmin = true;
          break;
        }
      }
      
      if (isAdmin) {
        handleAdminCommand(room, msg, sender, replier, botConfig);
      } else {
        replier.reply('관리자 전용 명령어입니다.');
      }
      return;
    }
    
    // 방 설정 확인
    var roomConfig = null;
    for (var i = 0; i < botConfig.rooms.length; i++) {
      if (botConfig.rooms[i].roomName === room) {
        roomConfig = botConfig.rooms[i];
        break;
      }
    }
    
    if (!roomConfig || !roomConfig.enabled || !roomConfig.commandsEnabled) {
      return;
    }
    
    // 일반 명령어 처리
    handleCommand(room, msg, sender, replier);
    
  } catch (e) {
    logError('메시지 처리 오류: ' + e);
  }
}

// 주기적 설정 동기화 (1시간마다)
setInterval(function() {
  try {
    var newConfig = loadConfig();
    if (newConfig) {
      botConfig = newConfig;
      logInfo('설정 동기화 완료');
    }
  } catch (e) {
    logError('설정 동기화 오류: ' + e);
  }
}, 60 * 60 * 1000);
