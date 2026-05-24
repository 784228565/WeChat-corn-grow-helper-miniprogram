/**
 * 统一响应格式工具
 * 确保前端收到的错误信息可直接用于 Toast 展示
 */

/**
 * 成功响应
 * @param {object} data - 业务数据
 * @param {string} requestId - 请求追踪 ID
 */
function success(data, requestId) {
  return {
    requestId,
    success: true,
    data,
  };
}

/**
 * 失败响应
 * @param {string} errCode - 机器可读错误码
 * @param {string} errMsg - 人类可读错误信息（可直接 Toast）
 * @param {string} action - 建议前端行为: retry | redirect | fallback | logout
 * @param {string} requestId - 请求追踪 ID
 */
function fail(errCode, errMsg, action, requestId) {
  return {
    requestId,
    success: false,
    error: {
      errCode,
      errMsg,
      action,
    },
  };
}

module.exports = {
  success,
  fail,
};
