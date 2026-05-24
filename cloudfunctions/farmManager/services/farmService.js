/**
 * 农场服务层 — 核心 CRUD 逻辑
 *
 * 关键设计：
 * - 所有操作强制校验 userId 与 farmId 的归属关系（防越权）
 * - switchFarm 使用 db.transaction 保证原子性（详见 switchFarm 注释）
 */

const cloud = require('wx-server-sdk');
const { COLLECTIONS, MAX_FARMS_PER_USER } = require('../config');

const db = cloud.database();
const $ = db.command;

/**
 * 生成农场 ID
 */
function generateFarmId() {
  return 'f_' + require('crypto').randomBytes(4).toString('hex');
}

/**
 * 校验农场归属权
 * @returns {Promise<object>} 农场文档
 */
async function checkOwnership(userId, farmId) {
  const farm = await db.collection(COLLECTIONS.FARMS).doc(farmId).get()
    .then(res => res.data)
    .catch(() => null);

  if (!farm) {
    throw Object.assign(new Error('农场不存在'), { code: 'ERR_FARM_NOT_FOUND' });
  }
  if (farm.userId !== userId) {
    throw Object.assign(new Error('无权访问该农场'), { code: 'ERR_FORBIDDEN' });
  }
  return farm;
}

/**
 * 获取用户农场数量
 */
async function getFarmCount(userId) {
  const res = await db.collection(COLLECTIONS.FARMS)
    .where({ userId })
    .count();
  return res.total || 0;
}

/**
 * 1. 获取农场列表
 * @param {string} userId
 * @param {boolean} includeArchived - 是否包含已归档农场
 */
async function list(userId, includeArchived) {
  const query = { userId };
  if (!includeArchived) {
    query.status = 'active';
  }

  const res = await db.collection(COLLECTIONS.FARMS)
    .where(query)
    .orderBy('createdAt', 'desc')
    .get();

  return (res.data || []).map(function(farm) {
    return {
      farmId: farm.farmId,
      name: farm.name,
      cropType: farm.cropType,
      location: farm.location,
      isActive: farm.isActive,
      status: farm.status,
      currentStage: farm.stage ? farm.stage.currentStage : 'VE',
      fullName: farm.fullName || '',
      phone: farm.phone || '',
      accumulatedTemp: farm.accumulatedTemp || 0,
      soilType: farm.soilType || '',
      irrigation: farm.irrigation || ''
    };
  });
}

/**
 * 2. 切换当前活跃农场
 *
 * 【事务必要性说明】
 * 切换活跃农场涉及两个写操作：
 *   1. 将原活跃农场的 isActive 置为 false
 *   2. 将目标农场的 isActive 置为 true
 * 如果不使用事务，在高并发场景下（如用户快速连点切换），可能出现：
 *   - 两个农场同时 isActive = true（脏写）
 *   - 用户列表中出现两个「当前农场」，导致后续模块查询混乱
 * 使用 db.transaction 将两个操作包裹为原子操作，确保互斥性。
 *
 * @param {string} userId
 * @param {string} farmId
 */
async function switchFarm(userId, farmId) {
  // 前置校验：目标农场是否属于当前用户
  await checkOwnership(userId, farmId);

  // 使用事务保证原子性
  // 事务策略：先查询当前活跃农场，再通过 doc().update() 原子更新
  // 避免事务中直接使用 where().update() 的兼容性风险
  await db.runTransaction(async transaction => {
    // Step 1: 查询当前活跃农场（事务内查询保证一致性）
    const activeRes = await transaction.collection(COLLECTIONS.FARMS)
      .where({ userId, isActive: true })
      .get();

    // Step 2: 将当前活跃农场设为非活跃
    if (activeRes.data && activeRes.data.length > 0) {
      const activeFarm = activeRes.data[0];
      await transaction.collection(COLLECTIONS.FARMS)
        .doc(activeFarm._id)
        .update({
          data: {
            isActive: false,
            updatedAt: new Date(),
          },
        });
    }

    // Step 3: 将目标农场设为活跃
    await transaction.collection(COLLECTIONS.FARMS)
      .doc(farmId)
      .update({
        data: {
          isActive: true,
          updatedAt: new Date(),
        },
      });
  });

  // Step 4: 更新 Users 集合中的 activeFarmId（事务外，失败不影响农场状态一致性）
  try {
    const userRes = await db.collection(COLLECTIONS.USERS)
      .where({ userId })
      .get();
    if (userRes.data && userRes.data.length > 0) {
      await db.collection(COLLECTIONS.USERS)
        .doc(userRes.data[0]._id)
        .update({
          data: {
            activeFarmId: farmId,
            updatedAt: new Date(),
          },
        });
    }
  } catch (err) {
    console.warn('[switchFarm] 更新 Users.activeFarmId 失败:', err.message);
  }

  // 返回目标农场信息
  const farm = await db.collection(COLLECTIONS.FARMS).doc(farmId).get()
    .then(res => res.data);

  return {
    farmId: farm.farmId,
    name: farm.name,
    currentStage: farm.stage ? farm.stage.currentStage : 'VE',
  };
}

/**
 * 3. 创建新农场
 * @param {string} userId
 * @param {object} data
 */
async function create(userId, data) {
  // 检查农场数量上限
  const count = await getFarmCount(userId);
  if (count >= MAX_FARMS_PER_USER) {
    throw Object.assign(
      new Error('最多可管理 ' + MAX_FARMS_PER_USER + ' 个农场'),
      { code: 'ERR_FARM_LIMIT_REACHED' }
    );
  }

  const farmId = generateFarmId();
  const now = new Date();

  // 如果是用户的第一个农场，自动设为活跃
  const isFirstFarm = count === 0;

  const doc = {
    _id: farmId,
    farmId: farmId,
    userId: userId,
    name: data.name,
    cropType: data.cropType,
    location: data.location || { address: '', latitude: 0, longitude: 0 },
    fullName: data.fullName || '',
    phone: data.phone || '',
    accumulatedTemp: data.accumulatedTemp,
    soilType: data.soilType || '',
    irrigation: data.irrigation || '',
    planting: {
      density: data.plantingDensity || 0,
      densityUnit: 'plants/acre',
      variety: data.seedVariety || '',
      rowSpacing: data.rowSpacing || '',
    },
    stage: {
      currentStage: 'VE',
      currentStageIndex: 1,
      totalStages: 12,
      plantingDate: now,
    },
    status: 'active',
    isActive: isFirstFarm,
    createdAt: now,
    updatedAt: now,
  };

  await db.collection(COLLECTIONS.FARMS).add({ data: doc });

  // 若是首个农场，更新 Users.activeFarmId
  if (isFirstFarm) {
    // 通过 userId 查询 Users 集合并更新 activeFarmId
    const userRes = await db.collection(COLLECTIONS.USERS)
      .where({ userId })
      .get();
    if (userRes.data && userRes.data.length > 0) {
      await db.collection(COLLECTIONS.USERS)
        .doc(userRes.data[0]._id)
        .update({
          data: {
            activeFarmId: farmId,
            farms: $.push(farmId),
            updatedAt: now,
          },
        });
    }
  }

  return {
    farmId: farmId,
    name: doc.name,
    isActive: isFirstFarm,
    currentStage: doc.stage.currentStage
  };
}

/**
 * 4. 获取农场详情
 * @param {string} userId
 * @param {string} farmId
 */
async function detail(userId, farmId) {
  const farm = await checkOwnership(userId, farmId);

  return {
    farmId: farm.farmId,
    name: farm.name,
    cropType: farm.cropType,
    location: farm.location,
    fullName: farm.fullName || '',
    phone: farm.phone || '',
    accumulatedTemp: farm.accumulatedTemp,
    soilType: farm.soilType || '',
    irrigation: farm.irrigation || '',
    planting: farm.planting,
    stage: farm.stage,
    status: farm.status,
    isActive: farm.isActive,
    createdAt: farm.createdAt,
    updatedAt: farm.updatedAt,
  };
}

module.exports = {
  list,
  switchFarm,
  create,
  detail,
  checkOwnership,
  getFarmCount,
};
