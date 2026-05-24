// 云函数入口：aiAssistant

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

function generateRequestId() {
  return 'req_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
}

exports.main = async function(event, context) {
  try {
    var Config = require('./config');
    var Token = require('./utils/token');

    // 优先从云数据库读取 tokenSecret，与 loginManager 保持一致
    var tokenSecret = await Config.getTokenSecret();
    Token.setTokenSecret(tokenSecret);

    var Response = require('./utils/response');
    var Auth = require('./middleware/auth');
    var Validator = require('./utils/validator');
    var AiService = require('./services/aiService');

    var requestId = generateRequestId();
    var data = event.data || event || {};
    var action = data.action;

    console.log('[aiAssistant] requestId=' + requestId + ', action=' + action);
    console.log('[aiAssistant] data keys:', Object.keys(data).join(','));

    var userId;
    try {
      userId = Auth.getUserId(data);
      data.userId = userId;
    } catch (err) {
      return Response.fail(err.code || 'ERR_UNAUTHORIZED', err.message || '鉴权失败', 'logout', requestId);
    }

    try {
      switch (action) {
        case 'chat':
          return await handleChat(data, requestId, Validator, AiService, Response);
        case 'getSuggestions':
          return await handleGetSuggestions(data, requestId, Validator, AiService, Response);
        case 'clearHistory':
          return await handleClearHistory(data, requestId, Validator, AiService, Response);
        default:
          return Response.fail('ERR_INVALID_PARAM', '未知的操作类型：' + action, 'fallback', requestId);
      }
    } catch (err) {
      console.error('[aiAssistant] unhandled error', err);
      var errCode = err.code || 'ERR_INTERNAL';
      return Response.fail(errCode, err.message || '系统异常', 'fallback', requestId);
    }
  } catch (initErr) {
    console.error('[aiAssistant] init require failed:', initErr);
    return {
      success: false,
      error: {
        errCode: 'ERR_INIT_FAILED',
        errMsg: '云函数初始化失败: ' + initErr.message
      }
    };
  }
};

async function handleChat(data, requestId, Validator, AiService, Response) {
  var farmId = data.farmId;
  var message = data.message;
  var context = data.context || {};

  var err = Validator.validateFarmId(farmId);
  if (err) return Response.fail('ERR_INVALID_PARAM', err, 'fallback', requestId);
  err = Validator.validateMessage(message);
  if (err) return Response.fail('ERR_INVALID_PARAM', err, 'fallback', requestId);

  var reply = await AiService.chat(data.userId, farmId, message, context);
  return Response.success({ reply: reply }, requestId);
}

async function handleGetSuggestions(data, requestId, Validator, AiService, Response) {
  var farmId = data.farmId;
  var currentStage = data.currentStage;

  var err = Validator.validateFarmId(farmId);
  if (err) return Response.fail('ERR_INVALID_PARAM', err, 'fallback', requestId);

  var suggestions = await AiService.getSuggestions(data.userId, farmId, currentStage);
  return Response.success({ suggestions: suggestions }, requestId);
}

async function handleClearHistory(data, requestId, Validator, AiService, Response) {
  var farmId = data.farmId;

  var err = Validator.validateFarmId(farmId);
  if (err) return Response.fail('ERR_INVALID_PARAM', err, 'fallback', requestId);

  var result = await AiService.clearChatHistory(data.userId, farmId);
  return Response.success(result, requestId);
}
