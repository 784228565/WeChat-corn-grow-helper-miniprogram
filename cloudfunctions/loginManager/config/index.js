/**
 * 全局配置中心
 *
 * 安全策略：
 *   1. 开发阶段：直接读取 config.json 中的本地密钥（方便调试）
 *   2. 上线阶段：优先读取云数据库 sys_config 表中的密钥（无需环境变量）
 */

const cloud = require('wx-server-sdk');

// 开发阶段默认密钥（仅本地使用，上线后会被数据库中的值覆盖）
const LOCAL_TOKEN_SECRET = process.env.TOKEN_SECRET || '';

// Token 有效期：7 天（单位：秒）
const TOKEN_EXPIRES_IN = 7 * 24 * 60 * 60;

// 默认用户昵称与头像（用户拒绝授权时的 fallback）
// avatarUrl 为空时前端会显示 emoji 占位头像，避免外网图片 400 问题
const DEFAULT_PROFILE = {
  nickName: '微信用户',
  avatarUrl: '',
  gender: 0,
};

// 数据库集合名
const COLLECTIONS = {
  USERS: 'Users',
  SYS_CONFIG: 'sys_config', // 系统配置表
};

/**
 * 获取 Token 密钥
 * 优先从云数据库 sys_config 表读取，失败时回退到本地默认值
 */
async function getTokenSecret() {
  try {
    const db = cloud.database();
    const res = await db.collection(COLLECTIONS.SYS_CONFIG)
      .doc('auth')
      .get();
    if (res.data && res.data.tokenSecret) {
      return res.data.tokenSecret;
    }
  } catch (e) {
    // 数据库读取失败（表不存在或记录不存在），回退到本地默认值
  }
  return LOCAL_TOKEN_SECRET;
}

module.exports = {
  LOCAL_TOKEN_SECRET,
  TOKEN_EXPIRES_IN,
  DEFAULT_PROFILE,
  COLLECTIONS,
  getTokenSecret,
};
