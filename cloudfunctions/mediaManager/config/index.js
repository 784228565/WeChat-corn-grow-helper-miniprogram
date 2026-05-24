// Absolute Path: C:\Users\78422\WeChatProjects\checkin\cloudfunctions\mediaManager\config\index.js
// Description: 多媒体模块配置中心

const TOKEN_SECRET = process.env.TOKEN_SECRET || '';

const COLLECTIONS = {
  FARMS: 'Farms',
  USERS: 'Users',
  MEDIA_RECORDS: 'MediaRecords'
};

// 临时链接有效期（秒）
const TEMP_URL_EXPIRES = 3600; // 1小时

module.exports = {
  TOKEN_SECRET,
  COLLECTIONS,
  TEMP_URL_EXPIRES
};
