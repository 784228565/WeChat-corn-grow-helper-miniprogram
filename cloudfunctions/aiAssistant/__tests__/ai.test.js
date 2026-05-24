// Absolute Path: C:\Users\78422\WeChatProjects\checkin\cloudfunctions\aiAssistant\__tests__\ai.test.js
// Description: aiAssistant 单元测试

const crypto = require('crypto');
const TOKEN_SECRET = 'farm-ledger-8x7k9m2p5n3q6r4t-v2026';

var mockFarms = {};

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
                get: jest.fn(function() { return Promise.resolve({ data: mockFarms[id] || null }); })
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

describe('aiAssistant', function() {
  var USER_A = 'u_user_alpha';
  var FARM_A = 'f_farmaaa1';

  beforeEach(function() {
    jest.clearAllMocks();
    for (var k in mockFarms) delete mockFarms[k];
    mockFarms[FARM_A] = { _id: FARM_A, farmId: FARM_A, userId: USER_A, name: '河套一号田', cropType: 'corn', currentStage: 'V2' };
  });

  test('TC-01: chat 返回 V2 阶段 pest 相关回复', async function() {
    var res = await main({
      data: Object.assign({}, makeToken(USER_A), {
        action: 'chat',
        farmId: FARM_A,
        message: 'What pests should I watch for?',
        context: { currentStage: 'V2', location: '内蒙古巴彦淖尔市' }
      })
    }, {});

    expect(res.success).toBe(true);
    expect(res.data.reply.content).toBeTruthy();
    expect(res.data.reply.chips.length).toBeGreaterThan(0);
  });

  test('TC-02: chat 未知关键词返回默认回复', async function() {
    var res = await main({
      data: Object.assign({}, makeToken(USER_A), {
        action: 'chat',
        farmId: FARM_A,
        message: 'Hello there',
        context: { currentStage: 'V2' }
      })
    }, {});

    expect(res.success).toBe(true);
    expect(res.data.reply.content).toBeTruthy();
  });

  test('TC-03: getSuggestions 返回 V2 阶段快捷问题', async function() {
    var res = await main({
      data: Object.assign({}, makeToken(USER_A), {
        action: 'getSuggestions',
        farmId: FARM_A,
        currentStage: 'V2'
      })
    }, {});

    expect(res.success).toBe(true);
    expect(res.data.suggestions.length).toBeGreaterThan(0);
    expect(res.data.suggestions[0].icon).toBeTruthy();
  });

  test('TC-04: 越权访问返回 ERR_FORBIDDEN', async function() {
    var res = await main({
      data: Object.assign({}, makeToken('u_other'), {
        action: 'chat',
        farmId: FARM_A,
        message: 'test'
      })
    }, {});

    expect(res.success).toBe(false);
    expect(res.error.errCode).toBe('ERR_FORBIDDEN');
  });
});
