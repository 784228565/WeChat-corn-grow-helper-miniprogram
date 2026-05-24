/**
 * 微信鉴权服务层
 *
 * 在微信云开发环境下，云函数可直接通过 cloud.getWXContext() 获取调用者 openid，
 * 无需调用 wx.login / jscode2session，也无需管理 AppSecret。
 */

const cloud = require('wx-server-sdk');

/**
 * 获取当前调用者的微信身份信息
 * @returns {{openid: string, unionid?: string}}
 */
function getCallerIdentity() {
  const wxContext = cloud.getWXContext();

  if (!wxContext.OPENID) {
    throw new Error('无法获取调用者 openid，请确认已开通云开发');
  }

  return {
    openid: wxContext.OPENID,
    unionid: wxContext.UNIONID || undefined,
  };
}

module.exports = {
  getCallerIdentity,
};
