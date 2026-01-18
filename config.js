// config.js
module.exports = {
  // SERVER_URL과 BOT_TOKEN은 서버 API에서 받아옴
  
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
