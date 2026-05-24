// Absolute Path: C:\Users\78422\WeChatProjects\checkin\cloudfunctions\taskManager\utils\validator.js
// Description: 参数校验工具

const { SUPPORTED_CROPS, CORN_STAGES } = require('../config');

function validateFarmId(farmId) {
  if (!farmId || typeof farmId !== 'string') return '农场 ID 不能为空';
  if (!/^f_[a-f0-9]{8}$/.test(farmId)) return '农场 ID 格式不正确';
  return null;
}

function validateStage(stage) {
  if (!stage || typeof stage !== 'string') return '生长阶段不能为空';
  if (!CORN_STAGES.includes(stage)) return '不支持的生长阶段: ' + stage;
  return null;
}

function validateTaskId(taskId) {
  if (!taskId || typeof taskId !== 'string') return '任务 ID 不能为空';
  if (!/^t_[a-f0-9]{8}$/.test(taskId)) return '任务 ID 格式不正确';
  return null;
}

function validateCompleted(completed) {
  if (typeof completed !== 'boolean') return 'completed 必须是布尔值';
  return null;
}

function validateTimestamp(timestamp) {
  if (typeof timestamp !== 'number' || timestamp <= 0) return 'timestamp 必须是正整数';
  return null;
}

module.exports = {
  validateFarmId: validateFarmId,
  validateStage: validateStage,
  validateTaskId: validateTaskId,
  validateCompleted: validateCompleted,
  validateTimestamp: validateTimestamp
};
