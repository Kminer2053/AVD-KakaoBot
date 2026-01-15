// handlers/outboxHandler.js
var config = require('../config');
var api = require('../utils/api');
var messageFormatter = require('../utils/messageFormatter');

var pollingTimer = null;

function startOutboxPolling(botConfig) {
  if (pollingTimer) {
    clearInterval(pollingTimer);
  }
  
  pollingTimer = setInterval(function() {
    processOutbox(botConfig);
  }, config.POLL_INTERVAL_MS);
  
  // 즉시 첫 실행
  processOutbox(botConfig);
  
  Log.i('Outbox 폴링 시작 (간격: ' + (config.POLL_INTERVAL_MS / 1000) + '초)');
}

function processOutbox(botConfig) {
  try {
    // 1. 메시지 Pull
    var response = api.pullMessages(config.DEVICE_ID, config.PULL_LIMIT);
    
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
        for (var j = 0; j < botConfig.rooms.length; j++) {
          if (botConfig.rooms[j].roomName === item.targetRoom) {
            roomConfig = botConfig.rooms[j];
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
        var messages = messageFormatter.splitMessage(item.message, config.MAX_MESSAGE_LENGTH);
        
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
    api.sendAck(config.DEVICE_ID, results);
    
  } catch (e) {
    Log.e('Outbox 처리 오류: ' + e);
  }
}

module.exports = { startOutboxPolling: startOutboxPolling };
