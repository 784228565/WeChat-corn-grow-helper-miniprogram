/**
 * Yuanqi (腾讯元器) 智能体 API 调用服务
 * 文档: https://yuanqi.tencent.com/openapi
 *
 * 关键设计:
 * - 通过云函数中转，Token 不暴露到前端
 * - 使用非流式调用 (stream: false)，兼容微信小程序云函数
 * - 自动维护对话历史 (存储在云数据库)
 * - assistant_id 固定绑定用户创建的元器智能体
 */

const https = require('https');
const { YUANQI_CONFIG } = require('../config');

// https 请求超时（略小于云函数超时 20s，确保先触发此超时返回友好错误）
const HTTP_TIMEOUT_MS = 18000;

// ============ 工具函数 ============

/**
 * 发起 HTTPS POST 请求
 */
function httpsPost(options, postData) {
  return new Promise(function(resolve, reject) {
    var req = https.request(options, function(res) {
      var data = '';
      res.setEncoding('utf8');
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        try {
          var json = JSON.parse(data);
          resolve({ statusCode: res.statusCode, body: json });
        } catch (e) {
          resolve({ statusCode: res.statusCode, body: data });
        }
      });
    });

    req.on('error', function(err) {
      reject(err);
    });

    req.setTimeout(HTTP_TIMEOUT_MS, function() {
      req.destroy();
      reject(new Error('Yuanqi API timeout'));
    });

    req.write(postData);
    req.end();
  });
}

/**
 * 调用元器智能体 API
 * @param {string} userId     - 用户唯一标识 (建议用 openid)
 * @param {Array}  messages   - 消息数组 [{role, content}]
 * @returns {Promise<string>} - AI 回复文本
 */
async function callAgent(userId, messages) {
  if (!YUANQI_CONFIG.TOKEN) {
    throw new Error('YUANQI_TOKEN not configured. Please set it in cloud function environment variables.');
  }

  var payload = JSON.stringify({
    assistant_id: YUANQI_CONFIG.ASSISTANT_ID,
    user_id: String(userId),
    stream: false,
    messages: messages.map(function(msg) {
      return {
        role: msg.role,
        content: [
          { type: 'text', text: msg.content }
        ]
      };
    })
  });

  var options = {
    hostname: YUANQI_CONFIG.API_HOST,
    path: YUANQI_CONFIG.API_PATH,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + YUANQI_CONFIG.TOKEN,
      'X-Source': 'openapi',
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  console.log('[yuanqiService] calling agent, userId=' + userId + ', messages=' + messages.length);
  var result = await httpsPost(options, payload);

  if (result.statusCode !== 200) {
    console.error('[yuanqiService] API error:', result.statusCode, result.body);
    throw new Error('Yuanqi API returned ' + result.statusCode + ': ' + JSON.stringify(result.body));
  }

  var responseBody = result.body;
  if (responseBody.error) {
    console.error('[yuanqiService] API business error:', responseBody.error);
    throw new Error('Yuanqi API error: ' + responseBody.error.message);
  }

  // 解析回复内容
  var choices = responseBody.choices;
  if (!choices || choices.length === 0) {
    throw new Error('Yuanqi API returned empty choices');
  }

  var message = choices[0].message || {};
  var replyContent = message.content;
  if (!replyContent) {
    throw new Error('Yuanqi API returned empty content');
  }

  // 提取思考/调用过程
  var steps = message.steps || [];
  console.log('[yuanqiService] reply length=' + replyContent.length + ', steps=' + steps.length);

  return {
    content: replyContent,
    steps: steps
  };
}

/**
 * 从云数据库读取对话历史
 */
async function loadChatHistory(userId, farmId) {
  try {
    const cloud = require('wx-server-sdk');
    var db = cloud.database();
    var res = await db.collection('ChatHistory')
      .where({ userId: userId, farmId: farmId || '' })
      .orderBy('updatedAt', 'desc')
      .limit(1)
      .get();

    if (res.data && res.data.length > 0) {
      return res.data[0].messages || [];
    }
  } catch (err) {
    console.warn('[yuanqiService] loadChatHistory failed:', err.message);
  }
  return [];
}

/**
 * 保存对话历史到云数据库
 */
async function saveChatHistory(userId, farmId, messages) {
  try {
    const cloud = require('wx-server-sdk');
    var db = cloud.database();
    var now = new Date();
    var docId = userId + '_' + (farmId || 'global');

    // 先尝试更新，如果文档不存在则创建
    try {
      await db.collection('ChatHistory').doc(docId).update({
        data: {
          userId: userId,
          farmId: farmId || '',
          messages: messages,
          updatedAt: now
        }
      });
    } catch (updateErr) {
      // 文档不存在，新增
      await db.collection('ChatHistory').add({
        data: {
          _id: docId,
          userId: userId,
          farmId: farmId || '',
          messages: messages,
          updatedAt: now
        }
      });
    }
  } catch (err) {
    console.warn('[yuanqiService] saveChatHistory failed:', err.message);
  }
}

/**
 * 执行一次对话（含历史记录维护）
 * @param {string} userId   - 用户 ID
 * @param {string} farmId   - 农场 ID (可选)
 * @param {string} message  - 用户当前消息
 * @param {Object} context  - 额外上下文（如农场信息）
 * @returns {Promise<string>} - AI 回复
 */
async function chat(userId, farmId, message, context) {
  // 加载历史消息
  var history = await loadChatHistory(userId, farmId);

  // 构建 system 上下文提示（把农场信息注入给 AI）
  var systemPrompt = buildSystemPrompt(context);

  // 组装消息数组
  var messages = [];

  // 追加历史消息（最多保留最近 10 轮）
  var recentHistory = history.slice(-20); // 20 条 = 10 轮对话
  messages = messages.concat(recentHistory);

  // 如果历史为空，把 system prompt 拼接到当前消息前面
  var finalMessage = message;
  if (history.length === 0 && systemPrompt) {
    finalMessage = systemPrompt + '\n\n用户问题：' + message;
  }

  // 追加当前用户消息
  messages.push({ role: 'user', content: finalMessage });

  // 调用元器 API
  var reply = await callAgent(userId, messages);

  // 保存到历史
  messages.push({ role: 'assistant', content: reply });
  // 只保留最近 20 条（10 轮）用于持久化
  var historyToSave = messages.slice(-22);
  await saveChatHistory(userId, farmId, historyToSave);

  return reply;
}

/**
 * 构建 system prompt，把农场信息注入给元器智能体
 */
function buildSystemPrompt(context) {
  var parts = [];
  parts.push('你是农田管家的 AI 农事助手，专业回答玉米种植相关问题。');

  if (context && context.cropType) {
    parts.push('当前作物：' + context.cropType + '。');
  }
  if (context && context.currentStage) {
    parts.push('当前生长阶段：' + context.currentStage + '。');
  }
  if (context && context.location) {
    parts.push('农场位置：' + context.location + '。');
  }
  if (context && context.farmName) {
    parts.push('农场名称：' + context.farmName + '。');
  }
  if (context && context.accumulatedTemp) {
    parts.push('积温：' + context.accumulatedTemp + '℃。');
  }
  if (context && context.soilType) {
    parts.push('土壤类型：' + context.soilType + '。');
  }
  if (context && context.irrigation) {
    parts.push('灌溉方式：' + context.irrigation + '。');
  }

  parts.push('请用中文回答，保持专业但易懂。');
  return parts.join('');
}

/**
 * 清空对话历史
 */
async function clearHistory(userId, farmId) {
  try {
    const cloud = require('wx-server-sdk');
    var db = cloud.database();
    var docId = userId + '_' + (farmId || 'global');
    await db.collection('ChatHistory').doc(docId).remove();
  } catch (err) {
    console.warn('[yuanqiService] clearHistory failed:', err.message);
  }
}

module.exports = {
  chat: chat,
  callAgent: callAgent,
  loadChatHistory: loadChatHistory,
  saveChatHistory: saveChatHistory,
  clearHistory: clearHistory,
  buildSystemPrompt: buildSystemPrompt,
  CONFIG: YUANQI_CONFIG
};
