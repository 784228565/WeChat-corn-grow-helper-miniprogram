/**
 * 轻量级 Token 验证工具
 * 与 loginManager 的 TokenService 签名算法保持一致（HMAC-SHA256）
 *
 * 兼容说明：使用 base64 + 字符替换实现 base64url，兼容 Node.js 12
 */

const crypto = require('crypto');
const { TOKEN_SECRET } = require('../config');

/**
 * base64url 编码（兼容 Node.js 12，无原生 base64url 支持）
 */
function base64urlEncode(buf) {
  return buf.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * base64url 解码（兼容 Node.js 12）
 */
function base64urlDecode(str) {
  var padding = 4 - (str.length % 4);
  if (padding !== 4) {
    str += '='.repeat(padding);
  }
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  if (!TOKEN_SECRET) {
    throw new Error('[Config] TOKEN_SECRET 未配置。请在云开发控制台 → 云函数 → 版本与配置 → 环境变量中设置 TOKEN_SECRET。详见项目 README.md');
  }
  try {
    var parts = token.split('.');
    if (parts.length !== 3) return null;

    var header = parts[0];
    var body = parts[1];
    var signature = parts[2];

    var expectedSig = base64urlEncode(
      crypto.createHmac('sha256', TOKEN_SECRET)
        .update(header + '.' + body)
        .digest()
    );

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      return null;
    }

    var payload = JSON.parse(base64urlDecode(body).toString('utf8'));
    var now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return null;

    return payload;
  } catch (err) {
    return null;
  }
}

module.exports = {
  verifyToken,
};
