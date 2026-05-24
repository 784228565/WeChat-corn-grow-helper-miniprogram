/**
 * 农场管理模块配置中心
 */

// Token 签名密钥（与 loginManager 保持一致）
const TOKEN_SECRET = process.env.TOKEN_SECRET || '';

// 每个用户最多创建的农场数量
const MAX_FARMS_PER_USER = 5;

// 种植密度合理范围
const DENSITY_RANGE = {
  MIN: 1000,      // 最低 1000 plants/acre
  MAX: 100000,    // 最高 100000 plants/acre
};

// 坐标范围
const COORDINATE_RANGE = {
  LAT_MIN: -90,
  LAT_MAX: 90,
  LNG_MIN: -180,
  LNG_MAX: 180,
};

// 支持的作物类型
const SUPPORTED_CROPS = ['corn', 'soybean', 'wheat', 'rice', 'cotton', 'other'];

// 数据库集合名
const COLLECTIONS = {
  FARMS: 'Farms',
  USERS: 'Users',
};

module.exports = {
  TOKEN_SECRET,
  MAX_FARMS_PER_USER,
  DENSITY_RANGE,
  COORDINATE_RANGE,
  SUPPORTED_CROPS,
  COLLECTIONS,
};
