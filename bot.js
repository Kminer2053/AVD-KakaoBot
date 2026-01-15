// bot.js - 메신저봇R 메인 스크립트
var config = require('./config');
var commandHandler = require('./handlers/commandHandler');
var adminHandler = require('./handlers/adminHandler');
var outboxHandler = require('./handlers/outboxHandler');
var api = require('./utils/api');
var logger = require('./utils/logger');

// 전역 변수
var botConfig = null;

// 봇 시작 시 초기화
function onStartCompile() {
  try {
    logger.info('=== 카카오봇 초기화 시작 ===');
    
    // 서버에서 설정 로드
    botConfig = api.loadConfig();
    
    if (botConfig) {
      logger.info('카카오봇 초기화 완료');
      logger.info('관리자: ' + botConfig.admins.join(', '));
      
      var enabledRooms = 0;
      for (var i = 0; i < botConfig.rooms.length; i++) {
        if (botConfig.rooms[i].enabled) {
          enabledRooms++;
        }
      }
      logger.info('활성 방: ' + enabledRooms + '/' + botConfig.rooms.length);
      
      // Outbox 폴링 시작
      outboxHandler.startOutboxPolling(botConfig);
      
    } else {
      logger.error('설정 로드 실패 - 서버 연결을 확인하세요');
    }
  } catch (e) {
    logger.error('초기화 오류: ' + e);
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
      for (var i = 0; i < botConfig.admins.length; i++) {
        if (botConfig.admins[i] === sender) {
          isAdmin = true;
          break;
        }
      }
      
      if (isAdmin) {
        adminHandler.handleAdminCommand(room, msg, sender, replier, botConfig);
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
    commandHandler.handleCommand(room, msg, sender, replier);
    
  } catch (e) {
    logger.error('메시지 처리 오류: ' + e);
  }
}

// 주기적 설정 동기화 (1시간마다)
setInterval(function() {
  try {
    var newConfig = api.loadConfig();
    if (newConfig) {
      botConfig = newConfig;
      logger.info('설정 동기화 완료');
    }
  } catch (e) {
    logger.error('설정 동기화 오류: ' + e);
  }
}, 60 * 60 * 1000);
