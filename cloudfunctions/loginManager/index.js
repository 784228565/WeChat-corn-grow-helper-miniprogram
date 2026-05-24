/**
 * 云函数入口：loginManager
 */

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

function generateRequestId() {
  return 'req_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
}

exports.main = async (event, context) => {
  try {
    var Response = require('./utils/response');
    var LoginHandler = require('./handlers/login');
    var TokenService = require('./services/tokenService');
    var Config = require('./config');

    const requestId = generateRequestId();
    const data = event.data || event || {};
    const action = data.action || 'login';

    console.log(`[loginManager] requestId=${requestId}, action=${action}`);

    // 自动初始化配置表
    try {
      const db = cloud.database();
      await db.collection(Config.COLLECTIONS.SYS_CONFIG).doc('auth').get();
    } catch (e) {
      try {
        const db = cloud.database();
        await db.collection(Config.COLLECTIONS.SYS_CONFIG).add({
          data: {
            _id: 'auth',
            tokenSecret: Config.LOCAL_TOKEN_SECRET,
            updatedAt: new Date(),
          }
        });
        console.log('[initConfig] sys_config/auth 已创建');
      } catch (addErr) {}
    }

    try {
      switch (action) {
        case 'login': {
          return await LoginHandler.handle(data, context, requestId);
        }

        case 'verify': {
          const payload = await TokenService.verifyToken(data.token);
          if (!payload) {
            return Response.fail(
              'ERR_UNAUTHORIZED',
              '登录已过期，请重新登录',
              'logout',
              requestId
            );
          }
          return Response.success(
            { valid: true, userId: payload.userId, exp: payload.exp },
            requestId
          );
        }

        case 'refresh': {
          const payload = await TokenService.verifyToken(data.token);
          if (!payload) {
            return Response.fail(
              'ERR_UNAUTHORIZED',
              '登录已过期，请重新登录',
              'logout',
              requestId
            );
          }

          const openid = await TokenService.extractOpenid(payload);
          const newToken = await TokenService.issueToken(payload.userId, openid);

          const UserService = require('./services/userService');
          await UserService.updateLoginInfo(openid, {
            sourceIp: cloud.getWXContext().CLIENTIP || '',
            token: newToken.token,
            expiresAt: newToken.expiresAt,
          });

          return Response.success(
            { token: newToken.token, expiresIn: newToken.expiresIn },
            requestId
          );
        }

        default: {
          return Response.fail(
            'ERR_INVALID_PARAM',
            '未知的操作类型：' + action,
            'fallback',
            requestId
          );
        }
      }
    } catch (err) {
      console.error(`[loginManager] unhandled error, requestId=${requestId}`, err);
      return Response.fail(
        'ERR_INTERNAL',
        '系统异常：' + err.message,
        'fallback',
        requestId
      );
    }
  } catch (initErr) {
    console.error('[loginManager] init require failed:', initErr);
    return {
      success: false,
      error: {
        errCode: 'ERR_INIT_FAILED',
        errMsg: '云函数初始化失败: ' + initErr.message
      }
    };
  }
};
