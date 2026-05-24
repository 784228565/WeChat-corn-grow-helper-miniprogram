// Absolute Path: C:\Users\78422\WeChatProjects\checkin\cloudfunctions\checkinManager\config\index.js
// Description: 打卡模块配置中心

const TOKEN_SECRET = process.env.TOKEN_SECRET || '';

const COLLECTIONS = {
  FARMS: 'Farms',
  TASKS: 'Tasks',
  CHECKINS: 'CheckIns',
  USERS: 'Users'
};

// 分页默认值
const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 50
};

module.exports = {
  TOKEN_SECRET,
  COLLECTIONS,
  PAGINATION
};
