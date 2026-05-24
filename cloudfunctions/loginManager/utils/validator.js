/**
 * 参数校验工具
 * 防御非法输入，避免特殊字符注入数据库
 */

const Response = require('./response');

/**
 * 校验登录入参
 * @param {object} event - 云函数 event 对象
 * @param {string} requestId - 请求 ID
 */
function validateLoginInput(event, requestId) {
  // code 必须存在
  if (!event.code) {
    return Response.fail(
      'ERR_INVALID_PARAM',
      '登录凭证缺失，请重新调用 wx.login',
      'retry',
      requestId
    );
  }

  // code 格式校验：微信 code 为 32 位字母数字混合字符串
  const CODE_PATTERN = /^[a-zA-Z0-9]{32}$/;
  if (!CODE_PATTERN.test(event.code)) {
    return Response.fail(
      'ERR_INVALID_PARAM',
      '登录凭证格式不正确',
      'retry',
      requestId
    );
  }

  // userInfo 若存在则校验结构
  if (event.userInfo) {
    const { nickName, avatarUrl, gender } = event.userInfo;
    if (nickName && typeof nickName !== 'string') {
      return Response.fail(
        'ERR_INVALID_PARAM',
        '昵称格式不正确',
        'fallback',
        requestId
      );
    }
    if (avatarUrl && typeof avatarUrl !== 'string') {
      return Response.fail(
        'ERR_INVALID_PARAM',
        '头像地址格式不正确',
        'fallback',
        requestId
      );
    }
    if (gender !== undefined && ![0, 1, 2].includes(gender)) {
      return Response.fail(
        'ERR_INVALID_PARAM',
        '性别参数不正确',
        'fallback',
        requestId
      );
    }
  }

  // 校验通过返回 null
  return null;
}

module.exports = {
  validateLoginInput,
};
