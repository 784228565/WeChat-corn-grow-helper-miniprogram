// Absolute Path: C:\Users\78422\WeChatProjects\checkin\cloudfunctions\aiAssistant\utils\validator.js
// Description: 参数校验工具

function validateFarmId(farmId) {
  if (!farmId || typeof farmId !== 'string') return '农场 ID 不能为空';
  if (!/^f_[a-f0-9]{8}$/.test(farmId)) return '农场 ID 格式不正确';
  return null;
}

function validateMessage(message) {
  if (!message || typeof message !== 'string') return '消息内容不能为空';
  if (message.length > 500) return '消息内容不能超过 500 字符';
  return null;
}

function validateStage(stage) {
  if (!stage || typeof stage !== 'string') return null; // stage 可选
  return null;
}

module.exports = {
  validateFarmId: validateFarmId,
  validateMessage: validateMessage,
  validateStage: validateStage
};
