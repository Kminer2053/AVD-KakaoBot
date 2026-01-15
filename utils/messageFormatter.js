// utils/messageFormatter.js

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

module.exports = { splitMessage: splitMessage };
