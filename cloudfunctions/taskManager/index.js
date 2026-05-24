// 云函数入口：taskManager

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
    var TaskService = require('./services/taskService');
    var InsightService = require('./services/insightService');

    var requestId = generateRequestId();
    var data = event.data || event || {};
    var action = data.action;

    console.log('[taskManager] requestId=' + requestId + ', action=' + action);

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
        case 'getTasks':
          return await handleGetTasks(data, requestId, Validator, TaskService, Response);
        case 'toggleTask':
          return await handleToggleTask(data, requestId, Validator, TaskService, Response);
        case 'getInsight':
          return await handleGetInsight(data, requestId, Validator, InsightService, Response);
        default:
          return Response.fail(
            'ERR_INVALID_PARAM',
            '未知的操作类型：' + action,
            'fallback',
            requestId
          );
      }
    } catch (err) {
      console.error('[taskManager] unhandled error, requestId=' + requestId, err);
      return Response.fail(
        'ERR_INTERNAL',
        '系统异常：' + err.message,
        'fallback',
        requestId
      );
    }
  } catch (initErr) {
    console.error('[taskManager] init require failed:', initErr);
    return {
      success: false,
      error: {
        errCode: 'ERR_INIT_FAILED',
        errMsg: '云函数初始化失败: ' + initErr.message
      }
    };
  }
};

async function handleGetTasks(data, requestId, Validator, TaskService, Response) {
  var farmId = data.farmId;
  var stage = data.stage;
  var err = Validator.validateFarmId(farmId);
  if (err) return Response.fail('ERR_INVALID_PARAM', err, 'fallback', requestId);
  err = Validator.validateStage(stage);
  if (err) return Response.fail('ERR_INVALID_PARAM', err, 'fallback', requestId);
  var tasks = await TaskService.getTasks(data.userId, farmId, stage);
  return Response.success({ tasks: tasks }, requestId);
}

async function handleToggleTask(data, requestId, Validator, TaskService, Response) {
  var farmId = data.farmId;
  var taskId = data.taskId;
  var completed = data.completed;
  var timestamp = data.timestamp;
  var err = Validator.validateFarmId(farmId);
  if (err) return Response.fail('ERR_INVALID_PARAM', err, 'fallback', requestId);
  err = Validator.validateTaskId(taskId);
  if (err) return Response.fail('ERR_INVALID_PARAM', err, 'fallback', requestId);
  err = Validator.validateCompleted(completed);
  if (err) return Response.fail('ERR_INVALID_PARAM', err, 'fallback', requestId);
  err = Validator.validateTimestamp(timestamp);
  if (err) return Response.fail('ERR_INVALID_PARAM', err, 'fallback', requestId);
  var updatedTask = await TaskService.toggleTask(data.userId, farmId, taskId, completed, timestamp);
  return Response.success({ updatedTask: updatedTask }, requestId);
}

async function handleGetInsight(data, requestId, Validator, InsightService, Response) {
  var farmId = data.farmId;
  var location = data.location || '';
  var currentStage = data.currentStage;
  var pendingTasks = data.pendingTasks || [];
  var err = Validator.validateFarmId(farmId);
  if (err) return Response.fail('ERR_INVALID_PARAM', err, 'fallback', requestId);
  err = Validator.validateStage(currentStage);
  if (err) return Response.fail('ERR_INVALID_PARAM', err, 'fallback', requestId);
  var insight = await InsightService.getInsight(data.userId, farmId, location, currentStage, pendingTasks);
  return Response.success({ insight: insight }, requestId);
}
