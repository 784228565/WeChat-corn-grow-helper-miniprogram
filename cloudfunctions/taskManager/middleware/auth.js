// Absolute Path: C:\Users\78422\WeChatProjects\checkin\cloudfunctions\taskManager\middleware\auth.js
// Description: 鉴权中间件 — Token解析 + 农场归属校验
// 兼容说明：复用 farmManager 的 Token 验证逻辑，与 loginManager 密钥一致

const { verifyToken } = require('../utils/token');
const cloud = require('wx-server-sdk');
const { COLLECTIONS } = require('../config');

const db = cloud.database();

/**
 * 从请求中解析 userId
 * @param {object} event - 云函数 event.data
 * @returns {string} userId
 * @throws {Error} token 无效或缺失
 */
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

/**
 * 校验农场归属权
 * @param {string} userId
 * @param {string} farmId
 * @returns {Promise<object>} 农场文档
 * @throws {Error} 农场不存在或越权
 */
async function checkFarmOwnership(userId, farmId) {
  var farm = await db.collection(COLLECTIONS.FARMS).doc(farmId).get()
    .then(function(res) { return res.data; })
    .catch(function() { return null; });

  if (!farm) {
    throw Object.assign(new Error('农场不存在'), { code: 'ERR_FARM_NOT_FOUND' });
  }
  if (farm.userId !== userId) {
    throw Object.assign(new Error('无权访问该农场'), { code: 'ERR_FORBIDDEN' });
  }
  return farm;
}

module.exports = {
  getUserId: getUserId,
  checkFarmOwnership: checkFarmOwnership
};
