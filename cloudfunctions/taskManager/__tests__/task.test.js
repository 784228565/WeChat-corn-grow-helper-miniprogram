// Absolute Path: C:\Users\78422\WeChatProjects\checkin\cloudfunctions\taskManager\__tests__\task.test.js
// Description: taskManager 单元测试
// 覆盖场景：任务获取（含模板初始化）、状态切换、越权拦截、幂等性、AI建议

const crypto = require('crypto');
const TOKEN_SECRET = 'farm-ledger-8x7k9m2p5n3q6r4t-v2026';

// ==================== Mock wx-server-sdk ====================
var mockDocs = {};
var mockTemplates = {};

function makeToken(userId) {
  var header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  var body = Buffer.from(JSON.stringify({ userId: userId, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 86400 })).toString('base64url');
  var sig = crypto.createHmac('sha256', TOKEN_SECRET).update(header + '.' + body).digest('base64url');
  return { token: header + '.' + body + '.' + sig };
}

jest.mock('wx-server-sdk', function() {
  return {
    init: jest.fn(),
    database: jest.fn(function() {
      return {
        collection: jest.fn(function(name) {
          return {
            doc: jest.fn(function(id) {
              return {
                get: jest.fn(function() {
                  if (name === 'Farms') {
                    return Promise.resolve({ data: mockDocs[id] || null });
                  }
                  return Promise.resolve({ data: mockDocs[id] || null });
                }),
                update: jest.fn(function(opts) {
                  if (mockDocs[id]) {
                    Object.assign(mockDocs[id], opts.data || opts);
                  }
                  return Promise.resolve({});
                })
              };
            }),
            add: jest.fn(function(opts) {
              var id = opts.data._id || ('t_' + Math.random().toString(36).substr(2, 8));
              mockDocs[id] = opts.data;
              return Promise.resolve({ _id: id });
            }),
            where: jest.fn(function(cond) {
              return {
                get: jest.fn(function() {
                  var results = [];
                  var source = name === 'TaskTemplates' ? mockTemplates : mockDocs;
                  Object.values(source).forEach(function(d) {
                    var match = true;
                    for (var k in cond) {
                      if (d[k] !== cond[k]) { match = false; break; }
                    }
                    if (match) results.push(d);
                  });
                  return Promise.resolve({ data: results });
                }),
                count: jest.fn(function() {
                  var count = 0;
                  var source = name === 'TaskTemplates' ? mockTemplates : mockDocs;
                  Object.values(source).forEach(function(d) {
                    var match = true;
                    for (var k in cond) {
                      if (d[k] !== cond[k]) { match = false; break; }
                    }
                    if (match) count++;
                  });
                  return Promise.resolve({ total: count });
                }),
                orderBy: jest.fn(function() {
                  return {
                    get: jest.fn(function() {
                      var results = [];
                      var source = name === 'TaskTemplates' ? mockTemplates : mockDocs;
                      Object.values(source).forEach(function(d) {
                        var match = true;
                        for (var k in cond) {
                          if (d[k] !== cond[k]) { match = false; break; }
                        }
                        if (match) results.push(d);
                      });
                      return Promise.resolve({ data: results });
                    })
                  };
                })
              };
            })
          };
        })
      };
    }),
    getWXContext: jest.fn(function() { return { OPENID: 'mock_openid' }; }),
    DYNAMIC_CURRENT_ENV: 'test-env'
  };
});

// 导入被测模块
const { main } = require('../index');

describe('taskManager', function() {
  var USER_A = 'u_user_alpha';
  var USER_B = 'u_user_beta';
  var FARM_A = 'f_farmaaa1';

  beforeEach(function() {
    jest.clearAllMocks();
    for (var k in mockDocs) delete mockDocs[k];
    for (var k in mockTemplates) delete mockTemplates[k];

    // 预置农场
    mockDocs[FARM_A] = {
      _id: FARM_A,
      farmId: FARM_A,
      userId: USER_A,
      name: '河套一号田',
      cropType: 'corn',
      currentStage: 'V2'
    };
  });

  // ---- TC-01: 首次获取任务，自动从模板创建 ----
  test('TC-01: getTasks 首次访问自动创建模板任务', async function() {
    var res = await main({
      data: Object.assign({}, makeToken(USER_A), {
        action: 'getTasks',
        farmId: FARM_A,
        stage: 'V2'
      })
    }, {});

    expect(res.success).toBe(true);
    expect(res.data.tasks.length).toBeGreaterThan(0);
    expect(res.data.tasks[0].completed).toBe(false);
    expect(res.data.tasks[0].name).toBeTruthy();
  });

  // ---- TC-02: 二次获取任务，返回已创建的任务 ----
  test('TC-02: getTasks 二次访问返回已有任务', async function() {
    // 首次调用创建任务
    await main({
      data: Object.assign({}, makeToken(USER_A), {
        action: 'getTasks',
        farmId: FARM_A,
        stage: 'V2'
      })
    }, {});

    // 第二次调用应返回相同任务
    var res2 = await main({
      data: Object.assign({}, makeToken(USER_A), {
        action: 'getTasks',
        farmId: FARM_A,
        stage: 'V2'
      })
    }, {});

    expect(res2.success).toBe(true);
    expect(res2.data.tasks.length).toBeGreaterThan(0);
  });

  // ---- TC-03: toggleTask 标记完成 ----
  test('TC-03: toggleTask 标记任务完成', async function() {
    // 先获取任务
    var getRes = await main({
      data: Object.assign({}, makeToken(USER_A), {
        action: 'getTasks',
        farmId: FARM_A,
        stage: 'V2'
      })
    }, {});
    var taskId = getRes.data.tasks[0].id;

    // 标记完成
    var toggleRes = await main({
      data: Object.assign({}, makeToken(USER_A), {
        action: 'toggleTask',
        farmId: FARM_A,
        taskId: taskId,
        completed: true,
        timestamp: Date.now()
      })
    }, {});

    expect(toggleRes.success).toBe(true);
    expect(toggleRes.data.updatedTask.completed).toBe(true);
    expect(toggleRes.data.updatedTask.completedAt).toBeGreaterThan(0);
  });

  // ---- TC-04: toggleTask 幂等性（重复标记完成） ----
  test('TC-04: toggleTask 重复标记幂等', async function() {
    var getRes = await main({
      data: Object.assign({}, makeToken(USER_A), {
        action: 'getTasks',
        farmId: FARM_A,
        stage: 'V2'
      })
    }, {});
    var taskId = getRes.data.tasks[0].id;
    var ts = Date.now();

    // 第一次标记
    var r1 = await main({
      data: Object.assign({}, makeToken(USER_A), {
        action: 'toggleTask',
        farmId: FARM_A,
        taskId: taskId,
        completed: true,
        timestamp: ts
      })
    }, {});

    // 第二次标记（相同参数）
    var r2 = await main({
      data: Object.assign({}, makeToken(USER_A), {
        action: 'toggleTask',
        farmId: FARM_A,
        taskId: taskId,
        completed: true,
        timestamp: ts
      })
    }, {});

    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
    expect(r1.data.updatedTask.id).toBe(r2.data.updatedTask.id);
  });

  // ---- TC-05: toggleTask 取消完成 ----
  test('TC-05: toggleTask 取消完成状态', async function() {
    var getRes = await main({
      data: Object.assign({}, makeToken(USER_A), {
        action: 'getTasks',
        farmId: FARM_A,
        stage: 'V2'
      })
    }, {});
    var taskId = getRes.data.tasks[0].id;

    // 先完成
    await main({
      data: Object.assign({}, makeToken(USER_A), {
        action: 'toggleTask',
        farmId: FARM_A,
        taskId: taskId,
        completed: true,
        timestamp: Date.now()
      })
    }, {});

    // 再取消
    var cancelRes = await main({
      data: Object.assign({}, makeToken(USER_A), {
        action: 'toggleTask',
        farmId: FARM_A,
        taskId: taskId,
        completed: false,
        timestamp: Date.now()
      })
    }, {});

    expect(cancelRes.success).toBe(true);
    expect(cancelRes.data.updatedTask.completed).toBe(false);
    expect(cancelRes.data.updatedTask.completedAt).toBeNull();
  });

  // ---- TC-06: 越权访问 toggleTask ----
  test('TC-06: 用户B无法操作用户A的任务', async function() {
    var getRes = await main({
      data: Object.assign({}, makeToken(USER_A), {
        action: 'getTasks',
        farmId: FARM_A,
        stage: 'V2'
      })
    }, {});
    var taskId = getRes.data.tasks[0].id;

    var toggleRes = await main({
      data: Object.assign({}, makeToken(USER_B), {
        action: 'toggleTask',
        farmId: FARM_A,
        taskId: taskId,
        completed: true,
        timestamp: Date.now()
      })
    }, {});

    expect(toggleRes.success).toBe(false);
    expect(toggleRes.error.errCode).toBe('ERR_FORBIDDEN');
  });

  // ---- TC-07: getInsight 返回兜底建议 ----
  test('TC-07: getInsight 返回 V2 阶段建议', async function() {
    var res = await main({
      data: Object.assign({}, makeToken(USER_A), {
        action: 'getInsight',
        farmId: FARM_A,
        location: '内蒙古巴彦淖尔市',
        currentStage: 'V2',
        pendingTasks: ['Weed Assessment']
      })
    }, {});

    expect(res.success).toBe(true);
    expect(res.data.insight.title).toBeTruthy();
    expect(res.data.insight.content).toBeTruthy();
    expect(res.data.insight.priorityTask).toBeTruthy();
  });

  // ---- TC-08: 越权访问 getInsight ----
  test('TC-08: 用户B无法获取用户A的AI建议', async function() {
    var res = await main({
      data: Object.assign({}, makeToken(USER_B), {
        action: 'getInsight',
        farmId: FARM_A,
        location: '内蒙古巴彦淖尔市',
        currentStage: 'V2',
        pendingTasks: []
      })
    }, {});

    expect(res.success).toBe(false);
    expect(res.error.errCode).toBe('ERR_FORBIDDEN');
  });

  // ---- TC-09: 无效 stage 参数 ----
  test('TC-09: 非法 stage 返回 ERR_INVALID_PARAM', async function() {
    var res = await main({
      data: Object.assign({}, makeToken(USER_A), {
        action: 'getTasks',
        farmId: FARM_A,
        stage: 'INVALID'
      })
    }, {});

    expect(res.success).toBe(false);
    expect(res.error.errCode).toBe('ERR_INVALID_PARAM');
  });

  // ---- TC-10: getTasks 无模板阶段返回空数组 ----
  test('TC-10: 无模板阶段返回空数组', async function() {
    var res = await main({
      data: Object.assign({}, makeToken(USER_A), {
        action: 'getTasks',
        farmId: FARM_A,
        stage: 'VT'
      })
    }, {});

    expect(res.success).toBe(true);
    expect(res.data.tasks).toEqual([]);
  });
});
