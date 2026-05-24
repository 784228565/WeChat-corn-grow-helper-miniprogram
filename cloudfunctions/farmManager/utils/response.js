/**
 * 统一响应格式工具
 */

function success(data, requestId) {
  return {
    requestId,
    success: true,
    data,
  };
}

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
