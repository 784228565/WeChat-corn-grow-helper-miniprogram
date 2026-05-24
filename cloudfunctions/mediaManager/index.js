// 云函数入口：mediaManager

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
    var MediaService = require('./services/mediaService');

    var requestId = generateRequestId();
    var data = event.data || event || {};
    var action = data.action;

    console.log('[mediaManager] requestId=' + requestId + ', action=' + action);

    var userId;
    try {
      userId = Auth.getUserId(data);
      data.userId = userId;
    } catch (err) {
      return Response.fail(err.code || 'ERR_UNAUTHORIZED', err.message || '鉴权失败', 'logout', requestId);
    }

    try {
      switch (action) {
        case 'getTempUrls':
          return await handleGetTempUrls(data, requestId, Validator, MediaService, Response);
        case 'deleteFile':
          return await handleDeleteFile(data, requestId, Validator, MediaService, Response);
        case 'upload':
          return await handleUpload(data, requestId, Validator, MediaService, Response);
        case 'listByStage':
          return await handleListByStage(data, requestId, Validator, MediaService, Response);
        default:
          return Response.fail('ERR_INVALID_PARAM', '未知的操作类型：' + action, 'fallback', requestId);
      }
    } catch (err) {
      console.error('[mediaManager] unhandled error', err);
      return Response.fail('ERR_INTERNAL', '系统异常：' + err.message, 'fallback', requestId);
    }
  } catch (initErr) {
    console.error('[mediaManager] init require failed:', initErr);
    return {
      success: false,
      error: {
        errCode: 'ERR_INIT_FAILED',
        errMsg: '云函数初始化失败: ' + initErr.message
      }
    };
  }
};

async function handleGetTempUrls(data, requestId, Validator, MediaService, Response) {
  var fileIds = data.fileIds;

  var err = Validator.validateFileIds(fileIds);
  if (err) return Response.fail('ERR_INVALID_PARAM', err, 'fallback', requestId);

  var urls = await MediaService.getTempUrls(fileIds);
  return Response.success({ urls: urls }, requestId);
}

async function handleDeleteFile(data, requestId, Validator, MediaService, Response) {
  var fileId = data.fileId;

  var err = Validator.validateFileId(fileId);
  if (err) return Response.fail('ERR_INVALID_PARAM', err, 'fallback', requestId);

  await MediaService.deleteFile(fileId);
  return Response.success({ deleted: true }, requestId);
}

async function handleUpload(data, requestId, Validator, MediaService, Response) {
  var err = Validator.validateUploadParams(data);
  if (err) return Response.fail('ERR_INVALID_PARAM', err, 'fallback', requestId);

  // Step 1: 检查上传次数（每阶段最多2次）
  var count = await MediaService.getUploadCount(data.farmId, data.stage);
  if (count >= 2) {
    return Response.fail('ERR_UPLOAD_LIMIT_REACHED', '该阶段上传次数已达上限（最多2次）', 'fallback', requestId);
  }

  // Step 2: 记录上传
  var result = await MediaService.recordUpload(data.userId, data.farmId, data.stage, data.fileId, data.fileType);
  return Response.success({ record: result, remaining: 1 - count }, requestId);
}

async function handleListByStage(data, requestId, Validator, MediaService, Response) {
  var err = Validator.validateStageQuery(data);
  if (err) return Response.fail('ERR_INVALID_PARAM', err, 'fallback', requestId);

  var files = await MediaService.listByStage(data.farmId, data.stage);
  return Response.success({ files: files, count: files.length }, requestId);
}
