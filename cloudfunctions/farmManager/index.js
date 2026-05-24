/**
 * 云函数入口：farmManager
 */

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  try {
    const Response = require('./utils/response');
    const Auth = require('./middleware/auth');
    const ListCtrl = require('./controllers/list');
    const SwitchCtrl = require('./controllers/switch');
    const CreateCtrl = require('./controllers/create');
    const DetailCtrl = require('./controllers/detail');

    const requestId = 'req_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
    const data = event.data || event || {};
    const action = data.action;

    console.log('[farmManager] requestId=' + requestId + ', action=' + action);

    let userId;
    try {
      userId = Auth.getUserId(data);
      data.userId = userId;
    } catch (err) {
      return Response.fail(
        err.code || 'ERR_UNAUTHORIZED',
        err.message || '鉴权失败',
        'logout',
        requestId
      );
    }

    try {
      switch (action) {
        case 'list':
          return await ListCtrl.handle(data, requestId);
        case 'switch':
          return await SwitchCtrl.handle(data, requestId);
        case 'create':
          return await CreateCtrl.handle(data, requestId);
        case 'detail':
          return await DetailCtrl.handle(data, requestId);
        default:
          return Response.fail(
            'ERR_INVALID_PARAM',
            '未知的操作类型：' + action,
            'fallback',
            requestId
          );
      }
    } catch (err) {
      console.error('[farmManager] unhandled error, requestId=' + requestId, err);
      return Response.fail(
        'ERR_INTERNAL',
        '系统异常：' + err.message,
        'fallback',
        requestId
      );
    }
  } catch (initErr) {
    console.error('[farmManager] init require failed:', initErr);
    return {
      success: false,
      error: {
        errCode: 'ERR_INIT_FAILED',
        errMsg: '云函数初始化失败: ' + initErr.message
      }
    };
  }
};
