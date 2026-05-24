// Absolute Path: C:\Users\78422\WeChatProjects\checkin\cloudfunctions\checkinManager\utils\validator.js
// Description: 参数校验工具

function validateFarmId(farmId) {
  if (!farmId || typeof farmId !== 'string') return '农场 ID 不能为空';
  if (!/^f_[a-f0-9]{8}$/.test(farmId)) return '农场 ID 格式不正确';
  return null;
}

function validateStage(stage) {
  if (!stage || typeof stage !== 'string') return '生长阶段不能为空';
  return null;
}

function validateCheckInId(checkInId) {
  if (!checkInId || typeof checkInId !== 'string') return '打卡 ID 不能为空';
  if (!/^c_[a-f0-9]{8}$/.test(checkInId)) return '打卡 ID 格式不正确';
  return null;
}

function validateTimestamp(timestamp) {
  if (typeof timestamp !== 'number' || timestamp <= 0) return 'timestamp 必须是正整数';
  return null;
}

function validatePagination(page, limit) {
  if (page !== undefined && (typeof page !== 'number' || page < 1)) return 'page 必须大于等于 1';
  if (limit !== undefined && (typeof limit !== 'number' || limit < 1 || limit > 50)) return 'limit 必须在 1~50 之间';
  return null;
}

module.exports = {
  validateFarmId: validateFarmId,
  validateStage: validateStage,
  validateCheckInId: validateCheckInId,
  validateTimestamp: validateTimestamp,
  validatePagination: validatePagination
};
