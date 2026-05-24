/**
 * 鉴权中间件
 * 从请求的 _auth token 中解析 userId
 */

const { verifyToken } = require('../utils/token');

/**
 * 验证请求 token，返回 userId
 * @param {object} event - 云函数 event.data
 * @returns {string} userId
 * @throws {Error} token 无效或缺失
 */
function getUserId(event) {
  const authObj = event._auth;
  if (!authObj) {
    throw Object.assign(new Error('缺少鉴权凭证'), { code: 'ERR_UNAUTHORIZED' });
  }

  const token = typeof authObj === 'string' ? authObj : authObj.token;
  if (!token) {
    throw Object.assign(new Error('缺少鉴权 Token'), { code: 'ERR_UNAUTHORIZED' });
  }

  const payload = verifyToken(token);
  if (!payload || !payload.userId) {
    throw Object.assign(new Error('登录已过期，请重新登录'), { code: 'ERR_UNAUTHORIZED' });
  }

  return payload.userId;
}

module.exports = {
  getUserId,
};
