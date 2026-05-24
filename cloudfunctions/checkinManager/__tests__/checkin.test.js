// Absolute Path: C:\Users\78422\WeChatProjects\checkin\cloudfunctions\checkinManager\__tests__\checkin.test.js
// Description: checkinManager 单元测试

const crypto = require('crypto');
const TOKEN_SECRET = 'farm-ledger-8x7k9m2p5n3q6r4t-v2026';

var mockFarms = {};
var mockTasks = {};
var mockCheckIns = {};

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
          var source = name === 'Farms' ? mockFarms : (name === 'Tasks' ? mockTasks : mockCheckIns);
          return {
            doc: jest.fn(function(id) {
              return {
                get: jest.fn(function() { return Promise.resolve({ data: source[id] || null }); }),
                update: jest.fn(function(opts) {
                  if (source[id]) Object.assign(source[id], opts.data || opts);
                  return Promise.resolve({});
                })
              };
            }),
            add: jest.fn(function(opts) {
              var id = opts.data._id || ('c_' + Math.random().toString(36).substr(2, 8));
              source[id] = opts.data;
              return Promise.resolve({ _id: id });
            }),
            where: jest.fn(function(cond) {
              return {
                get: jest.fn(function() {
                  var results = [];
                  Object.values(source).forEach(function(d) {
                    var match = true;
                    for (var k in cond) {
                      if (cond[k] && typeof cond[k] === 'object') {
                        // 简单处理 $gte/$lte
                        continue;
                      }
                      if (d[k] !== cond[k]) { match = false; break; }
                    }
                    if (match) results.push(d);
                  });
                  return Promise.resolve({ data: results });
                }),
                count: jest.fn(function() {
                  var count = 0;
                  Object.values(source).forEach(function(d) {
                    var match = true;
                    for (var k in cond) {
                      if (cond[k] && typeof cond[k] === 'object') { continue; }
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
                      Object.values(source).forEach(function(d) {
                        var match = true;
                        for (var k in cond) {
                          if (cond[k] && typeof cond[k] === 'object') { continue; }
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

const { main } = require('../index');

describe('checkinManager', function() {
  var USER_A = 'u_user_alpha';
  var USER_B = 'u_user_beta';
  var FARM_A = 'f_farmaaa1';

  beforeEach(function() {
    jest.clearAllMocks();
    for (var k in mockFarms) delete mockFarms[k];
    for (var k in mockTasks) delete mockTasks[k];
    for (var k in mockCheckIns) delete mockCheckIns[k];

    mockFarms[FARM_A] = {
      _id: FARM_A,
      farmId: FARM_A,
      userId: USER_A,
      name: '河套一号田',
      cropType: 'corn'
    };
  });

  // ---- TC-01: 正常提交打卡 ----
  test('TC-01: 所有任务完成时提交打卡成功', async function() {
    // 预置已完成任务
    mockTasks['t_task001'] = { _id: 't_task001', id: 't_task001', farmId: FARM_A, stage: 'V2', name: 'Task1', completed: true, sortOrder: 1 };
    mockTasks['t_task002'] = { _id: 't_task002', id: 't_task002', farmId: FARM_A, stage: 'V2', name: 'Task2', completed: true, sortOrder: 2 };

    var res = await main({
      data: Object.assign({}, makeToken(USER_A), {
        action: 'submit',
        farmId: FARM_A,
        stage: 'V2',
        timestamp: Date.now()
      })
    }, {});

    expect(res.success).toBe(true);
    expect(res.data.checkInId).toBeTruthy();
    expect(res.data.completedTaskCount).toBe(2);
    expect(res.data.totalTaskCount).toBe(2);
  });

  // ---- TC-02: 有未完成任务时拒绝打卡 ----
  test('TC-02: 有未完成任务时返回 ERR_TASKS_INCOMPLETE', async function() {
    mockTasks['t_task001'] = { _id: 't_task001', id: 't_task001', farmId: FARM_A, stage: 'V2', name: 'Task1', completed: true, sortOrder: 1 };
    mockTasks['t_task002'] = { _id: 't_task002', id: 't_task002', farmId: FARM_A, stage: 'V2', name: 'Task2', completed: false, sortOrder: 2 };

    var res = await main({
      data: Object.assign({}, makeToken(USER_A), {
        action: 'submit',
        farmId: FARM_A,
        stage: 'V2',
        timestamp: Date.now()
      })
    }, {});

    expect(res.success).toBe(false);
    expect(res.error.errCode).toBe('ERR_TASKS_INCOMPLETE');
  });

  // ---- TC-03: 获取打卡列表 ----
  test('TC-03: list 返回分页打卡记录', async function() {
    // 预置打卡记录
    mockCheckIns['c_001'] = { _id: 'c_001', checkInId: 'c_001', userId: USER_A, farmId: FARM_A, stage: 'V2', completedTasks: [], totalTaskCount: 3, completedTaskCount: 3, checkedInAt: new Date(), photos: [] };
    mockCheckIns['c_002'] = { _id: 'c_002', checkInId: 'c_002', userId: USER_A, farmId: FARM_A, stage: 'V2', completedTasks: [], totalTaskCount: 3, completedTaskCount: 3, checkedInAt: new Date(), photos: [] };

    var res = await main({
      data: Object.assign({}, makeToken(USER_A), {
        action: 'list',
        farmId: FARM_A,
        page: 1,
        limit: 10
      })
    }, {});

    expect(res.success).toBe(true);
    expect(res.data.logs.length).toBe(2);
    expect(res.data.total).toBe(2);
    expect(res.data.hasMore).toBe(false);
  });

  // ---- TC-04: 获取打卡详情 ----
  test('TC-04: detail 返回完整打卡信息', async function() {
    mockCheckIns['c_003'] = {
      _id: 'c_003',
      checkInId: 'c_003',
      userId: USER_A,
      farmId: FARM_A,
      stage: 'V2',
      completedTasks: [{ taskId: 't_001', name: 'Task1', category: 'inspection' }],
      totalTaskCount: 3,
      completedTaskCount: 3,
      photos: ['cloud://photo1.jpg'],
      note: '今日一切正常',
      checkedInAt: new Date('2026-04-21'),
      location: { address: '内蒙古巴彦淖尔市' }
    };

    var res = await main({
      data: Object.assign({}, makeToken(USER_A), {
        action: 'detail',
        checkInId: 'c_003'
      })
    }, {});

    expect(res.success).toBe(true);
    expect(res.data.log.id).toBe('c_003');
    expect(res.data.log.completedTasks.length).toBe(1);
    expect(res.data.log.note).toBe('今日一切正常');
  });

  // ---- TC-05: 越权访问他人打卡详情 ----
  test('TC-05: 用户B无法查看用户A的打卡', async function() {
    mockCheckIns['c_004'] = { _id: 'c_004', checkInId: 'c_004', userId: USER_A, farmId: FARM_A, stage: 'V2', completedTasks: [], totalTaskCount: 3, completedTaskCount: 3, checkedInAt: new Date(), photos: [] };

    var res = await main({
      data: Object.assign({}, makeToken(USER_B), {
        action: 'detail',
        checkInId: 'c_004'
      })
    }, {});

    expect(res.success).toBe(false);
    expect(res.error.errCode).toBe('ERR_FORBIDDEN');
  });

  // ---- TC-06: 打卡记录不存在 ----
  test('TC-06: 查询不存在的打卡返回 ERR_CHECKIN_NOT_FOUND', async function() {
    var res = await main({
      data: Object.assign({}, makeToken(USER_A), {
        action: 'detail',
        checkInId: 'c_notexist'
      })
    }, {});

    expect(res.success).toBe(false);
    expect(res.error.errCode).toBe('ERR_CHECKIN_NOT_FOUND');
  });

  // ---- TC-07: 越权提交他人农场打卡 ----
  test('TC-07: 用户B无法为用户A的农场打卡', async function() {
    var res = await main({
      data: Object.assign({}, makeToken(USER_B), {
        action: 'submit',
        farmId: FARM_A,
        stage: 'V2',
        timestamp: Date.now()
      })
    }, {});

    expect(res.success).toBe(false);
    expect(res.error.errCode).toBe('ERR_FORBIDDEN');
  });

  // ---- TC-08: 空任务列表允许打卡 ----
  test('TC-08: 无任务时允许打卡', async function() {
    var res = await main({
      data: Object.assign({}, makeToken(USER_A), {
        action: 'submit',
        farmId: FARM_A,
        stage: 'VT',
        timestamp: Date.now()
      })
    }, {});

    expect(res.success).toBe(true);
    expect(res.data.totalTaskCount).toBe(0);
  });
});
