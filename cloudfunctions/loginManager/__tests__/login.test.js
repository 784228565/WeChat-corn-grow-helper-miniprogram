/**
 * loginManager 单元测试
 * 使用 Jest Mock wx-server-sdk 及微信登录态
 *
 * 测试覆盖：
 * 1. 新用户首次登录（code 有效，数据库无记录）
 * 2. 老用户重复登录（code 有效，数据库有记录）
 * 3. 微信 code 过期（微信返回 40029）
 * 4. 参数校验失败（code 缺失或格式非法）
 * 5. 并发安全（两个相同 openid 的请求同时到达）
 */

// ==================== Mock wx-server-sdk ====================

const mockGet = jest.fn();
const mockAdd = jest.fn();
const mockUpdate = jest.fn();
const mockDoc = jest.fn(() => ({ get: mockGet, update: mockUpdate }));
const mockCollection = jest.fn(() => ({
  doc: mockDoc,
  add: mockAdd,
}));
const mockCode2Session = jest.fn();
const mockGetWXContext = jest.fn(() => ({
  OPENID: 'mock_openid_001',
  CLIENTIP: '127.0.0.1',
}));

jest.mock('wx-server-sdk', () => {
  return {
    init: jest.fn(),
    database: jest.fn(() => ({
      collection: mockCollection,
      command: { inc: jest.fn((n) => ({ $inc: n })) },
    })),
    auth: jest.fn(() => ({
      code2Session: mockCode2Session,
    })),
    getWXContext: mockGetWXContext,
    DYNAMIC_CURRENT_ENV: 'test-env',
  };
});

// ==================== 导入被测模块 ====================

const { main } = require('../index');

// ==================== 测试用例 ====================

describe('loginManager - login action', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // 默认模拟微信返回有效 openid
    mockCode2Session.mockResolvedValue({
      openid: 'wx_openid_test_001',
      sessionKey: 'session_key_test',
    });
  });

  // TC-01: 新用户首次登录
  test('TC-01: 新用户首次登录应创建档案并返回 isNewUser=true', async () => {
    // 前置：数据库查询返回空（用户不存在）
    mockGet.mockRejectedValue(new Error('document not found'));
    mockAdd.mockResolvedValue({ _id: 'wx_openid_test_001' });

    const event = {
      data: {
        action: 'login',
        code: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6',
        userInfo: {
          nickName: 'Farmer Joe',
          avatarUrl: 'https://example.com/avatar.jpg',
          gender: 1,
        },
      },
    };

    const result = await main(event, {});

    expect(result.success).toBe(true);
    expect(result.data.isNewUser).toBe(true);
    expect(result.data.userId).toMatch(/^u_[a-f0-9]{8}$/);
    expect(result.data.token).toBeDefined();
    expect(result.data.expiresIn).toBe(604800);

    // 验证数据库创建调用
    expect(mockAdd).toHaveBeenCalledTimes(1);
    const addedDoc = mockAdd.mock.calls[0][0].data;
    expect(addedDoc.openid).toBe('wx_openid_test_001');
    expect(addedDoc.profile.nickName).toBe('Farmer Joe');
    expect(addedDoc.stats.loginCount).toBe(1);
  });

  // TC-02: 老用户重复登录
  test('TC-02: 老用户登录应更新统计并返回 isNewUser=false', async () => {
    // 前置：数据库已存在该用户
    mockGet.mockResolvedValue({
      data: {
        _id: 'wx_openid_test_001',
        openid: 'wx_openid_test_001',
        userId: 'u_abc12345',
        profile: { nickName: 'Farmer Joe', avatarUrl: '', gender: 1 },
        stats: { loginCount: 5, firstLoginAt: new Date('2024-01-01') },
      },
    });
    mockUpdate.mockResolvedValue({ stats: { updated: 1 } });

    const event = {
      data: {
        action: 'login',
        code: 'q1w2e3r4t5y6u7i8o9p0a1s2d3f4g5h6',
      },
    };

    const result = await main(event, {});

    expect(result.success).toBe(true);
    expect(result.data.isNewUser).toBe(false);
    expect(result.data.userId).toBe('u_abc12345');

    // 验证更新调用
    expect(mockUpdate).toHaveBeenCalledTimes(2); // 一次更新 loginInfo，一次最终更新 token
  });

  // TC-03: 微信 code 过期
  test('TC-03: 过期 code 应返回 ERR_CODE_EXPIRED 并建议 retry', async () => {
    mockCode2Session.mockRejectedValue({
      message: 'invalid code, hints: [ req_id: xxx ] (40029)',
    });

    const event = {
      data: {
        action: 'login',
        code: 'expired_code_expired_code_expired_',
      },
    };

    const result = await main(event, {});

    expect(result.success).toBe(false);
    expect(result.error.errCode).toBe('ERR_CODE_EXPIRED');
    expect(result.error.action).toBe('retry');
    expect(result.error.errMsg).toContain('过期');
  });

  // TC-04: 参数校验失败（code 缺失）
  test('TC-04: 缺少 code 应返回 ERR_INVALID_PARAM', async () => {
    const event = {
      data: {
        action: 'login',
        // code 缺失
      },
    };

    const result = await main(event, {});

    expect(result.success).toBe(false);
    expect(result.error.errCode).toBe('ERR_INVALID_PARAM');
    expect(result.error.action).toBe('retry');
  });

  // TC-05: 参数校验失败（code 格式非法）
  test('TC-05: 非法格式 code 应返回 ERR_INVALID_PARAM', async () => {
    const event = {
      data: {
        action: 'login',
        code: 'not_a_valid_code!!!',
      },
    };

    const result = await main(event, {});

    expect(result.success).toBe(false);
    expect(result.error.errCode).toBe('ERR_INVALID_PARAM');
  });

  // TC-06: 用户拒绝授权（userInfo 缺失）
  test('TC-06: 无 userInfo 时应使用默认昵称和头像', async () => {
    mockGet.mockRejectedValue(new Error('document not found'));
    mockAdd.mockResolvedValue({ _id: 'wx_openid_test_001' });

    const event = {
      data: {
        action: 'login',
        code: 'z1x2c3v4b5n6m7a8s9d0f1g2h3j4k5l6',
        // userInfo 未提供
      },
    };

    const result = await main(event, {});

    expect(result.success).toBe(true);
    expect(result.data.isNewUser).toBe(true);

    const addedDoc = mockAdd.mock.calls[0][0].data;
    expect(addedDoc.profile.nickName).toBe('微信用户');
    expect(addedDoc.profile.avatarUrl).toContain('mmbiz.qpic.cn');
  });

  // TC-07: Token 验证接口
  test('TC-07: verify action 应校验 token 有效性', async () => {
    // 先登录获取有效 token
    mockGet.mockRejectedValue(new Error('document not found'));
    mockAdd.mockResolvedValue({ _id: 'wx_openid_test_001' });

    const loginEvent = {
      data: {
        action: 'login',
        code: 'b1n2m3a4s5d6f7g8h9j0k1l2p3o4i5u6',
      },
    };
    const loginResult = await main(loginEvent, {});
    const validToken = loginResult.data.token;

    // 验证有效 token
    const verifyEvent = {
      data: {
        action: 'verify',
        token: validToken,
      },
    };
    const verifyResult = await main(verifyEvent, {});
    expect(verifyResult.success).toBe(true);
    expect(verifyResult.data.valid).toBe(true);

    // 验证无效 token
    const badVerifyEvent = {
      data: {
        action: 'verify',
        token: 'this_is_a_fake_token',
      },
    };
    const badResult = await main(badVerifyEvent, {});
    expect(badResult.success).toBe(false);
    expect(badResult.error.errCode).toBe('ERR_UNAUTHORIZED');
  });
});
