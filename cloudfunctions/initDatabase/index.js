/**
 * 数据库初始化云函数
 */

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  try {
    var { COLLECTIONS, DEFAULT_TASK_TEMPLATES, REQUIRED_INDEXES } = require('./config');
    var db = cloud.database();

    var data = event.data || event || {};
    var action = data.action || 'init';
    var force = !!data.force;

    if (action !== 'init') {
      return {
        success: false,
        error: { code: 'ERR_INVALID_ACTION', message: '仅支持 action: "init"' }
      };
    }

    var results = [];

    // 1. 确保所有业务集合存在
    var collections = [COLLECTIONS.FARMS, COLLECTIONS.USERS, COLLECTIONS.TASKS, COLLECTIONS.CHECKINS, COLLECTIONS.TASK_TEMPLATES, COLLECTIONS.MEDIA_RECORDS, 'Subscriptions'];
    for (var i = 0; i < collections.length; i++) {
      var res = await ensureCollection(db, collections[i]);
      results.push(res);
    }

    // 2. 初始化 TaskTemplates
    var tplRes = await initTaskTemplates(db, COLLECTIONS.TASK_TEMPLATES, DEFAULT_TASK_TEMPLATES, force);
    results.push(tplRes);

    return {
      success: true,
      data: {
        message: '数据库初始化完成',
        collections: results,
        indexes: REQUIRED_INDEXES,
        nextSteps: [
          '请在微信云开发控制台 → 数据库 → 索引管理中，为以下集合创建索引：',
          '  1. Tasks:    { farmId: 1, stage: 1 }',
          '  2. CheckIns: { farmId: 1, checkedInAt: -1 }',
          '  3. Farms:    { userId: 1 }',
          '  4. Users:    { userId: 1 }',
          '  5. TaskTemplates: { cropType: 1, stage: 1 }'
        ]
      }
    };

  } catch (err) {
    console.error('[initDatabase] 初始化失败:', err);
    return {
      success: false,
      error: { code: 'ERR_INIT_FAILED', message: err.message }
    };
  }
};

async function ensureCollection(db, collectionName) {
  try {
    var collection = db.collection(collectionName);
    var tempRes = await collection.add({
      data: { _init: true, _temp: true, createdAt: new Date() }
    });
    await collection.doc(tempRes._id).remove();
    return { collection: collectionName, status: 'created' };
  } catch (err) {
    return { collection: collectionName, status: 'exists_or_error', error: err.message };
  }
}

async function initTaskTemplates(db, collectionName, templates, force) {
  var collection = db.collection(collectionName);
  var countRes = await collection.count();
  var existingCount = countRes.total || 0;

  if (existingCount > 0 && !force) {
    return {
      collection: collectionName,
      action: 'skipped',
      reason: '已有 ' + existingCount + ' 条模板数据，传入 force: true 可强制覆盖',
      count: existingCount
    };
  }

  if (force && existingCount > 0) {
    var existing = await collection.limit(100).get();
    for (var i = 0; i < existing.data.length; i++) {
      await collection.doc(existing.data[i]._id).remove();
    }
  }

  var now = new Date();
  var inserted = 0;
  for (var j = 0; j < templates.length; j++) {
    await collection.add({ data: Object.assign({}, templates[j], { createdAt: now, updatedAt: now }) });
    inserted++;
  }

  return {
    collection: collectionName,
    action: force ? 'reset' : 'init',
    inserted: inserted,
    total: inserted
  };
}
