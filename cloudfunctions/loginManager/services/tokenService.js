/**
 * Token 服务层
 * 负责生成、刷新、验证自定义鉴权 Token
 */

const crypto = require('../utils/crypto');
const Config = require('../config');

let cachedSecret = null;

/**
 * 获取当前生效的密钥（优先数据库，缓存 5 分钟）
 */
async function getSecret() {
  if (cachedSecret) {
    return cachedSecret;
  }
  cachedSecret = await Config.getTokenSecret();
  // 5 分钟后清除缓存，允许热更新
  setTimeout(() => { cachedSecret = null; }, 5 * 60 * 1000);
  return cachedSecret;
}

/**
 * 签发新 Token
 * @param {string} userId - 脱敏用户 ID
 * @param {string} openid - 微信 openid
 */
async function issueToken(userId, openid) {
  const secret = await getSecret();
  if (!secret) {
    throw new Error('[TokenService] 密钥未配置');
  }

  const now = Math.floor(Date.now() / 1000);
  const jti = require('crypto').randomBytes(8).toString('hex');

  const payload = {
    userId,
    encryptedOpenid: crypto.encrypt(openid, secret),
    jti,
    iat: now,
    exp: now + Config.TOKEN_EXPIRES_IN,
  };

  return {
    token: crypto.signToken(payload, secret),
    expiresIn: Config.TOKEN_EXPIRES_IN,
    expiresAt: new Date((now + Config.TOKEN_EXPIRES_IN) * 1000),
  };
}

/**
 * 验证 Token 有效性
 * @param {string} token - 前端传入的 token
 */
async function verifyToken(token) {
  const secret = await getSecret();
  if (!secret || !token || typeof token !== 'string') {
    return null;
  }
  return crypto.verifyToken(token, secret);
}

/**
 * 从 Token payload 中解密获取 openid
 * @param {object} payload - verifyToken 返回的 payload
 */
async function extractOpenid(payload) {
  if (!payload || !payload.encryptedOpenid) {
    return null;
  }
  const secret = await getSecret();
  if (!secret) return null;
  return crypto.decrypt(payload.encryptedOpenid, secret);
}

module.exports = {
  issueToken,
  verifyToken,
  extractOpenid,
};
