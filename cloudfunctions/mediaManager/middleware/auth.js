// Absolute Path: C:\Users\78422\WeChatProjects\checkin\cloudfunctions\mediaManager\middleware\auth.js
// Description: 鉴权中间件

const { verifyToken } = require('../utils/token');

function getUserId(event) {
  var authObj = event._auth;
  if (!authObj) {
    throw Object.assign(new Error('缺少鉴权凭证'), { code: 'ERR_UNAUTHORIZED' });
  }
  var token = typeof authObj === 'string' ? authObj : authObj.token;
  if (!token) {
    throw Object.assign(new Error('缺少鉴权 Token'), { code: 'ERR_UNAUTHORIZED' });
  }
  var payload = verifyToken(token);
  if (!payload || !payload.userId) {
    throw Object.assign(new Error('登录已过期，请重新登录'), { code: 'ERR_UNAUTHORIZED' });
  }
  return payload.userId;
}

module.exports = { getUserId: getUserId };
