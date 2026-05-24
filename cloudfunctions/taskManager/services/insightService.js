// Absolute Path: C:\Users\78422\WeChatProjects\checkin\cloudfunctions\taskManager\services\insightService.js
// Description: AI 农事建议服务层
// 关键设计：
// - 本轮采用预置兜底数据策略，外部 AI API 接入标记为 TODO
// - 根据 farm.cropType + currentStage 返回结构化建议
// - 支持 pendingTasks 影响 priorityTask 推荐

const { PREBUILT_INSIGHTS } = require('../config');
const Auth = require('../middleware/auth');

/**
 * 获取 AI 农事建议
 * @param {string} userId
 * @param {string} farmId
 * @param {string} location
 * @param {string} currentStage
 * @param {string[]} pendingTasks
 * @returns {Promise<object>} 结构化建议
 */
async function getInsight(userId, farmId, location, currentStage, pendingTasks) {
  // 校验农场归属
  var farm = await Auth.checkFarmOwnership(userId, farmId);

  // Step 1: 从预置数据获取阶段建议
  var cropInsights = PREBUILT_INSIGHTS[farm.cropType] || {};
  var stageInsight = cropInsights[currentStage] || {};

  // Step 2: 组装返回结构
  var insight = {
    title: stageInsight.title || (currentStage + ' 阶段指导'),
    content: stageInsight.content || ('请在 ' + currentStage + ' 阶段持续监测您的 ' + farm.cropType + ' 作物生长情况。'),
    priorityTask: stageInsight.priorityTask || null,
    weatherAlert: stageInsight.weatherAlert || null,
    generatedAt: Date.now()
  };

  // Step 3: 若 pendingTasks 中包含 priorityTask，提升建议紧迫性
  if (insight.priorityTask && pendingTasks && pendingTasks.length > 0) {
    var isPending = pendingTasks.some(function(taskName) {
      return taskName.indexOf(insight.priorityTask) >= 0 || insight.priorityTask.indexOf(taskName) >= 0;
    });
    if (isPending) {
      insight.content = '【优先处理】' + insight.content + ' 建议今日完成：' + insight.priorityTask + '。';
    }
  }

  // TODO: 外部 AI API 接入点
  // 未来可在此调用天气 API + LLM，生成动态建议
  // const aiResponse = await callExternalAI({ location, currentStage, cropType: farm.cropType, pendingTasks });
  // if (aiResponse) { insight = aiResponse; }

  return insight;
}

module.exports = {
  getInsight: getInsight
};
