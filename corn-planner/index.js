var SCENARIOS = require('../utils/scenarios');
var CALENDARS = require('../utils/scenarioCalendars');

/**
 * 根据农场条件匹配最佳种植方案
 */
function matchScenario(temp, soil, irrigation) {
  var tempLevel = temp < 2700 ? '低积温' : (temp < 2900 ? '中积温' : '高积温');
  var soilValue = soil === '泥土地' ? '粘土' : soil;
  return SCENARIOS.find(function(s) {
    return s.temp === tempLevel && s.soil === soilValue && s.irrigation === irrigation;
  });
}

/**
 * 生成方案摘要（用于展示）
 */
function getPlanSummary(farm, scenario) {
  return {
    tempRange: scenario.temp_range,
    soil: farm.soilType || '',
    irrigation: farm.irrigation || '',
    variety: farm.planting ? farm.planting.variety : '',
    density: farm.planting ? farm.planting.density : 0,
    rowSpacing: farm.planting ? farm.planting.rowSpacing : '',
    targetYield: scenario.target_yield,
    specialNotes: scenario.special_notes
  };
}

/**
 * ================================================================
 * 核心：为农场生成完整节点日历
 * ================================================================
 * 每个节点 = 一个打卡点，包含标题、日期、操作清单、时间理由
 * 节点数因方案而异（19~22个）
 * ================================================================
 */
function generateNodeCalendar(farm) {
  var scenario = matchScenario(farm.accumulatedTemp, farm.soilType, farm.irrigation);
  if (!scenario) {
    console.warn('[corn-planner] no scenario matched for', farm.accumulatedTemp, farm.soilType, farm.irrigation);
    return null;
  }

  var calendarData = CALENDARS[String(scenario.id)];
  if (!calendarData) {
    console.warn('[corn-planner] no calendar data for scenario id', scenario.id);
    return null;
  }

  // 深拷贝节点数组，避免修改原始数据
  var nodes = JSON.parse(JSON.stringify(calendarData.nodes));

  // 为每个节点的 details 生成可勾选的 task 结构
  nodes.forEach(function(node, i) {
    node.tasks = node.details.map(function(detail, j) {
      return {
        id: node.id + '_t' + j,
        name: detail,
        meta: node.date,
        completed: false
      };
    });
  });

  return {
    scenarioId: scenario.id,
    temp: scenario.temp,
    soil: scenario.soil,
    irrigation: scenario.irrigation,
    targetYield: calendarData.targetYield,
    sowingDate: calendarData.sowingDate,
    nodes: nodes
  };
}

/**
 * 计算节点状态（相对于当前日期）
 * @param {string} targetDate - MM-DD 格式
 * @param {Date} now - 当前日期
 * @returns {string} 'readable' | 'checkable' | 'expired'
 */
function computeNodeStatus(targetDate, now) {
  if (!targetDate) return 'readable';
  var year = now.getFullYear();
  var parts = targetDate.split('-');
  var month = parseInt(parts[0], 10);
  var day = parseInt(parts[1], 10);
  var target = new Date(year, month - 1, day, 0, 0, 0, 0);

  var diffMs = now.getTime() - target.getTime();
  var diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < -2) return 'readable';
  if (diffDays <= 2) return 'checkable';
  return 'expired';
}

/**
 * 找到最佳展示节点
 * 优先级：可打卡 > 最近过期 > 第一个
 */
function findBestNode(calendar, now) {
  if (!calendar || !calendar.nodes || calendar.nodes.length === 0) return 0;
  var nodes = calendar.nodes;

  // 优先找可打卡节点
  for (var i = 0; i < nodes.length; i++) {
    if (computeNodeStatus(nodes[i].targetDate, now) === 'checkable') {
      return i;
    }
  }
  // 其次找最近过期节点
  for (var j = nodes.length - 1; j >= 0; j--) {
    if (computeNodeStatus(nodes[j].targetDate, now) === 'expired') {
      return j;
    }
  }
  // 兜底返回第一个
  return 0;
}

/**
 * 计算所有节点状态（用于时间线渲染）
 */
function computeAllNodeStatuses(calendar, now) {
  if (!calendar || !calendar.nodes) return [];
  return calendar.nodes.map(function(node) {
    return computeNodeStatus(node.targetDate, now);
  });
}

module.exports = {
  matchScenario: matchScenario,
  generateNodeCalendar: generateNodeCalendar,
  getPlanSummary: getPlanSummary,
  computeNodeStatus: computeNodeStatus,
  findBestNode: findBestNode,
  computeAllNodeStatuses: computeAllNodeStatuses
};
