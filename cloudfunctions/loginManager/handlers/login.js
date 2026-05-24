/**
 * 登录 Controller
 */

const cloud = require('wx-server-sdk');
const Response = require('../utils/response');
const WechatAuth = require('../services/wechatAuth');
const UserService = require('../services/userService');
const TokenService = require('../services/tokenService');
const { DEFAULT_PROFILE } = require('../config');

async function handle(event, context, requestId) {
  const { userInfo } = event;
  const wxContext = cloud.getWXContext();
  const sourceIp = wxContext.CLIENTIP || '';

  try {
    const { openid, unionid } = WechatAuth.getCallerIdentity();

    let existing = await UserService.findByOpenid(openid);
    let userId;
    let isNewUser = false;
    let tokenResult;

    if (existing) {
      userId = existing.userId;
      tokenResult = await TokenService.issueToken(userId, openid);
      await UserService.updateLoginInfo(openid, {
        sourceIp,
        token: tokenResult.token,
        expiresAt: tokenResult.expiresAt,
      });
    } else {
      userId = require('../utils/crypto').generateUserId();
      isNewUser = true;
      tokenResult = await TokenService.issueToken(userId, openid);
      const profile = UserService.buildProfile(userInfo);
      await UserService.createUser({
        openid,
        unionid,
        userId,
        profile,
        sourceIp,
        token: tokenResult.token,
        expiresAt: tokenResult.expiresAt,
      });
    }

    const avatarUrl = existing
      ? (existing.profile && existing.profile.avatarUrl) || DEFAULT_PROFILE.avatarUrl
      : profile.avatarUrl || DEFAULT_PROFILE.avatarUrl;

    return Response.success(
      {
        userId,
        token: tokenResult.token,
        isNewUser,
        expiresIn: tokenResult.expiresIn,
        avatarUrl,
      },
      requestId
    );
  } catch (err) {
    console.error(`[login] requestId=${requestId}, error=${err.message}`);
    return Response.fail(
      'ERR_INTERNAL',
      '登录失败：' + err.message,
      'fallback',
      requestId
    );
  }
}

module.exports = { handle };
