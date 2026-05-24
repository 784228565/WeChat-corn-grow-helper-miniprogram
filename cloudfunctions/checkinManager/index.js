// 云函数入口：checkinManager

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

function generateRequestId() {
  return 'req_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
}

exports.main = async function(event, context) {
  try {
    var Response = require('./utils/response');
    var Auth = require('./middleware/auth');
    var Validator = require('./utils/validator');
    var CheckinService = require('./services/checkinService');

    var requestId = generateRequestId();
    var data = event.data || event || {};
    var action = data.action;

    console.log('[checkinManager] requestId=' + requestId + ', action=' + action);

    var userId;
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
        case 'submit':
          return await handleSubmit(data, requestId, Validator, CheckinService, Response);
        case 'list':
          return await handleList(data, requestId, Validator, CheckinService, Response);
        case 'detail':
          return await handleDetail(data, requestId, Validator, CheckinService, Response);
        default:
          return Response.fail(
            'ERR_INVALID_PARAM',
            '未知的操作类型：' + action,
            'fallback',
            requestId
          );
      }
    } catch (err) {
      console.error('[checkinManager] unhandled error, requestId=' + requestId, err);
      return Response.fail(
        'ERR_INTERNAL',
        '系统异常：' + err.message,
        'fallback',
        requestId
      );
    }
  } catch (initErr) {
    console.error('[checkinManager] init require failed:', initErr);
    return {
      success: false,
      error: {
        errCode: 'ERR_INIT_FAILED',
        errMsg: '云函数初始化失败: ' + initErr.message
      }
    };
  }
};

async function handleSubmit(data, requestId, Validator, CheckinService, Response) {
  var farmId = data.farmId;
  var stage = data.stage;
  var timestamp = data.timestamp;
  var location = data.location;
  var note = data.note;
  var photos = data.photos;

  var err = Validator.validateFarmId(farmId);
  if (err) return Response.fail('ERR_INVALID_PARAM', err, 'fallback', requestId);
  err = Validator.validateStage(stage);
  if (err) return Response.fail('ERR_INVALID_PARAM', err, 'fallback', requestId);
  err = Validator.validateTimestamp(timestamp);
  if (err) return Response.fail('ERR_INVALID_PARAM', err, 'fallback', requestId);

  var result = await CheckinService.submit(
    data.userId, farmId, stage, timestamp, location, note, photos
  );
  return Response.success(result, requestId);
}

async function handleList(data, requestId, Validator, CheckinService, Response) {
  var farmId = data.farmId;
  var page = data.page;
  var limit = data.limit;
  var startDate = data.startDate;
  var endDate = data.endDate;

  var err = Validator.validateFarmId(farmId);
  if (err) return Response.fail('ERR_INVALID_PARAM', err, 'fallback', requestId);
  err = Validator.validatePagination(page, limit);
  if (err) return Response.fail('ERR_INVALID_PARAM', err, 'fallback', requestId);

  var result = await CheckinService.list(
    data.userId, farmId, page, limit, startDate, endDate
  );
  return Response.success(result, requestId);
}

async function handleDetail(data, requestId, Validator, CheckinService, Response) {
  var checkInId = data.checkInId;

  var err = Validator.validateCheckInId(checkInId);
  if (err) return Response.fail('ERR_INVALID_PARAM', err, 'fallback', requestId);

  var result = await CheckinService.detail(data.userId, checkInId);
  return Response.success({ log: result }, requestId);
}
