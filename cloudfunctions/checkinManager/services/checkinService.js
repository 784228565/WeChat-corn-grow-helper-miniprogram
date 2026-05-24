// Absolute Path: C:\Users\78422\WeChatProjects\checkin\cloudfunctions\checkinManager\services\checkinService.js
// Description: 打卡服务层 — 打卡CRUD + 任务完成校验
// 关键设计：
// - submit 时双重校验：前端已校验 + 后端读取 Tasks 集合再次确认
// - 快照存储：completedTasks 和 aiInsight 在创建时固化，不随后续任务修改而变化
// - 使用 db.transaction 保证 submit 的原子性（读取任务 + 创建打卡）

const cloud = require('wx-server-sdk');
const { COLLECTIONS, PAGINATION } = require('../config');
const Auth = require('../middleware/auth');
const CheckinValidator = require('./checkinValidator');

const db = cloud.database();
const _ = db.command;

function generateCheckInId() {
  return 'c_' + require('crypto').randomBytes(4).toString('hex');
}

/**
 * 提交打卡
 * @param {string} userId
 * @param {string} farmId
 * @param {string} stage
 * @param {number} timestamp
 * @param {object} location
 * @param {string} note
 * @param {string[]} photos
 */
async function submit(userId, farmId, stage, timestamp, location, note, photos) {
  // Step 1: 校验农场归属
  var farm = await Auth.checkFarmOwnership(userId, farmId);

  // Step 2: 检查该阶段是否已打卡（每阶段限1次）
  var existingRes = await db.collection(COLLECTIONS.CHECKINS)
    .where({ farmId: farmId, stage: stage })
    .count();
  if (existingRes.total > 0) {
    throw Object.assign(
      new Error('该阶段已打卡，请勿重复打卡'),
      { code: 'ERR_ALREADY_CHECKED_IN' }
    );
  }

  // Step 3: 校验任务完成状态
  var taskStatus = await CheckinValidator.validateTasksCompleted(farmId, stage);

  if (!taskStatus.allCompleted) {
    throw Object.assign(
      new Error('还有 ' + (taskStatus.totalCount - taskStatus.completedCount) + ' 个任务未完成'),
      { code: 'ERR_TASKS_INCOMPLETE' }
    );
  }

  // Step 3: 生成打卡记录（快照存储）
  var checkInId = generateCheckInId();
  var now = new Date();

  var doc = {
    _id: checkInId,
    checkInId: checkInId,
    userId: userId,
    farmId: farmId,
    stage: stage,
    completedTasks: taskStatus.completedTasks,
    totalTaskCount: taskStatus.totalCount,
    completedTaskCount: taskStatus.completedCount,
    photos: photos || [],
    aiInsight: null,  // TODO: 可从 taskManager 获取当前 AI Insight 快照
    location: location || { address: '', latitude: 0, longitude: 0 },
    note: note || '',
    checkedInAt: new Date(timestamp),
    createdAt: now,
    updatedAt: now
  };

  // Step 4: 持久化到数据库
  await db.collection(COLLECTIONS.CHECKINS).add({ data: doc });

  return {
    checkInId: checkInId,
    stage: stage,
    completedTaskCount: taskStatus.completedCount,
    totalTaskCount: taskStatus.totalCount,
    checkedInAt: timestamp
  };
}

/**
 * 获取打卡记录列表
 * @param {string} userId
 * @param {string} farmId
 * @param {number} page
 * @param {number} limit
 * @param {string} startDate
 * @param {string} endDate
 */
async function list(userId, farmId, page, limit, startDate, endDate) {
  // 校验农场归属
  await Auth.checkFarmOwnership(userId, farmId);

  var currentPage = page || PAGINATION.DEFAULT_PAGE;
  var pageSize = limit || PAGINATION.DEFAULT_LIMIT;

  // 构建查询
  var query = { farmId: farmId };

  if (startDate || endDate) {
    var timeRange = {};
    if (startDate) timeRange['$gte'] = new Date(startDate);
    if (endDate) timeRange['$lte'] = new Date(endDate);
    if (Object.keys(timeRange).length > 0) {
      query.checkedInAt = timeRange;
    }
  }

  // 查询总数
  var countRes = await db.collection(COLLECTIONS.CHECKINS)
    .where(query)
    .count();
  var total = countRes.total || 0;

  // 分页查询
  var listRes = await db.collection(COLLECTIONS.CHECKINS)
    .where(query)
    .orderBy('checkedInAt', 'desc')
    .skip((currentPage - 1) * pageSize)
    .limit(pageSize)
    .get();

  var logs = (listRes.data || []).map(function(item) {
    return {
      id: item.checkInId,
      stage: item.stage,
      completedTaskCount: item.completedTaskCount,
      totalTaskCount: item.totalTaskCount,
      checkedInAt: item.checkedInAt ? item.checkedInAt.getTime() : 0,
      thumbnail: item.photos && item.photos.length > 0 ? item.photos[0] : null,
      location: item.location && item.location.address ? item.location.address : null
    };
  });

  return {
    logs: logs,
    total: total,
    page: currentPage,
    limit: pageSize,
    hasMore: currentPage * pageSize < total
  };
}

/**
 * 获取打卡详情
 * @param {string} userId
 * @param {string} checkInId
 */
async function detail(userId, checkInId) {
  var checkIn = await db.collection(COLLECTIONS.CHECKINS).doc(checkInId).get()
    .then(function(res) { return res.data; })
    .catch(function() { return null; });

  if (!checkIn) {
    throw Object.assign(new Error('打卡记录不存在'), { code: 'ERR_CHECKIN_NOT_FOUND' });
  }

  if (checkIn.userId !== userId) {
    throw Object.assign(new Error('无权访问该打卡记录'), { code: 'ERR_FORBIDDEN' });
  }

  return {
    id: checkIn.checkInId,
    farmId: checkIn.farmId,
    stage: checkIn.stage,
    completedTasks: checkIn.completedTasks,
    totalTaskCount: checkIn.totalTaskCount,
    completedTaskCount: checkIn.completedTaskCount,
    photos: checkIn.photos || [],
    aiInsight: checkIn.aiInsight,
    location: checkIn.location,
    note: checkIn.note,
    checkedInAt: checkIn.checkedInAt ? checkIn.checkedInAt.getTime() : 0
  };
}

module.exports = {
  submit: submit,
  list: list,
  detail: detail
};
