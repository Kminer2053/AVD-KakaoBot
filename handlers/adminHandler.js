// handlers/adminHandler.js
var config = require('../config');
var api = require('../utils/api');

function handleAdminCommand(room, msg, sender, replier, botConfig) {
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
        addRoom(arg1, botConfig, replier);
        break;
        
      case '!방삭제':
        if (!arg1) {
          replier.reply('사용법: !방삭제 <방이름>');
          return;
        }
        removeRoom(arg1, botConfig, replier);
        break;
        
      case '!방':
        if (arg1 === 'on' && arg2) {
          toggleRoom(arg2, true, botConfig, replier);
        } else if (arg1 === 'off' && arg2) {
          toggleRoom(arg2, false, botConfig, replier);
        } else {
          replier.reply('사용법: !방 on/off <방이름>');
        }
        break;
        
      case '!일정알림':
        if (arg1 === 'on' && arg2) {
          toggleScheduleNotify(arg2, true, botConfig, replier);
        } else if (arg1 === 'off' && arg2) {
          toggleScheduleNotify(arg2, false, botConfig, replier);
        } else {
          replier.reply('사용법: !일정알림 on/off <방이름>');
        }
        break;
        
      case '!명령':
        if (arg1 === 'on' && arg2) {
          toggleCommands(arg2, true, botConfig, replier);
        } else if (arg1 === 'off' && arg2) {
          toggleCommands(arg2, false, botConfig, replier);
        } else {
          replier.reply('사용법: !명령 on/off <방이름>');
        }
        break;
        
      case '!방목록':
        listRooms(botConfig, replier);
        break;
        
      case '!상태':
        showStatus(botConfig, replier);
        break;
        
      default:
        replier.reply('알 수 없는 명령어: ' + cmd + '\n\n사용 가능한 명령어:\n!방추가, !방삭제, !방, !일정알림, !명령, !방목록, !상태');
    }
  } catch (e) {
    replier.reply('오류 발생: ' + e);
    Log.e('관리자 명령 오류: ' + e);
  }
}

function addRoom(roomName, botConfig, replier) {
  // 이미 존재하는지 확인
  for (var i = 0; i < botConfig.rooms.length; i++) {
    if (botConfig.rooms[i].roomName === roomName) {
      replier.reply('이미 존재하는 방입니다: ' + roomName);
      return;
    }
  }
  
  botConfig.rooms.push({
    roomName: roomName,
    enabled: true,
    scheduleNotify: true,
    commandsEnabled: true
  });
  
  var success = api.updateConfig(botConfig);
  if (success) {
    replier.reply('방 추가 완료: ' + roomName);
  } else {
    replier.reply('방 추가 실패 (서버 오류)');
  }
}

function removeRoom(roomName, botConfig, replier) {
  var found = false;
  var newRooms = [];
  
  for (var i = 0; i < botConfig.rooms.length; i++) {
    if (botConfig.rooms[i].roomName === roomName) {
      found = true;
    } else {
      newRooms.push(botConfig.rooms[i]);
    }
  }
  
  if (!found) {
    replier.reply('방을 찾을 수 없습니다: ' + roomName);
    return;
  }
  
  botConfig.rooms = newRooms;
  
  var success = api.updateConfig(botConfig);
  if (success) {
    replier.reply('방 삭제 완료: ' + roomName);
  } else {
    replier.reply('방 삭제 실패 (서버 오류)');
  }
}

function toggleRoom(roomName, enabled, botConfig, replier) {
  var room = null;
  for (var i = 0; i < botConfig.rooms.length; i++) {
    if (botConfig.rooms[i].roomName === roomName) {
      room = botConfig.rooms[i];
      break;
    }
  }
  
  if (!room) {
    replier.reply('방을 찾을 수 없습니다: ' + roomName);
    return;
  }
  
  room.enabled = enabled;
  
  var success = api.updateConfig(botConfig);
  if (success) {
    replier.reply(roomName + ' 방 ' + (enabled ? '활성화' : '비활성화') + ' 완료');
  } else {
    replier.reply('설정 변경 실패 (서버 오류)');
  }
}

function toggleScheduleNotify(roomName, enabled, botConfig, replier) {
  var room = null;
  for (var i = 0; i < botConfig.rooms.length; i++) {
    if (botConfig.rooms[i].roomName === roomName) {
      room = botConfig.rooms[i];
      break;
    }
  }
  
  if (!room) {
    replier.reply('방을 찾을 수 없습니다: ' + roomName);
    return;
  }
  
  room.scheduleNotify = enabled;
  
  var success = api.updateConfig(botConfig);
  if (success) {
    replier.reply(roomName + ' 방 일정알림 ' + (enabled ? 'ON' : 'OFF') + ' 완료');
  } else {
    replier.reply('설정 변경 실패 (서버 오류)');
  }
}

function toggleCommands(roomName, enabled, botConfig, replier) {
  var room = null;
  for (var i = 0; i < botConfig.rooms.length; i++) {
    if (botConfig.rooms[i].roomName === roomName) {
      room = botConfig.rooms[i];
      break;
    }
  }
  
  if (!room) {
    replier.reply('방을 찾을 수 없습니다: ' + roomName);
    return;
  }
  
  room.commandsEnabled = enabled;
  
  var success = api.updateConfig(botConfig);
  if (success) {
    replier.reply(roomName + ' 방 명령응답 ' + (enabled ? 'ON' : 'OFF') + ' 완료');
  } else {
    replier.reply('설정 변경 실패 (서버 오류)');
  }
}

function listRooms(botConfig, replier) {
  if (botConfig.rooms.length === 0) {
    replier.reply('등록된 방이 없습니다.');
    return;
  }
  
  var msg = '=== 방 목록 ===\n\n';
  for (var i = 0; i < botConfig.rooms.length; i++) {
    var r = botConfig.rooms[i];
    msg += (i + 1) + '. ' + r.roomName + '\n';
    msg += '   상태: ' + (r.enabled ? '활성' : '비활성') + '\n';
    msg += '   일정알림: ' + (r.scheduleNotify ? 'ON' : 'OFF') + '\n';
    msg += '   명령응답: ' + (r.commandsEnabled ? 'ON' : 'OFF') + '\n\n';
  }
  
  replier.reply(msg);
}

function showStatus(botConfig, replier) {
  var enabledRooms = 0;
  for (var i = 0; i < botConfig.rooms.length; i++) {
    if (botConfig.rooms[i].enabled) {
      enabledRooms++;
    }
  }
  
  var msg = '=== 봇 상태 ===\n\n' +
            '디바이스: ' + config.DEVICE_ID + '\n' +
            '서버: ' + config.SERVER_URL + '\n' +
            '폴링 간격: ' + (config.POLL_INTERVAL_MS / 1000) + '초\n' +
            '활성 방: ' + enabledRooms + '/' + botConfig.rooms.length + '\n' +
            '관리자: ' + botConfig.admins.join(', ');
  
  replier.reply(msg);
}

module.exports = { handleAdminCommand: handleAdminCommand };
