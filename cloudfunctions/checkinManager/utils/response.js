// Absolute Path: C:\Users\78422\WeChatProjects\checkin\cloudfunctions\checkinManager\utils\response.js
// Description: 统一响应格式工具

function success(data, requestId) {
  return {
    requestId: requestId,
    success: true,
    data: data
  };
}

function fail(errCode, errMsg, action, requestId) {
  return {
    requestId: requestId,
    success: false,
    error: {
      errCode: errCode,
      errMsg: errMsg,
      action: action
    }
  };
}

module.exports = {
  success: success,
  fail: fail
};
