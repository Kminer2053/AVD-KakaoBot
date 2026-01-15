// config.js
module.exports = {
  // 서버 URL (AVD에서 호스트 PC 접근)
  SERVER_URL: 'http://10.0.2.2:5000',
  
  // 봇 인증 토큰 (백엔드 .env의 BOT_API_TOKEN과 동일해야 함)
  BOT_TOKEN: 'your-secret-token-here',
  
  // 디바이스 ID (다중 봇 운영 시 구분용)
  DEVICE_ID: 'avd-01',
  
  // Outbox 폴링 간격 (밀리초)
  POLL_INTERVAL_MS: 15000, // 15초
  
  // 한 번에 가져올 메시지 수
  PULL_LIMIT: 20,
  
  // 카톡 메시지 길이 제한
  MAX_MESSAGE_LENGTH: 3000,
  
  // HTTP 요청 타임아웃
  REQUEST_TIMEOUT_MS: 10000 // 10초
};
