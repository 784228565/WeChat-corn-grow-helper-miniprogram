/**
 * 加密与签名工具
 * 使用 Node.js 原生 crypto 模块，无外部依赖
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

/**
 * 生成脱敏用户 ID
 * 格式: u_ + 8 位随机十六进制字符串
 */
function generateUserId() {
  return 'u_' + crypto.randomBytes(4).toString('hex');
}

/**
 * 使用 HMAC-SHA256 生成签名 Token
 * 格式: base64url(header).base64url(payload).base64url(signature)
 * @param {object} payload - Token 载荷 { userId, encryptedOpenid, jti, iat, exp }
 * @param {string} secret - 签名密钥
 */
function signToken(payload, secret) {
  var header = base64urlEncode(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  var body = base64urlEncode(Buffer.from(JSON.stringify(payload)));
  var signature = base64urlEncode(
    crypto.createHmac('sha256', secret)
      .update(header + '.' + body)
      .digest()
  );
  return header + '.' + body + '.' + signature;
}

/**
 * 验证并解码 Token
 * @param {string} token - 完整 token 字符串
 * @param {string} secret - 签名密钥
 * @returns {object|null} 解码后的 payload，无效则返回 null
 */
function verifyToken(token, secret) {
  try {
    var parts = token.split('.');
    if (parts.length !== 3) return null;

    var header = parts[0];
    var body = parts[1];
    var signature = parts[2];

    var expectedSig = base64urlEncode(
      crypto.createHmac('sha256', secret)
        .update(header + '.' + body)
        .digest()
    );

    // 常量时间比较，防止时序攻击
    if (!crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSig)
    )) {
      return null;
    }

    var payload = JSON.parse(base64urlDecode(body).toString('utf8'));

    // 检查过期时间
    var now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null;
    }

    return payload;
  } catch (err) {
    return null;
  }
}

/**
 * AES-256-GCM 加密敏感字段（如 openid）
 * 用于 Token payload 中的 encryptedOpenid 字段
 * @param {string} text - 明文
 * @param {string} secret - 密钥
 */
function encrypt(text, secret) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    'aes-256-gcm',
    crypto.scryptSync(secret, 'salt', 32),
    iv
  );
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * AES-256-GCM 解密
 * @param {string} encryptedText - iv:authTag:ciphertext 格式
 * @param {string} secret - 密钥
 */
function decrypt(encryptedText, secret) {
  const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    crypto.scryptSync(secret, 'salt', 32),
    Buffer.from(ivHex, 'hex')
  );
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

module.exports = {
  generateUserId,
  signToken,
  verifyToken,
  encrypt,
  decrypt,
};
