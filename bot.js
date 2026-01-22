// ========================================
// AVD 카카오톡 봇 (메신저봇R 단일 파일 버전)
// ========================================

// 스크립트 로드 확인 로그
try {
  Log.i('========================================');
  Log.i('[스크립트 로드] bot.js 파일이 로드되었습니다');
  Log.i('[스크립트 로드] 모든 변수/함수 정의 후 onStartCompile() 호출 예정');
  Log.i('========================================');
} catch(e) {
  // Log 객체가 아직 없을 수 있음
}

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

// 명령어 목록 (/ prefix로 일반 대화와 구분)
var COMMANDS = {
  '/리스크': 'risk',
  '/제휴': 'partnership',
  '/기술': 'tech',
  '/일정': 'schedule',
  '/뉴스': 'news',
  '/도움말': 'help',
  '/헬프': 'help',
  '/help': 'help'
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
    
    // 디버깅: 요청 정보 로그
    Log.i('API 요청 시도: ' + method + ' ' + url);
    Log.i('토큰 길이: ' + token.length);
    
    var response;
    
    try {
      if (method === 'GET') {
        response = org.jsoup.Jsoup.connect(url)
          .header('X-BOT-TOKEN', token)
          .ignoreContentType(true)
          .timeout(CONFIG.REQUEST_TIMEOUT_MS)
          .method(org.jsoup.Connection.Method.GET)
          .execute();
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
    } catch (httpError) {
      // HTTP 에러 상세 처리
      var errorMsg = String(httpError);
      var errorClassName = '';
      
      // 에러 클래스 이름 확인
      try {
        if (httpError.getClass && httpError.getClass().getName) {
          errorClassName = httpError.getClass().getName();
        }
      } catch (e) {
        // 무시
      }
      
      Log.e('========================================');
      Log.e('HTTP 연결 실패: ' + errorMsg);
      Log.e('에러 타입: ' + errorClassName);
      
      // HttpStatusException인 경우 상태 코드 확인
      if (errorClassName && errorClassName.indexOf('HttpStatusException') !== -1) {
        try {
          var statusCode = -1;
          if (httpError.getStatusCode) {
            statusCode = httpError.getStatusCode();
          } else if (httpError.statusCode) {
            statusCode = httpError.statusCode;
          }
          
          if (statusCode !== -1) {
            Log.e('HTTP 상태 코드: ' + statusCode);
            
            if (statusCode === 401) {
              Log.e('인증 실패: X-BOT-TOKEN이 올바르지 않습니다.');
              Log.e('CONFIG.INITIAL_BOT_TOKEN 값을 확인하세요.');
            } else if (statusCode === 404) {
              Log.e('경로를 찾을 수 없습니다: ' + url);
            } else if (statusCode === 500) {
              Log.e('서버 내부 오류가 발생했습니다.');
            }
          }
        } catch (e) {
          Log.e('상태 코드 확인 실패: ' + e);
        }
      }
      Log.e('========================================');
      
      logError('API 요청 실패 (' + path + '): ' + errorMsg);
      return null;
    }
    
    // HTTP 상태 코드 확인 (정상 응답인 경우)
    var responseStatusCode = -1;
    try {
      if (response.statusCode) {
        responseStatusCode = response.statusCode();
      } else if (response.statusCode) {
        responseStatusCode = response.statusCode;
      }
    } catch (e) {
      // 상태 코드 확인 실패는 무시
    }
    
    // 응답 본문 읽기
    var text = '';
    try {
      if (response.body) {
        text = response.body();
      } else {
        Log.e('응답 본문을 읽을 수 없습니다.');
        return null;
      }
    } catch (e) {
      Log.e('응답 본문 읽기 실패: ' + e);
      return null;
    }
    
    // 상태 코드가 200이 아니면 에러 처리
    if (responseStatusCode !== -1 && responseStatusCode !== 200) {
      Log.e('HTTP 에러 상태 코드: ' + responseStatusCode);
      Log.e('응답 본문 (처음 500자): ' + (text.length > 500 ? text.substring(0, 500) : text));
      
      if (responseStatusCode === 401) {
        Log.e('인증 실패: X-BOT-TOKEN이 올바르지 않습니다.');
        Log.e('CONFIG.INITIAL_BOT_TOKEN 값을 확인하세요.');
      } else if (responseStatusCode === 404) {
        Log.e('경로를 찾을 수 없습니다: ' + url);
      } else if (responseStatusCode === 500) {
        Log.e('서버 내부 오류가 발생했습니다.');
      }
      return null;
    }
    
    // JSON 파싱 시도
    try {
      // 응답이 HTML로 시작하는지 확인
      var trimmedText = text.trim();
      if (trimmedText.startsWith('<')) {
        Log.e('서버가 HTML을 반환했습니다. (상태 코드: ' + responseStatusCode + ')');
        Log.e('응답 본문 (처음 500자): ' + (trimmedText.length > 500 ? trimmedText.substring(0, 500) : trimmedText));
        return null;
      }
      
      return JSON.parse(text);
    } catch (parseError) {
      Log.e('JSON 파싱 실패: ' + parseError);
      Log.e('응답 본문 (처음 500자): ' + (text.length > 500 ? text.substring(0, 500) : text));
      return null;
    }
    
    } catch (e) {
    Log.e('API 요청 중 예외 발생: ' + e);
    Log.e('예외 타입: ' + (typeof e));
    logError('API 요청 실패 (' + path + '): ' + e);
    return null;
  }
}

function loadConfig() {
  Log.i('[loadConfig] 시작');
  Log.i('[loadConfig] INITIAL_SERVER_URL: ' + (CONFIG.INITIAL_SERVER_URL || '비어있음'));
  Log.i('[loadConfig] INITIAL_BOT_TOKEN 길이: ' + (CONFIG.INITIAL_BOT_TOKEN ? CONFIG.INITIAL_BOT_TOKEN.length : 0));
  
  var result = makeRequest('GET', '/api/bot/config');
  
  Log.i('[loadConfig] makeRequest 결과:');
  Log.i('  - result 존재: ' + (result ? 'YES' : 'NO'));
  if (result) {
    Log.i('  - result.serverUrl: ' + (result.serverUrl || '없음'));
    Log.i('  - result.botToken 길이: ' + (result.botToken ? result.botToken.length : 0));
    Log.i('  - result.admins: ' + (result.admins ? result.admins.length + '명' : '없음'));
    Log.i('  - result.rooms: ' + (result.rooms ? result.rooms.length + '개' : '없음'));
    
    // 서버에서 받은 설정 저장
    setServerConfig({
      serverUrl: result.serverUrl,
      botToken: result.botToken
    });
    Log.i('[loadConfig] serverConfig 저장 완료');
  } else {
    Log.e('[loadConfig] makeRequest가 null을 반환했습니다');
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
      // 알 수 없는 /명령어는 도움말 안내
      replier.reply('알 수 없는 명령어입니다: ' + command + '\n\n사용 가능한 명령어: ' + Object.keys(COMMANDS).join(', '));
      return;
    }
    
    Log.i('[봇] 명령어 실행: ' + command);
    
    // 백엔드 API 호출
    var response = callBackendAPI(room, msg, sender);
    
    if (response && response.message) {
      replier.reply(response.message);
    } else if (response && response.error) {
      replier.reply('오류: ' + response.error);
    } else {
      replier.reply('서버 응답을 받지 못했습니다.\n\n서버 상태를 확인하세요.');
    }
    
  } catch (e) {
    Log.e('[봇] 명령어 처리 오류: ' + e);
    replier.reply('명령어 처리 중 오류가 발생했습니다: ' + e);
  }
}

function callBackendAPI(room, msg, sender) {
  try {
    var baseUrl = (serverConfig && serverConfig.serverUrl) || CONFIG.INITIAL_SERVER_URL;
    
    if (!baseUrl) {
      return { error: '서버 URL이 설정되지 않았습니다.' };
    }
    
    var url = baseUrl + '/kakao/message';
    var requestBody = JSON.stringify({
      room: room,
      message: msg,
      sender: sender
    });
    
    Log.i('[봇] API 호출: ' + url);
    
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
    Log.e('[봇] API 호출 실패: ' + e);
    return { error: '서버 연결 실패: ' + e };
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
        
      case '!방이름':
        // 현재 방의 정확한 이름을 로그와 응답으로 출력
        Log.i('========================================');
        Log.i('[방 이름 확인 요청]');
        Log.i('방 이름(room): [' + room + ']');
        Log.i('요청자(sender): [' + sender + ']');
        Log.i('========================================');
        replier.reply('=== 방 정보 ===\n방 이름: [' + room + ']\n요청자: [' + sender + ']\n\n※ 이 방 이름을 사용하여 !방추가 명령어를 실행하세요.');
        break;
        
      default:
        replier.reply('알 수 없는 명령어: ' + cmd + '\n\n사용 가능한 명령어:\n!방추가, !방삭제, !방, !일정알림, !명령, !방목록, !상태, !방이름');
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
        var sendError = null;
        for (var k = 0; k < messages.length; k++) {
          try {
            Log.i('[메시지 전송 시도] 방: ' + item.targetRoom + ', 청크: ' + (k + 1) + '/' + messages.length);
            var sent = Api.replyRoom(item.targetRoom, messages[k]);
            if (!sent) {
              Log.e('[메시지 전송 실패] Api.replyRoom이 false를 반환했습니다. 방: ' + item.targetRoom);
              success = false;
              sendError = 'Api.replyRoom returned false';
              break;
            }
            Log.i('[메시지 전송 성공] 방: ' + item.targetRoom + ', 청크: ' + (k + 1) + '/' + messages.length);
            
            // 분할 메시지 사이 딜레이
            if (k < messages.length - 1) {
              java.lang.Thread.sleep(500);
            }
          } catch (sendEx) {
            Log.e('[메시지 전송 예외] 방: ' + item.targetRoom + ', 에러: ' + sendEx);
            success = false;
            sendError = String(sendEx);
            break;
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
            error: sendError || 'send failed'
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
    Log.i('========================================');
    Log.i('[초기화] onStartCompile 함수 호출됨');
    Log.i('========================================');
    logInfo('=== 카카오봇 초기화 시작 ===');
    
    // 서버에서 설정 로드
    Log.i('[초기화] loadConfig() 호출 시작');
    botConfig = loadConfig();
    Log.i('[초기화] loadConfig() 완료');
    Log.i('[초기화] botConfig 존재: ' + (botConfig ? 'YES' : 'NO'));
    
    if (botConfig) {
      Log.i('[초기화] botConfig 내용 확인:');
      Log.i('  - admins: ' + (botConfig.admins ? botConfig.admins.length + '명' : '없음'));
      Log.i('  - rooms: ' + (botConfig.rooms ? botConfig.rooms.length + '개' : '없음'));
      
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
      Log.i('[초기화] Outbox 폴링 시작');
      startOutboxPolling(botConfig);
      
    } else {
      Log.e('========================================');
      Log.e('[초기화] 설정 로드 실패 - botConfig가 null입니다');
      Log.e('[초기화] 가능한 원인:');
      Log.e('  1. INITIAL_SERVER_URL이 비어있음');
      Log.e('  2. INITIAL_BOT_TOKEN이 비어있음');
      Log.e('  3. 서버 연결 실패');
      Log.e('  4. 인증 실패 (토큰 불일치)');
      Log.e('========================================');
      logError('설정 로드 실패 - 서버 연결을 확인하세요');
    }
  } catch (e) {
    Log.e('[초기화] 예외 발생: ' + e);
    Log.e('[초기화] 예외 타입: ' + (typeof e));
    logError('초기화 오류: ' + e);
  }
}

// 문자열의 각 문자 코드를 출력하는 헬퍼 함수
function getCharCodes(str) {
  var codes = [];
  for (var i = 0; i < str.length; i++) {
    codes.push(str.charCodeAt(i));
  }
  return codes.join(',');
}

// 메시지 수신 시
function response(room, msg, sender, isGroupChat, replier, imageDB, packageName) {
  // 상세 로그: sender 값과 문자 코드까지 출력
  Log.i('[DEBUG] ========== 메시지 수신 ==========');
  Log.i('[DEBUG] 방: [' + room + ']');
  Log.i('[DEBUG] 발신자: [' + sender + ']');
  Log.i('[DEBUG] 발신자 길이: ' + sender.length);
  Log.i('[DEBUG] 발신자 charCodes: ' + getCharCodes(sender));
  Log.i('[DEBUG] 메시지: [' + msg + ']');
  
  try {
    // ========================================
    // 1단계: 서버 연결 없이 동작하는 테스트 명령어 (최우선 처리)
    // ========================================
    if (msg === '테스트' || msg === 'test') {
      // 상세 디버그 정보 포함
      var debugInfo = '봇 응답 테스트 성공!\n\n';
      debugInfo += '방 이름: [' + room + ']\n';
      debugInfo += '발신자: [' + sender + ']\n';
      debugInfo += '발신자 길이: ' + sender.length + '\n';
      debugInfo += '발신자 charCodes: ' + getCharCodes(sender) + '\n';
      debugInfo += 'botConfig: ' + (botConfig ? 'YES' : 'NO') + '\n';
      if (botConfig && botConfig.admins) {
        debugInfo += '\n=== 관리자 목록 ===\n';
        for (var a = 0; a < botConfig.admins.length; a++) {
          var admin = botConfig.admins[a];
          debugInfo += '관리자[' + a + ']: [' + admin + '] (길이:' + admin.length + ', codes:' + getCharCodes(admin) + ')\n';
          debugInfo += '  → sender와 일치: ' + (admin === sender ? 'YES' : 'NO') + '\n';
        }
      }
      replier.reply(debugInfo);
      return;
    }
    
    // 봇 정보 조회 (서버 연결 없이)
    if (msg === '봇정보') {
      var info = '=== 봇 정보 ===\n';
      info += '방 이름: [' + room + ']\n';
      info += '발신자: [' + sender + ']\n';
      info += '발신자 길이: ' + sender.length + '\n';
      info += '발신자 charCodes: ' + getCharCodes(sender) + '\n';
      info += 'botConfig: ' + (botConfig ? 'YES' : 'NO') + '\n';
      if (botConfig) {
        info += '\n=== 관리자 목록 ===\n';
        if (botConfig.admins) {
          for (var a = 0; a < botConfig.admins.length; a++) {
            var admin = botConfig.admins[a];
            info += '[' + a + ']: [' + admin + '] (길이:' + admin.length + ')\n';
            info += '  → sender 일치: ' + (admin === sender ? 'YES' : 'NO') + '\n';
          }
        }
        info += '\n=== 등록된 방 ===\n';
        if (botConfig.rooms) {
          for (var r = 0; r < botConfig.rooms.length; r++) {
            var rm = botConfig.rooms[r];
            info += '[' + r + ']: [' + rm.roomName + '] (길이:' + rm.roomName.length + ')\n';
            info += '  → 현재방 일치: ' + (rm.roomName === room ? 'YES' : 'NO') + '\n';
          }
        }
      }
      replier.reply(info);
      return;
    }
    
    // ========================================
    // 2단계: 관리자 명령어 처리 (! 로 시작)
    // ========================================
    if (msg.startsWith('!')) {
      Log.i('[DEBUG] 관리자 명령어 감지: ' + msg);
      
      // botConfig 없어도 관리자 명령어 일부는 처리 가능
      if (!botConfig) {
        Log.e('[DEBUG] botConfig가 없음!');
        replier.reply('봇 설정이 로드되지 않았습니다.\nbotConfig: NO\n\n서버 연결을 확인하세요.');
        return;
      }
      
      // 관리자 확인 (sender와 admins 비교) - 상세 로그 추가
      Log.i('[DEBUG] 관리자 체크 시작 - admins 수: ' + botConfig.admins.length);
      var isAdmin = false;
      for (var j = 0; j < botConfig.admins.length; j++) {
        var adminName = botConfig.admins[j];
        var match = (adminName === sender);
        Log.i('[DEBUG] 비교[' + j + ']: admin=[' + adminName + '] (길이:' + adminName.length + ') vs sender=[' + sender + '] (길이:' + sender.length + ') → ' + (match ? 'MATCH!' : 'NO'));
        if (match) {
          isAdmin = true;
          break;
        }
      }
      
      Log.i('[DEBUG] 관리자 체크 결과: isAdmin=' + isAdmin);
      
      if (isAdmin) {
        Log.i('[DEBUG] 관리자 명령어 처리 시작');
        handleAdminCommand(room, msg, sender, replier, botConfig);
      } else {
        Log.i('[DEBUG] 관리자 아님 - 명령어 거부');
        replier.reply('관리자 전용 명령어입니다.\n\n현재 발신자: [' + sender + '] (길이:' + sender.length + ')\n등록된 관리자: ' + botConfig.admins.join(', '));
      }
      return;
    }
    
    // ========================================
    // 3단계: 일반 명령어 처리 (/ 로 시작)
    // ========================================
    if (!msg.startsWith('/')) {
      // / 로 시작하지 않는 일반 대화는 무시
      Log.i('[DEBUG] /로 시작하지 않음 - 무시');
      return;
    }
    
    Log.i('[DEBUG] 일반 명령어 감지: ' + msg);
    
    // botConfig 확인
    if (!botConfig) {
      Log.e('[DEBUG] botConfig가 없음!');
      replier.reply('봇 설정이 로드되지 않았습니다.\n\n테스트 명령어: 테스트, 봇정보');
      return;
    }
    
    // 방 설정 확인 (정확한 값 매칭) - 상세 로그 추가
    Log.i('[DEBUG] 방 설정 확인 시작 - rooms 수: ' + botConfig.rooms.length);
    var roomConfig = null;
    for (var i = 0; i < botConfig.rooms.length; i++) {
      var roomName = botConfig.rooms[i].roomName;
      var match = (roomName === room);
      Log.i('[DEBUG] 비교[' + i + ']: roomName=[' + roomName + '] (길이:' + roomName.length + ') vs room=[' + room + '] (길이:' + room.length + ') → ' + (match ? 'MATCH!' : 'NO'));
      if (match) {
        roomConfig = botConfig.rooms[i];
        break;
      }
    }
    
    // roomConfig를 못 찾으면 디버그 응답 (문제 파악용)
    if (!roomConfig) {
      Log.e('[DEBUG] 방 미등록 - room: [' + room + '] (길이:' + room.length + ')');
      replier.reply('이 방은 봇에 등록되지 않았습니다.\n\n현재 방 이름: [' + room + '] (길이:' + room.length + ')\n\n등록하려면 관리자가 다음 명령어를 실행하세요:\n!방추가 ' + room);
      return;
    }
    
    Log.i('[DEBUG] 방 찾음 - enabled:' + roomConfig.enabled + ', commandsEnabled:' + roomConfig.commandsEnabled);
    
    // 방 비활성화 상태
    if (!roomConfig.enabled) {
      Log.i('[DEBUG] 방 비활성화 - 무시');
      return; // 조용히 무시
    }
    
    // 명령응답 비활성화 상태
    if (!roomConfig.commandsEnabled) {
      Log.i('[DEBUG] 명령응답 비활성화 - 무시');
      return; // 조용히 무시
    }
    
    // 일반 명령어 처리
    Log.i('[DEBUG] handleCommand 호출 - msg: ' + msg);
    handleCommand(room, msg, sender, replier);
    
  } catch (e) {
    Log.e('[DEBUG] response 예외: ' + e);
    replier.reply('오류 발생: ' + e);
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

// ========================================
// 10. 스크립트 로드 완료 후 초기화
// ========================================
// 모든 변수와 함수가 정의된 후에 onStartCompile() 호출
// (MessengerBotR이 자동 호출하지 않을 경우를 대비)
try {
  Log.i('========================================');
  Log.i('[스크립트 로드 완료] 모든 변수/함수 정의 완료');
  Log.i('[스크립트 로드 완료] onStartCompile() 수동 호출 시작');
  Log.i('========================================');
  onStartCompile();
  Log.i('[스크립트 로드 완료] onStartCompile() 수동 호출 성공');
} catch(initError) {
  Log.e('[스크립트 로드 완료] onStartCompile() 호출 실패: ' + initError);
}
