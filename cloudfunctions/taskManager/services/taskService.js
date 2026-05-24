// Absolute Path: C:\Users\78422\WeChatProjects\checkin\cloudfunctions\taskManager\services\taskService.js
// Description: 任务服务层 — 任务CRUD + 模板初始化
// 关键设计：
// - 懒加载初始化：首次获取某阶段任务时，自动从 TaskTemplates 复制创建
// - 并发防护：使用 count() 判断后再批量插入，避免重复创建
// - 幂等性：toggleTask 重复调用返回相同结果

const cloud = require('wx-server-sdk');
const { COLLECTIONS, DEFAULT_TASK_TEMPLATES } = require('../config');
const Auth = require('../middleware/auth');

const db = cloud.database();
const _ = db.command;

/**
 * 生成任务 ID
 */
function generateTaskId() {
  return 't_' + require('crypto').randomBytes(4).toString('hex');
}

/**
 * 获取任务列表
 * @param {string} userId
 * @param {string} farmId
 * @param {string} stage
 * @returns {Promise<object[]>} 任务列表
 */
async function getTasks(userId, farmId, stage) {
  // 校验农场归属
  var farm = await Auth.checkFarmOwnership(userId, farmId);

  // Step 1: 查询该农场该阶段是否已有任务
  var existingRes = await db.collection(COLLECTIONS.TASKS)
    .where({ farmId: farmId, stage: stage })
    .orderBy('sortOrder', 'asc')
    .get();

  var tasks = existingRes.data || [];

  // Step 2: 若无任务，从模板初始化
  if (tasks.length === 0) {
    // 并发防护：再次 count 确认（双重检查）
    var countRes = await db.collection(COLLECTIONS.TASKS)
      .where({ farmId: farmId, stage: stage })
      .count();

    if (countRes.total === 0) {
      // 查询对应作物类型的模板
      var templateRes = await db.collection(COLLECTIONS.TASK_TEMPLATES)
        .where({ cropType: farm.cropType, stage: stage })
        .orderBy('sortOrder', 'asc')
        .get();

      var templates = templateRes.data || [];

      // 若数据库无模板，使用内存默认模板兜底
      if (templates.length === 0) {
        templates = DEFAULT_TASK_TEMPLATES.filter(function(t) {
          return t.cropType === farm.cropType && t.stage === stage;
        });
      }

      // 批量创建任务实例（使用确定性 _id 防并发重复写入）
      if (templates.length > 0) {
        var now = new Date();
        var batchTasks = templates.map(function(tpl) {
          var taskId = farmId + '_' + stage + '_' + tpl.sortOrder;
          return {
            _id: taskId,
            id: taskId,
            farmId: farmId,
            stage: stage,
            userId: userId,
            name: tpl.name,
            description: tpl.description,
            category: tpl.category,
            completed: false,
            completedAt: null,
            sortOrder: tpl.sortOrder,
            createdAt: now,
            updatedAt: now
          };
        });

        // 批量写入（云开发批量添加限制：每次最多100条）
        for (var i = 0; i < batchTasks.length; i++) {
          try {
            await db.collection(COLLECTIONS.TASKS).add({ data: batchTasks[i] });
          } catch (err) {
            if (err.errCode === -502001 || (err.message && err.message.indexOf('_id_') > -1)) {
              console.log('[taskService] task already exists:', batchTasks[i]._id);
            } else {
              throw err;
            }
          }
        }

        tasks = batchTasks;
      }
    }
  }

  // 格式化输出（隐藏内部字段，description 映射为 meta 供前端展示）
  return tasks.map(function(task) {
    return {
      id: task.id || task._id,
      name: task.name,
      description: task.description,
      meta: task.description || '',
      category: task.category,
      completed: !!task.completed,
      completedAt: task.completedAt || null,
      sortOrder: task.sortOrder
    };
  });
}

/**
 * 切换任务完成状态
 * @param {string} userId
 * @param {string} farmId
 * @param {string} taskId
 * @param {boolean} completed
 * @param {number} timestamp
 * @returns {Promise<object>} 更新后的任务
 */
async function toggleTask(userId, farmId, taskId, completed, timestamp) {
  // 校验农场归属
  await Auth.checkFarmOwnership(userId, farmId);

  // 查询任务
  var taskRes = await db.collection(COLLECTIONS.TASKS).doc(taskId).get()
    .then(function(res) { return res.data; })
    .catch(function() { return null; });

  if (!taskRes) {
    throw Object.assign(new Error('任务不存在'), { code: 'ERR_TASK_NOT_FOUND' });
  }

  // 校验任务归属
  if (taskRes.farmId !== farmId || taskRes.userId !== userId) {
    throw Object.assign(new Error('无权操作该任务'), { code: 'ERR_FORBIDDEN' });
  }

  var now = new Date();
  var updateData = {
    completed: completed,
    completedAt: completed ? timestamp : null,
    updatedAt: now
  };

  await db.collection(COLLECTIONS.TASKS).doc(taskId).update({
    data: updateData
  });

  return {
    id: taskRes.id || taskRes._id,
    name: taskRes.name,
    description: taskRes.description,
    category: taskRes.category,
    completed: completed,
    completedAt: completed ? timestamp : null,
    sortOrder: taskRes.sortOrder
  };
}

module.exports = {
  getTasks: getTasks,
  toggleTask: toggleTask
};
