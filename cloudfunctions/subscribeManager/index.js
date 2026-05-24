/**
 * 订阅消息管理云函数
 *
 * 功能：
 * - action: 'subscribe' → 用户订阅提醒，保存订阅状态
 * - action: 'sendReminders' → 定时任务：每晚8点发送次日施肥提醒
 *
 * 定时触发器配置：config.json 中每天 20:00 执行
 */

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

// ====================================================================
// 阶段目标日期（与 checkin.js 保持一致）
// ====================================================================
const STAGE_TARGET_DATES = {
  'VE': '04-25', 'V1': '06-05', 'V2': '06-15', 'V3': '06-25',
  'V4': '07-05', 'V5': '07-12', 'V6': '07-19', 'V7': '07-26',
  'V8': '08-05', 'V9': '08-15', 'VT': '08-25', 'R1': '09-05'
};

const STAGE_NAMES = {
  'VE': '出苗期', 'V1': '一叶期', 'V2': '二叶期', 'V3': '三叶期',
  'V4': '四叶期', 'V5': '五叶期', 'V6': '六叶期', 'V7': '七叶期',
  'V8': '八叶期', 'V9': '九叶期', 'VT': '抽雄期', 'R1': '吐丝期'
};

const STAGES = ['VE', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'VT', 'R1'];

// ====================================================================
// 计算某日期对应的阶段
// ====================================================================
function computeStageForDate(date) {
  var year = date.getFullYear();
  var bestStage = 'VE';
  var bestDiff = Infinity;

  for (var i = 0; i < STAGES.length; i++) {
    var stage = STAGES[i];
    var md = STAGE_TARGET_DATES[stage].split('-');
    var target = new Date(year, parseInt(md[0]) - 1, parseInt(md[1]));
    var diff = Math.abs(date - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestStage = stage;
    }
  }
  return bestStage;
}

function computeStageStatus(stage, now) {
  var md = STAGE_TARGET_DATES[stage].split('-');
  var targetDate = new Date(now.getFullYear(), parseInt(md[0]) - 1, parseInt(md[1]));
  var diffDays = Math.round((now - targetDate) / (86400000));
  if (diffDays < -2) return 'readable';
  if (diffDays <= 2) return 'checkable';
  return 'expired';
}

function formatDateCN(date) {
  var y = date.getFullYear();
  var m = date.getMonth() + 1;
  var d = date.getDate();
  return y + '年' + (m < 10 ? '0' + m : m) + '月' + (d < 10 ? '0' + d : d) + '日';
}

// ====================================================================
// 主入口
// ====================================================================
exports.main = async (event, context) => {
  try {
    const data = event.data || event || {};
    const action = data.action;
    const requestId = 'req_' + Date.now() + '_' + Math.floor(Math.random() * 10000);

    console.log('[subscribeManager] requestId=' + requestId + ', action=' + action);

    switch (action) {
      case 'subscribe':
        return await handleSubscribe(data, requestId);
      case 'check':
        return await handleCheck(requestId);
      case 'sendReminders':
        return await handleSendReminders(requestId);
      default:
        return {
          requestId,
          success: false,
          error: { errCode: 'ERR_INVALID_PARAM', errMsg: '未知的操作类型：' + action }
        };
    }
  } catch (initErr) {
    console.error('[subscribeManager] init error:', initErr);
    return {
      success: false,
      error: { errCode: 'ERR_INIT_FAILED', errMsg: initErr.message }
    };
  }
};

// ====================================================================
// 1. 用户订阅
// ====================================================================
async function handleSubscribe(data, requestId) {
  const { farmId, templateId } = data;
  const { OPENID } = cloud.getWXContext();

  if (!OPENID || !templateId) {
    return {
      requestId,
      success: false,
      error: { errCode: 'ERR_INVALID_PARAM', errMsg: '缺少 OPENID 或 templateId' }
    };
  }

  // 幂等：先查是否已订阅
  const existing = await db.collection('Subscriptions')
    .where({ userId: OPENID, templateId })
    .get();

  if (existing.data && existing.data.length > 0) {
    // 已存在，更新状态
    await db.collection('Subscriptions')
      .doc(existing.data[0]._id)
      .update({
        data: {
          subscribed: true,
          farmId: farmId || existing.data[0].farmId,
          updatedAt: new Date()
        }
      });
  } else {
    // 新建订阅记录
    await db.collection('Subscriptions').add({
      data: {
        userId: OPENID,
        farmId: farmId || '',
        templateId,
        subscribed: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
  }

  console.log('[subscribeManager] user subscribed:', OPENID, templateId);
  return { requestId, success: true };
}

// ====================================================================
// 2. 检查当前用户订阅状态
// ====================================================================
async function handleCheck(requestId) {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) {
    return {
      requestId,
      success: false,
      error: { errCode: 'ERR_NO_AUTH', errMsg: '无法获取用户 OPENID' }
    };
  }

  const subsRes = await db.collection('Subscriptions')
    .where({ userId: OPENID, subscribed: true })
    .limit(1)
    .get();

  const subscribed = subsRes.data && subsRes.data.length > 0;
  return { requestId, success: true, data: { subscribed } };
}

// ====================================================================
// 3. 发送当天施肥提醒（每天早上7:00执行）
//    只在农场今天处于 checkable 状态且未打卡时提醒
// ====================================================================
async function handleSendReminders(requestId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  console.log('[subscribeManager] checking reminders for:', formatDateCN(today));

  // 查询所有活跃订阅
  const subsRes = await db.collection('Subscriptions')
    .where({ subscribed: true })
    .get();

  const subscribers = subsRes.data || [];
  console.log('[subscribeManager] total subscribers:', subscribers.length);

  let sentCount = 0;
  let failCount = 0;

  for (var i = 0; i < subscribers.length; i++) {
    const sub = subscribers[i];
    try {
      // 获取用户的活跃农场
      const farmsRes = await db.collection('Farms')
        .where({ userId: sub.userId, status: 'active' })
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();

      if (!farmsRes.data || farmsRes.data.length === 0) {
        console.log('[subscribeManager] no active farm for user:', sub.userId);
        continue;
      }

      const farm = farmsRes.data[0];
      const todayStage = computeStageForDate(today);
      const status = computeStageStatus(todayStage, today);

      // 只有今天处于 checkable 阶段才提醒
      if (status !== 'checkable') {
        console.log('[subscribeManager] today not checkable for', sub.userId, todayStage);
        continue;
      }

      // 检查今天是否已经打卡
      const checkRes = await db.collection('CheckIns')
        .where({
          farmId: farm.farmId,
          stage: todayStage,
          createdAt: _.gte(today)
        })
        .count();

      if (checkRes.total > 0) {
        console.log('[subscribeManager] already checked in today for', sub.userId, todayStage);
        continue;
      }

      // 检查今天是否已经发过提醒（避免重复）
      const remindRes = await db.collection('Subscriptions')
        .doc(sub._id)
        .get();
      const lastRemind = remindRes.data ? remindRes.data.lastRemindedAt : null;
      if (lastRemind) {
        const lastDate = new Date(lastRemind);
        if (lastDate.getFullYear() === today.getFullYear() &&
            lastDate.getMonth() === today.getMonth() &&
            lastDate.getDate() === today.getDate()) {
          console.log('[subscribeManager] already reminded today for', sub.userId);
          continue;
        }
      }

      // 发送订阅消息
      await cloud.openapi.subscribeMessage.send({
        touser: sub.userId,
        templateId: sub.templateId,
        page: 'pages/checkin/checkin',
        lang: 'zh_CN',
        data: {
          thing1: { value: todayStage + ' ' + (STAGE_NAMES[todayStage] || '') },
          time2: { value: formatDateCN(today) },
          thing3: { value: '今天是' + (STAGE_NAMES[todayStage] || '') + '施肥打卡日，记得打卡' }
        },
        miniprogramState: 'formal'
      });

      // 记录本次提醒时间
      await db.collection('Subscriptions')
        .doc(sub._id)
        .update({ data: { lastRemindedAt: new Date(), lastRemindedStage: todayStage } });

      sentCount++;
      console.log('[subscribeManager] reminder sent to', sub.userId, todayStage);

    } catch (err) {
      failCount++;
      console.error('[subscribeManager] send failed for', sub.userId, err.message);
      // 如果用户取消订阅，标记为失效
      if (err.errCode === 43101) {
        await db.collection('Subscriptions')
          .doc(sub._id)
          .update({ data: { subscribed: false, updatedAt: new Date() } });
      }
    }
  }

  console.log('[subscribeManager] done. sent:', sentCount, 'failed:', failCount);
  return {
    requestId,
    success: true,
    data: { sent: sentCount, failed: failCount, total: subscribers.length }
  };
}
