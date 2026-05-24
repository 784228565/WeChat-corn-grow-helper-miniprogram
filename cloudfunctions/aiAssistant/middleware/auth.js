// Absolute Path: C:\Users\78422\WeChatProjects\checkin\cloudfunctions\aiAssistant\middleware\auth.js
// Description: 鉴权中间件

const { verifyToken } = require('../utils/token');
const cloud = require('wx-server-sdk');
const { COLLECTIONS } = require('../config');

const db = cloud.database();

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
