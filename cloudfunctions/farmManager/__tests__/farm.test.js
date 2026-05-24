/**
 * farmManager 单元测试
 * 重点测试 db.transaction 在切换农场时的成功与回滚场景
 */

// ==================== Mock wx-server-sdk ====================

const mockGet = jest.fn();
const mockAdd = jest.fn();
const mockUpdate = jest.fn();
const mockCount = jest.fn();
const mockWhere = jest.fn(() => ({ get: mockGet, update: mockUpdate, count: mockCount }));
const mockDoc = jest.fn(() => ({ get: mockGet, update: mockUpdate }));
const mockCollection = jest.fn(() => ({
  doc: mockDoc,
  add: mockAdd,
  where: mockWhere,
}));
const mockRunTransaction = jest.fn();

jest.mock('wx-server-sdk', () => {
  return {
    init: jest.fn(),
    database: jest.fn(() => ({
      collection: mockCollection,
      runTransaction: mockRunTransaction,
      command: { push: jest.fn((v) => ({ $push: v })) },
    })),
    getWXContext: jest.fn(() => ({ OPENID: 'mock_openid' })),
    DYNAMIC_CURRENT_ENV: 'test-env',
  };
});

// ==================== 导入被测模块 ====================

const { main } = require('../index');

// 生成一个有效的 token（与 farmManager 的 TOKEN_SECRET 一致）
const crypto = require('crypto');
const TOKEN_SECRET = 'farm-ledger-8x7k9m2p5n3q6r4t-v2026';
function makeToken(userId) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ userId, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 86400 })).toString('base64url');
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

// ==================== 测试用例 ====================

describe('farmManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // TC-01: 获取农场列表（无归档）
  test('TC-01: list 应返回用户的活跃农场列表', async () => {
    mockGet.mockResolvedValue({
      data: [
        { farmId: 'f_abc12345', name: '农场A', cropType: 'corn', location: { address: 'A地' }, isActive: true, status: 'active' },
        { farmId: 'f_def67890', name: '农场B', cropType: 'soybean', location: { address: 'B地' }, isActive: false, status: 'active' },
      ],
    });

    const event = {
      data: {
        action: 'list',
        _auth: { token: makeToken('u_testuser') },
      },
    };

    const result = await main(event, {});
    expect(result.success).toBe(true);
    expect(result.data.farms).toHaveLength(2);
    expect(result.data.farms[0].isActive).toBe(true);
    expect(mockWhere).toHaveBeenCalledWith({ userId: 'u_testuser', status: 'active' });
  });

  // TC-02: 切换农场 — 事务成功场景
  test('TC-02: switch 应使用事务原子性切换活跃农场', async () => {
    // 前置：目标农场存在且属于当前用户
    mockGet.mockResolvedValue({
      data: {
        farmId: 'f_target01',
        userId: 'u_testuser',
        name: '目标农场',
        stage: { currentStage: 'V2' },
        isActive: false,
      },
    });

    // 模拟事务成功执行
    mockRunTransaction.mockImplementation(async (fn) => {
      const transaction = {
        collection: () => ({
          where: () => ({
            get: jest.fn().mockResolvedValue({ data: [{ _id: 'f_oldfarm01', farmId: 'f_oldfarm01', isActive: true }] }),
            update: jest.fn().mockResolvedValue({}),
          }),
          doc: () => ({ update: jest.fn().mockResolvedValue({}) }),
        }),
      };
      return await fn(transaction);
    });

    const event = {
      data: {
        action: 'switch',
        farmId: 'f_target01',
        _auth: { token: makeToken('u_testuser') },
      },
    };

    const result = await main(event, {});
    expect(result.success).toBe(true);
    expect(result.data.name).toBe('目标农场');
    expect(mockRunTransaction).toHaveBeenCalledTimes(1);
  });

  // TC-03: 切换农场 — 事务回滚场景（目标农场不属于用户）
  test('TC-03: switch 他人农场应返回 ERR_FORBIDDEN，事务不应执行', async () => {
    mockGet.mockResolvedValue({
      data: {
        farmId: 'f_other01',
        userId: 'u_otheruser', // 归属他人
        name: '别人的农场',
      },
    });

    const event = {
      data: {
        action: 'switch',
        farmId: 'f_other01',
        _auth: { token: makeToken('u_testuser') },
      },
    };

    const result = await main(event, {});
    expect(result.success).toBe(false);
    expect(result.error.errCode).toBe('ERR_FORBIDDEN');
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  // TC-04: 创建农场 — 密度阈值校验（代码审查关注点）
  test('TC-04: 种植密度超过 100000 应返回 ERR_INVALID_DENSITY', async () => {
    const event = {
      data: {
        action: 'create',
        _auth: { token: makeToken('u_testuser') },
        name: '超密农场',
        cropType: 'corn',
        location: { latitude: 40.0, longitude: 116.0 },
        plantingDensity: 150000, // 超出上限
        seedVariety: 'DKC 65-95',
      },
    };

    const result = await main(event, {});
    expect(result.success).toBe(false);
    expect(result.error.errCode).toBe('ERR_INVALID_DENSITY');
    expect(mockAdd).not.toHaveBeenCalled();
  });

  // TC-05: 创建农场 — 正常创建并自动设为活跃（首个农场）
  test('TC-05: 首个农场创建后应自动 isActive=true', async () => {
    mockCount.mockResolvedValue({ total: 0 }); // 当前 0 个农场
    mockAdd.mockResolvedValue({ _id: 'f_newfarm1' });
    mockGet.mockResolvedValue({ data: [{ _id: 'wx_user001', userId: 'u_testuser' }] });
    mockUpdate.mockResolvedValue({});

    const event = {
      data: {
        action: 'create',
        _auth: { token: makeToken('u_testuser') },
        name: '河套平原一号田',
        cropType: 'corn',
        location: { address: '内蒙古巴彦淖尔市', latitude: 40.7512, longitude: 107.4174 },
        plantingDensity: 48000,
        seedVariety: 'DKC 65-95',
        rowSpacing: '大小行',
      },
    };

    const result = await main(event, {});
    expect(result.success).toBe(true);
    expect(result.data.isActive).toBe(true);

    // 验证写入的数据包含大小行参数
    const addedDoc = mockAdd.mock.calls[0][0].data;
    expect(addedDoc.planting.rowSpacing).toBe('大小行');
    expect(addedDoc.planting.density).toBe(48000);
    expect(addedDoc.location.latitude).toBe(40.7512);
  });

  // TC-06: 创建农场 — 数量上限拦截
  test('TC-06: 已有 5 个农场时创建应返回 ERR_FARM_LIMIT_REACHED', async () => {
    mockCount.mockResolvedValue({ total: 5 });

    const event = {
      data: {
        action: 'create',
        _auth: { token: makeToken('u_testuser') },
        name: '第六个农场',
        cropType: 'corn',
        location: { latitude: 40.0, longitude: 116.0 },
        plantingDensity: 32000,
        seedVariety: 'P1197',
      },
    };

    const result = await main(event, {});
    expect(result.success).toBe(false);
    expect(result.error.errCode).toBe('ERR_FARM_LIMIT_REACHED');
  });

  // TC-07: 获取详情 — 越权访问
  test('TC-07: 查看他人农场详情应返回 ERR_FORBIDDEN', async () => {
    mockGet.mockResolvedValue({
      data: {
        farmId: 'f_other02',
        userId: 'u_otheruser',
        name: '别人的农场',
      },
    });

    const event = {
      data: {
        action: 'detail',
        farmId: 'f_other02',
        _auth: { token: makeToken('u_testuser') },
      },
    };

    const result = await main(event, {});
    expect(result.success).toBe(false);
    expect(result.error.errCode).toBe('ERR_FORBIDDEN');
  });

  // TC-08: 事务回滚 — 切换不存在的农场
  test('TC-08: 切换不存在的农场应返回 ERR_FARM_NOT_FOUND', async () => {
    mockGet.mockResolvedValue({ data: null }); // 农场不存在

    const event = {
      data: {
        action: 'switch',
        farmId: 'f_notexist',
        _auth: { token: makeToken('u_testuser') },
      },
    };

    const result = await main(event, {});
    expect(result.success).toBe(false);
    expect(result.error.errCode).toBe('ERR_FARM_NOT_FOUND');
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });
});
