/**
 * userService.js 修复补丁
 * 修复 QA 复核发现的 2 项阻塞性缺陷：
 *   DEF-01: 并发冲突错误捕获永远失效
 *   DEF-02: findByOpenid 吞掉网络异常
 *
 * 使用方法：将本文件内容替换 cloudfunctions/loginManager/services/userService.js
 */

const cloud = require('wx-server-sdk');
const { COLLECTIONS, DEFAULT_PROFILE } = require('../config');
const crypto = require('../utils/crypto');

// ============================================================
// 修复 DEF-02：findByOpenid 不再吞掉所有异常
// ============================================================
async function findByOpenid(openid) {
  const db = cloud.database();
  try {
    const res = await db
      .collection(COLLECTIONS.USERS)
      .doc(openid)
      .get();
    return res.data || null;
  } catch (err) {
    // 区分「文档/集合不存在」与「网络/数据库异常」
    // 空数据库时，云数据库 doc().get() 可能返回以下任意一种错误格式：
    //   errCode: -502001 (document not found)
    //   errMsg:  "document.get:fail document with _id xxx does not exist"
    //   message: "document.get:fail document with _id xxx does not exist"
    //   集合不存在时也可能出现 "collection not exists" 等变体
    const msg = (err.errMsg || err.message || '').toLowerCase();
    const isNotFound = err.errCode === -502001 ||
      err.errCode === -1 ||
      /not found|does not exist|document not exists|collection not exists/i.test(msg);

    if (isNotFound) {
      return null; // 正常：用户不存在或集合尚未创建
    }

    // 其他异常（网络超时、权限错误等）继续抛出
    console.error(`[findByOpenid] 数据库查询异常:`, err);
    throw err;
  }
}

async function createUser(userData) {
  const db = cloud.database();
  const now = new Date();

  const doc = {
    _id: userData.openid,
    openid: userData.openid,
    unionid: userData.unionid || '',
    userId: userData.userId,
    profile: userData.profile,
    farms: [],
    activeFarmId: '',
    status: 'active', // QA 建议补充的字段
    stats: {
      loginCount: 1,
      firstLoginAt: now,
      lastLoginAt: now,
      lastLoginIp: userData.sourceIp || '',
    },
    session: {
      token: userData.token,
      expiresAt: userData.expiresAt,
      refreshCount: 0,
    },
    createdAt: now,
    updatedAt: now,
  };

  await db.collection(COLLECTIONS.USERS).add({ data: doc });
  return doc;
}

async function updateLoginInfo(openid, updateData) {
  const db = cloud.database();
  const $ = db.command;

  await db
    .collection(COLLECTIONS.USERS)
    .doc(openid)
    .update({
      data: {
        'stats.loginCount': $.inc(1),
        'stats.lastLoginAt': new Date(),
        'stats.lastLoginIp': updateData.sourceIp || '',
        'session.token': updateData.token,
        'session.expiresAt': updateData.expiresAt,
        'session.refreshCount': $.inc(1),
        updatedAt: new Date(),
      },
    });
}

function buildProfile(rawUserInfo) {
  if (!rawUserInfo) {
    return { ...DEFAULT_PROFILE };
  }

  return {
    nickName: rawUserInfo.nickName || DEFAULT_PROFILE.nickName,
    avatarUrl: rawUserInfo.avatarUrl || DEFAULT_PROFILE.avatarUrl,
    gender: [0, 1, 2].includes(rawUserInfo.gender)
      ? rawUserInfo.gender
      : DEFAULT_PROFILE.gender,
    country: rawUserInfo.country || '',
    province: rawUserInfo.province || '',
    city: rawUserInfo.city || '',
  };
}

// ============================================================
// 修复 DEF-01：并发冲突错误捕获使用正确的 errCode 判断
// ============================================================
async function syncUser(openid, unionid, userInfo, sourceIp, token, expiresAt) {
  const existing = await findByOpenid(openid);

  if (existing) {
    await updateLoginInfo(openid, { sourceIp, token, expiresAt });
    return {
      userId: existing.userId,
      isNewUser: false,
      user: existing,
    };
  }

  const profile = buildProfile(userInfo);
  const userId = crypto.generateUserId();

  try {
    const doc = await createUser({
      openid,
      unionid,
      userId,
      profile,
      sourceIp,
      token,
      expiresAt,
    });
    return {
      userId,
      isNewUser: true,
      user: doc,
    };
  } catch (err) {
    // ✅ 修正：使用 errCode === -502001 判断文档已存在
    const isDupError = err.errCode === -502001 ||
      (err.message && /document already exists|duplicate key|_id_/.test(err.message));

    if (isDupError) {
      const concurrentUser = await findByOpenid(openid);
      if (concurrentUser) {
        await updateLoginInfo(openid, { sourceIp, token, expiresAt });
        return {
          userId: concurrentUser.userId,
          isNewUser: false,
          user: concurrentUser,
        };
      }
    }

    throw err;
  }
}

module.exports = {
  findByOpenid,
  createUser,
  updateLoginInfo,
  syncUser,
  buildProfile,
};
