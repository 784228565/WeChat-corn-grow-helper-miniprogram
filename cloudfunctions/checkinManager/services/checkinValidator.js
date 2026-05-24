// Absolute Path: C:\Users\78422\WeChatProjects\checkin\cloudfunctions\checkinManager\services\checkinValidator.js
// Description: 打卡业务校验 — 检查任务完成状态

const cloud = require('wx-server-sdk');
const { COLLECTIONS } = require('../config');

const db = cloud.database();
const _ = db.command;

/**
 * 校验指定农场指定阶段的所有任务是否已完成
 * @param {string} farmId
 * @param {string} stage
 * @returns {Promise<object>} { allCompleted: boolean, completedTasks: [], totalTasks: [] }
 */
async function validateTasksCompleted(farmId, stage) {
  // 查询该阶段所有任务
  var allTasksRes = await db.collection(COLLECTIONS.TASKS)
    .where({ farmId: farmId, stage: stage })
    .orderBy('sortOrder', 'asc')
    .get();

  var allTasks = allTasksRes.data || [];

  if (allTasks.length === 0) {
    return {
      allCompleted: true,
      completedTasks: [],
      totalTasks: [],
      totalCount: 0,
      completedCount: 0
    };
  }

  var completedTasks = allTasks.filter(function(t) { return t.completed; });
  var allCompleted = completedTasks.length === allTasks.length;

  return {
    allCompleted: allCompleted,
    completedTasks: completedTasks.map(function(t) {
      return {
        taskId: t.id || t._id,
        name: t.name,
        category: t.category
      };
    }),
    totalTasks: allTasks,
    totalCount: allTasks.length,
    completedCount: completedTasks.length
  };
}

module.exports = {
  validateTasksCompleted: validateTasksCompleted
};
