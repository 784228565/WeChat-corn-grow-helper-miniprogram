// Absolute Path: C:\Users\78422\WeChatProjects\checkin\cloudfunctions\aiAssistant\services\aiService.js
// Description: AI 对话服务层
// 关键设计：
// - 优先调用腾讯元器(Yuanqi)智能体 API，获取真实 AI 回复
// - 元器 API 调用失败时，降级到本地关键词兜底回复
// - 回复附带 chips（相关标签）

const { AI_FALLBACKS, STAGE_SUGGESTIONS, DEFAULT_SUGGESTIONS } = require('../config');
const Auth = require('../middleware/auth');
const YuanqiService = require('./yuanqiService');

/**
 * 解析用户消息中的关键词类型
 */
function detectQuestionType(message) {
  var msg = message.toLowerCase();
  if (msg.indexOf('pest') >= 0 || msg.indexOf('bug') >= 0 || msg.indexOf('insect') >= 0 || msg.indexOf('worm') >= 0 || msg.indexOf('害虫') >= 0 || msg.indexOf('虫') >= 0) {
    return 'pest';
  }
  if (msg.indexOf('weather') >= 0 || msg.indexOf('rain') >= 0 || msg.indexOf('temperature') >= 0 || msg.indexOf('天气') >= 0 || msg.indexOf('雨') >= 0) {
    return 'weather';
  }
  if (msg.indexOf('weed') >= 0 || msg.indexOf('herbicide') >= 0 || msg.indexOf('草') >= 0 || msg.indexOf('杂草') >= 0) {
    return 'weed';
  }
  if (msg.indexOf('growth') >= 0 || msg.indexOf('stage') >= 0 || msg.indexOf('develop') >= 0 || msg.indexOf('生长') >= 0 || msg.indexOf('阶段') >= 0) {
    return 'growth';
  }
  if (msg.indexOf('nutrient') >= 0 || msg.indexOf('fertilizer') >= 0 || msg.indexOf('nitrogen') >= 0 || msg.indexOf('营养') >= 0 || msg.indexOf('肥料') >= 0) {
    return 'nutrient';
  }
  return 'default';
}

/**
 * 构建 chips
 */
function buildChips(stage, questionType) {
  var chips = [];
  if (stage) {
    chips.push({ label: stage + ' STAGE', value: stage });
  }
  var typeLabels = {
    pest: 'PEST CONTROL',
    weather: 'WEATHER',
    weed: 'WEED MGMT',
    growth: 'GROWTH',
    nutrient: 'NUTRITION'
  };
  if (typeLabels[questionType]) {
    chips.push({ label: typeLabels[questionType], value: questionType });
  }
  return chips;
}

/**
 * AI 对话 — 优先调用元器智能体，失败时降级到本地兜底
 */
async function chat(userId, farmId, message, context) {
  // 校验农场归属
  var farm;
  try {
    farm = await Auth.checkFarmOwnership(userId, farmId);
  } catch (err) {
    console.error('[aiService] farm auth failed:', err.message);
    throw Object.assign(new Error('农场验证失败：' + err.message), { code: err.code || 'ERR_FARM_AUTH' });
  }

  var cropType = farm.cropType || 'corn';
  var stage = (context && context.currentStage) || farm.currentStage || 'V2';
  var questionType = detectQuestionType(message);

  // 构建传给元器的上下文
  var yuanqiContext = Object.assign({}, context || {}, {
    cropType: cropType,
    currentStage: stage,
    farmName: farm.name,
    location: farm.location && farm.location.address ? farm.location.address : '',
    accumulatedTemp: farm.accumulatedTemp || '',
    soilType: farm.soilType || '',
    irrigation: farm.irrigation || ''
  });

  var aiContent;
  var aiSteps = [];
  var source = 'yuanqi';
  var yuanqiErrMsg = '';

  try {
    // 优先调用腾讯元器智能体
    var yuanqiResult = await YuanqiService.chat(userId, farmId, message, yuanqiContext);
    aiContent = yuanqiResult.content;
    aiSteps = yuanqiResult.steps || [];
  } catch (err) {
    console.warn('[aiService] Yuanqi API failed, falling back to local:', err.message);
    yuanqiErrMsg = err.message;
    source = 'fallback';

    // 降级到本地关键词兜底回复
    var cropData = AI_FALLBACKS[cropType] || AI_FALLBACKS['corn'];
    var stageData = cropData[stage] || cropData['V2'];
    aiContent = stageData[questionType] || stageData['default'];

    // 个性化前缀
    if (context && context.location) {
      aiContent = 'Based on your farm in ' + context.location + ', ' + aiContent;
    }

    // 如果兜底回复也拿不到，说明有严重问题
    if (!aiContent) {
      throw Object.assign(
        new Error('元器调用失败且兜底回复不可用: ' + yuanqiErrMsg),
        { code: 'ERR_AI_UNAVAILABLE', detail: yuanqiErrMsg }
      );
    }
  }

  var reply = {
    content: aiContent,
    chips: buildChips(stage, questionType),
    relatedTasks: getRelatedTasks(questionType, stage),
    source: source,
    steps: aiSteps
  };

  return reply;
}

/**
 * 获取相关问题类型对应的推荐任务
 */
function getRelatedTasks(questionType, stage) {
  var taskMap = {
    pest: ['Pest Scouting', 'Inspect leaves for damage'],
    weather: ['Soil Moisture Check', 'Drainage inspection'],
    weed: ['Weed Assessment', 'Herbicide application'],
    growth: ['Plant height measurement', 'Stage verification'],
    nutrient: ['Nutrient Assessment', 'Fertilizer application']
  };
  return taskMap[questionType] || [];
}

/**
 * 获取快捷问题推荐
 */
async function getSuggestions(userId, farmId, currentStage) {
  await Auth.checkFarmOwnership(userId, farmId);

  var stage = currentStage || 'V2';
  var suggestions = STAGE_SUGGESTIONS[stage] || DEFAULT_SUGGESTIONS;

  return suggestions;
}

/**
 * 清空对话历史
 */
async function clearChatHistory(userId, farmId) {
  await YuanqiService.clearHistory(userId, farmId);
  return { cleared: true };
}

module.exports = {
  chat: chat,
  getSuggestions: getSuggestions,
  clearChatHistory: clearChatHistory
};
