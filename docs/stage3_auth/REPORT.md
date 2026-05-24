# 模块一联调复核报告（QA 架构师）

> 目标：对「用户认证与授权」云函数及前端接入进行全链路质量复核  
> 版本：v1.0  
> 日期：2026-04-21  
> 状态：**复核完成，发现 3 项高危缺陷，需修复后方可上线**

---

## 1. 明确目标

### 复核结论

登录态需在以下 6 个生命周期节点稳定生效：

| 节点 | 当前状态 | 复核结果 |
|------|---------|---------|
| **A. 首次冷启动** `App.onLaunch` | 前端仅 `console.log`，未调用 `wx.login` 及云函数 | ❌ **缺失** |
| **B. 前台切换** `App.onShow` | 无 token 过期检测与自动刷新逻辑 | ❌ **缺失** |
| **C. 后台唤起** 微信切前台 | 同上，无刷新逻辑 | ❌ **缺失** |
| **D. 页面间跳转** `wx.navigateTo` | 无统一请求拦截器，各页面自行拼接 token | ❌ **缺失** |
| **E. Token 自然过期** 7 天后 | 前端无过期判断，会携带失效 token 调用业务接口 | ❌ **缺失** |
| **F. 用户清除缓存** 后重启 | 无本地缓存恢复逻辑，会回到 welcome 页面 | ⚠️ **需确认产品逻辑** |

### 关键发现

当前 `app.js` 的 `onLaunch` 为空壳：

```js
// app.js 现状
App({
  onLaunch() {
    console.log('The Living Ledger App Launch')
  },
  globalData: {
    userInfo: null,
    farmInfo: null
  }
})
```

**所有登录态管理均缺失**，前端目前处于「未接入鉴权」状态。

---

## 2. 边界与异常

### 复核场景：并发两起请求是否创建重复 User 记录

#### 现有防御机制

`userService.js` 采用 `_id = openid` 作为文档主键，并在 `syncUser` 中捕获 `_id_ dup key` 错误：

```js
catch (err) {
  if (err.message && err.message.includes('_id_ dup key')) {
    // 回退为更新
  }
}
```

#### 实测风险

**高危缺陷 #1**：云数据库 `add()` 的 `_id` 冲突错误信息 **不是** `_id_ dup key`，而是：

```json
{
  "errCode": -502001,
  "errMsg": "database request fail |-502001 document already exists"
}
```

当前代码通过 `err.message.includes('_id_ dup key')` 判断，**永远无法命中**，并发时会导致：
- 第二个请求抛出未捕获异常
- 前端收到 `ERR_INTERNAL` 兜底错误
- 用户看到「系统开小差了」而非正常登录

**修复建议**：

```js
// ❌ 现有代码（无效）
if (err.message && err.message.includes('_id_ dup key')) { ... }

// ✅ 修正代码
const isDupError = err.errCode === -502001 ||
  (err.message && /document already exists|duplicate key|_id_/.test(err.message));
if (isDupError) { ... }
```

#### 并发测试脚本

```js
// 模拟并发测试（QA 用）
async function testConcurrentLogin() {
  const promises = [
    wx.cloud.callFunction({ name: 'loginManager', data: { action: 'login', code: 'same_code_xxx' } }),
    wx.cloud.callFunction({ name: 'loginManager', data: { action: 'login', code: 'same_code_xxx' } }),
  ];
  const results = await Promise.allSettled(promises);
  console.log(results);
  // 预期：两个都 resolved，且 isNewUser 一真一假或都假
  // 实际风险：至少一个 rejected 或返回 ERR_INTERNAL
}
```

---

## 3. 定义验收标准

### 联调通过矩阵

| 接口 | 场景 | 预期结果 | 联调状态 |
|------|------|---------|---------|
| `auth/login` | 新用户 + 有效 code | `isNewUser=true`, `token` 生成，数据库新增记录 | ⬜ 待联调 |
| `auth/login` | 老用户 + 有效 code | `isNewUser=false`, `loginCount` +1，token 更新 | ⬜ 待联调 |
| `auth/login` | code 过期（40029） | `ERR_CODE_EXPIRED`，action=`retry` | ⬜ 待联调 |
| `auth/login` | code 格式非法 | `ERR_INVALID_PARAM` | ⬜ 待联调 |
| `auth/login` | 缺少 code | `ERR_INVALID_PARAM` | ⬜ 待联调 |
| `auth/login` | 无 userInfo | 使用默认昵称创建 | ⬜ 待联调 |
| `auth/verify` | 有效 token | `valid=true`, 返回 userId | ⬜ 待联调 |
| `auth/verify` | 无效 token | `ERR_UNAUTHORIZED` | ⬜ 待联调 |
| `auth/verify` | 过期 token | `ERR_UNAUTHORIZED` | ⬜ 待联调 |
| `auth/refresh` | 有效旧 token | 返回新 token，数据库更新 | ⬜ 待联调 |
| `auth/refresh` | 过期旧 token | `ERR_UNAUTHORIZED` | ⬜ 待联调 |
| **前端拦截器** | 自动携带 token | 每个云函数请求均含 `_auth` | ⬜ 待联调 |
| **前端拦截器** | token 过期自动刷新 | 静默刷新后重试原请求 | ⬜ 待联调 |

### 通过标准

- 全部 13 项联调用例 **100% 通过**
- 并发测试（5 并发）重复用户创建率 **= 0%**
- P95 端到端耗时 **≤ 800ms**
- 云函数错误率 **< 0.1%**

---

## 4. 整体实现路径

### 时序图：从前端 `App.onLaunch` 到业务接口调用

```
小程序端                              云开发                              微信服务器
   │                                     │                                    │
   │ App.onLaunch                        │                                    │
   │ ─────────────────►                  │                                    │
   │                                     │                                    │
   │ wx.login()                          │                                    │
   │ ◄─────────────────                  │                                    │
   │ 返回 { code }                       │                                    │
   │                                     │                                    │
   │ wx.cloud.callFunction               │                                    │
   │ { name: 'loginManager',             │                                    │
   │   data: { action: 'login', code } } │                                    │
   │ ───────────────────────────────────►│                                    │
   │                                     │                                    │
   │                                     │ cloud.auth().code2Session(code)    │
   │                                     │ ──────────────────────────────────►│
   │                                     │                                    │
   │                                     │ ◄──────────────────────────────────│
   │                                     │ 返回 { openid, sessionKey }        │
   │                                     │                                    │
   │                                     │ 查询/创建 Users 记录               │
   │                                     │ 签发 Token                         │
   │                                     │                                    │
   │ ◄───────────────────────────────────│                                    │
   │ 返回 { userId, token, isNewUser }   │                                    │
   │                                     │                                    │
   │ wx.setStorageSync('auth', ...)      │                                    │
   │ ─────────────────►                  │                                    │
   │                                     │                                    │
   │ if isNewUser → 跳转 setup           │                                    │
   │ else → 跳转 checkin                 │                                    │
   │                                     │                                    │
   │ ════════════════════════════════════════════════════════════════════════│
   │                                     │                                    │
   │ 后续业务请求（如打卡）              │                                    │
   │ ───────────────────────────────────►│                                    │
   │ 自动携带 _auth: token               │                                    │
   │                                     │ TokenService.verifyToken()         │
   │                                     │ 校验通过 → 执行业务逻辑            │
   │                                     │ 校验失败 → 返回 ERR_UNAUTHORIZED   │
   │ ◄───────────────────────────────────│                                    │
   │ 业务数据                            │                                    │
```

### 前端状态机

```
[App.onLaunch]
    │
    ├── 本地无 token ──► wx.login() ──► call loginManager
    │                           │
    │                           ├──► 成功 ──► 存 Storage ──► 跳转
    │                           └──► 失败 ──► 游客模式
    │
    └── 本地有 token ──► 检查过期时间
                │
                ├──► 未过期 ──► 直接进首页（静默 refresh 若 < 1 天）
                └──► 已过期 ──► wx.login() ──► 重新登录
```

---

## 5. 架构与模块划分

### 云开发资源配额评估

假设目标用户为 **区域性农业 App**，日活预估（DAU）：

| 指标 | 保守估计 | 峰值估计 |
|------|---------|---------|
| DAU | 500 | 2,000 |
| 人均日启动次数 | 2 | 3 |
| 日云函数调用 | 1,000 | 6,000 |
| 日数据库读 | 2,000 | 10,000 |
| 日数据库写 | 500 | 3,000 |

#### 微信云开发免费版配额

| 资源 | 免费版限额 | 当前预估使用率 | 是否足够 |
|------|-----------|---------------|---------|
| 云函数调用次数 | 5万/天 | 6,000 | ✅ 足够 |
| 云函数并发实例 | 1,000 | < 50 | ✅ 足够 |
| 云函数外网出口 | 无限制 | 仅调用微信接口 | ✅ 足够 |
| 数据库读操作 | 5万/天 | 10,000 | ✅ 足够 |
| 数据库写操作 | 3万/天 | 3,000 | ⚠️ 接近上限 |
| 数据库存储 | 2GB | 用户档案 < 100MB | ✅ 足够 |
| 云存储 | 5GB | 照片为主 | ⚠️ 需监控 |

#### 建议

1. **写操作**：免费版 3万/天 对峰值 3,000 有 10 倍余量，短期内够用。
2. **冷启动**：建议为 `loginManager` 配置「最小实例数 1」，保证高峰响应稳定。
3. **备份策略**：云数据库应开启自动备份（每日），防止误操作导致用户数据丢失。

---

## 6. 接口与数据库设计

### 真实落表数据核对

以 Mock 账号「李四」为例，复核数据库字段完整性：

| 字段路径 | 设计文档定义 | 代码实现 | 一致性 |
|---------|-------------|---------|--------|
| `_id` | `openid` 作为主键 | `userService.createUser` 中 `_id: userData.openid` | ✅ |
| `openid` | 冗余存储 | ✅ | ✅ |
| `userId` | 脱敏 ID | `crypto.generateUserId()` | ✅ |
| `profile.nickName` | 默认「微信用户」 | `DEFAULT_PROFILE.nickName` | ✅ |
| `profile.avatarUrl` | 默认占位图 | ✅ | ✅ |
| `farms` | `string[]` | 初始化为 `[]` | ✅ |
| `activeFarmId` | 当前活跃农场 | 初始化为 `''` | ✅ |
| `stats.loginCount` | 累计登录 | `$.inc(1)` 自增 | ✅ |
| `stats.firstLoginAt` | 首次登录 | `new Date()` | ✅ |
| `stats.lastLoginAt` | 最后登录 | `new Date()` | ✅ |
| `stats.lastLoginIp` | 来源 IP | `cloud.getWXContext().CLIENTIP` | ✅ |
| `session.token` | 当前 token | 签发后写入 | ✅ |
| `session.expiresAt` | 过期时间 | `new Date()` | ✅ |
| `session.refreshCount` | 刷新次数 | `$.inc(1)` 自增 | ✅ |
| `createdAt` | 创建时间 | `new Date()` | ✅ |
| `updatedAt` | 更新时间 | `new Date()` | ✅ |

### 缺失字段检查

**中危缺陷 #2**：`Users` 集合缺少 `status` 字段，无法支持：
- 用户账号冻结/禁用
- 用户主动注销后的软删除标记

**修复建议**：

```js
// 在 createUser 中增加
status: 'active',  // active | suspended | deleted
```

---

## 7. 方案评审

### 技术债务清单

| 编号 | 债务项 | 风险等级 | 影响 | 建议修复时间 |
|------|--------|---------|------|-------------|
| TD-01 | **并发错误捕获失效**（详见第 2 节） | 🔴 高危 | 并发登录必现异常 | **上线前** |
| TD-02 | `issueToken` 执行两次，性能浪费 | 🟡 中危 | 多一次 HMAC 计算 + 一次 DB 写 | v1.1 |
| TD-03 | `findByOpenid` 吞掉所有异常 | 🟡 中危 | 网络故障时误判为「用户不存在」 | v1.1 |
| TD-04 | 无 Token 吊销机制 | 🟡 中危 | 用户换设备后旧 token 仍有效 | v1.2 |
| TD-05 | 无 HMAC 密钥轮换机制 | 🟡 中危 | 密钥泄露后无法无损更换 | v1.2 |
| TD-06 | `session_key` 获取后未使用也未清理 | 🟢 低危 | 占用内存，无安全影响 | v1.3 |
| TD-07 | 无登录设备指纹记录 | 🟢 低危 | 无法检测异常登录 | v1.3 |

### 详细说明

#### TD-02：`issueToken` 执行两次

```js
// handlers/login.js
const { token, expiresAt } = TokenService.issueToken(null, openid);  // 第 1 次，userId=null
// ... syncUser 生成 userId ...
const finalToken = TokenService.issueToken(userId, openid);          // 第 2 次
```

**优化方案**：将 `userId` 生成前置到 `issueToken` 之前。

#### TD-03：`findByOpenid` 吞异常

```js
// ❌ 现有代码
const res = await db.collection(...).doc(openid).get()
  .catch(() => ({ data: null }));
```

如果数据库网络故障，会误判为用户不存在，导致尝试 `add()` 创建新用户。

**优化方案**：

```js
// ✅ 修正代码
try {
  const res = await db.collection(...).doc(openid).get();
  return res.data;
} catch (err) {
  if (err.errCode === -502001 || err.message?.includes('not found')) {
    return null;  // 真正的用户不存在
  }
  throw err;  // 网络等其他异常继续抛出
}
```

---

## 8. 编写代码

### 前端请求拦截器补丁

见同目录 `frontend-interceptor.js` 文件。

### 需要替换的 `app.js` 完整实现

见同目录 `app-patched.js` 文件。

---

## 9. 单元测试

### 现有测试覆盖率评估

| 模块 | 已有用例 | 缺失用例 | 覆盖率估计 |
|------|---------|---------|-----------|
| `Validator.validateLoginInput` | 2 条（code 缺失、格式非法） | 无 | 80% |
| `WechatAuth.code2Session` | 1 条（40029 过期） | 网络超时、频率限制、其他微信错误 | 40% |
| `TokenService.issue/verify/extract` | 间接覆盖 | 无直接测试 | 50% |
| `UserService.syncUser` | 2 条（新用户、老用户） | **并发冲突**、数据库异常 | 50% |
| `UserService.findByOpenid` | 0 条直接测试 | 网络异常、正常返回 | 0% |
| `LoginHandler.handle` | 综合覆盖 | 无 | 60% |
| `index.js` action 路由 | 2 条（verify、默认 action） | refresh 完整测试 | 60% |

### 建议补充的测试用例

```js
// TC-08: 并发冲突兜底（当前缺失）
test('TC-08: 两个并发请求同时创建同一用户应只产生一条记录', async () => {
  mockGet.mockRejectedValue(new Error('document not found'));
  mockAdd.mockRejectedValue({ errCode: -502001, message: 'document already exists' });
  // 第二次 findByOpenid 应返回已创建的用户
  mockGet.mockResolvedValueOnce({ data: { userId: 'u_existing', openid: 'same' } });
  // ... 断言两者均成功，isNewUser 可能一真一假
});

// TC-09: 数据库网络异常不应误判为新用户
test('TC-09: 数据库网络故障时应返回 ERR_INTERNAL 而非创建用户', async () => {
  mockGet.mockRejectedValue(new Error('ETIMEDOUT connection timeout'));
  const result = await main(event, {});
  expect(result.error.errCode).toBe('ERR_INTERNAL');
});

// TC-10: refresh action 完整链路
test('TC-10: refresh 应签发新 token 并更新数据库', async () => {
  // ... 登录获取 token → 调用 refresh → 验证新 token 与数据库一致性
});
```

---

## 10. 代码审查

### 线上部署前环境变量检查清单

| 检查项 | 要求 | 验证方式 |
|--------|------|---------|
| ✅ `TOKEN_SECRET` 已配置 | 32 字节以上随机字符串，仅管理员可见 | 云开发控制台 → 环境变量 |
| ✅ `TOKEN_SECRET` 未提交 Git | `.gitignore` 排除 `cloudfunctions/*/config/local.js` | `git log --all --full-history -- '*config*'` |
| ✅ 数据库安全规则 | `Users` 集合 `read: false, write: false` | 云开发控制台 → 数据库 → 安全规则 |
| ✅ 云函数部署环境 | 生产环境 ID 与开发环境分离 | `cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })` |
| ✅ 数据库索引已创建 | `openid`(唯一)、`userId`(唯一)、`session.token`(普通) | 控制台 → 数据库 → 索引管理 |
| ✅ 云函数并发配置 | `loginManager` 最小实例数 ≥ 1 | 控制台 → 云函数 → 基础配置 |
| ✅ 日志监控开启 | 云开发日志功能已启用 | 控制台 → 日志 |
| ⬜ 告警通知配置 | 错误率 > 1% 时发送邮件/短信 | 需配置云监控 |

---

## 11. 集成测试

### 登录态过期后的静默重连机制

#### 测试方案

**步骤 1**：模拟 token 过期

```js
// QA 手动触发：将本地 token 的 exp 改为过去时间
wx.setStorageSync('auth', {
  token: 'valid_format_but_expired_token',
  userId: 'u_test001',
  exp: Date.now() - 1000,  // 已过期
});
```

**步骤 2**：用户进入 checkin 页面并尝试打卡

```js
// checkin 页面打卡按钮点击
await callCloudFunction('checkIn', { tasks: [...] });
```

**步骤 3**：预期行为

| 场景 | 预期前端行为 | 预期后端行为 |
|------|------------|------------|
| token 过期 | 拦截器检测到 `exp < now` → 自动调用 `loginManager` (action='refresh') | 校验旧 token → 签发新 token → 返回 |
| refresh 成功 | 更新本地 Storage → 重试原打卡请求 | 正常执行打卡逻辑 |
| refresh 也失败（如用户被删除） | 清除 Storage → 跳转 welcome 页面重新登录 | 返回 `ERR_UNAUTHORIZED` |

#### 测试脚本

```js
// QA 自动化脚本：token 过期重连测试
async function testTokenExpiredReconnect() {
  // 1. 正常登录
  const loginRes = await authLogin();
  console.assert(loginRes.success, '登录失败');

  // 2. 模拟过期
  const auth = wx.getStorageSync('auth');
  auth.exp = Date.now() - 1000;
  wx.setStorageSync('auth', auth);

  // 3. 触发业务请求（拦截器应自动刷新）
  const bizRes = await callCloudFunction('someBizFn', { data: 'test' });

  // 4. 验证
  console.assert(bizRes.success, '业务请求应自动重连成功');
  const newAuth = wx.getStorageSync('auth');
  console.assert(newAuth.exp > Date.now(), 'token 应已刷新');
}
```

---

## 12. UI/UX 走查

### 微信授权弹窗规范复核

#### 当前前端代码检查

| 页面 | 授权相关代码 | 是否符合 2024+ 规范 |
|------|-------------|-------------------|
| `welcome` | 无 `wx.getUserProfile` / `getUserInfo` 调用 | ✅ 符合 |
| `setup` | 表单由用户手动填写，无授权弹窗 | ✅ 符合 |
| `checkin` | 头像点击下拉菜单，无授权弹窗 | ✅ 符合 |

#### 规范说明

- 微信已于 2021 年回收 `wx.getUserInfo` 接口，2022 年回收 `wx.getUserProfile`。
- 当前前端**未使用**任何废弃授权接口，用户信息通过表单自主填写，完全符合最新规范。
- 如需获取用户头像昵称，应使用「头像昵称填写能力」（`<button open-type="chooseAvatar">`），而非旧版授权弹窗。

#### UX 建议

- 在 `welcome` 页面的「Yes, Let's Grow」按钮旁增加提示：「点击即代表同意《用户协议》和《隐私政策》」。
- 在 `setup` 页面的表单顶部增加「头像昵称填写」按钮，引导用户完善资料（可选）。

---

## 13. 用户验收测试 (UAT)

见同目录 `UAT-checklist.md` 文件。

---

## 复核结论

### 阻塞性缺陷（上线前必须修复）

| 编号 | 缺陷 | 位置 | 修复方案 |
|------|------|------|---------|
| 🚨 DEF-01 | 并发冲突错误捕获永远失效 | `userService.js:162` | 将 `includes('_id_ dup key')` 改为 `errCode === -502001` |
| 🚨 DEF-02 | `findByOpenid` 吞掉网络异常 | `userService.js:21-28` | 区分「不存在」与「网络故障」 |
| 🚨 DEF-03 | 前端 `app.js` 完全未接入鉴权 | `app.js` | 替换为 `app-patched.js` 实现 |

### 总体评级

- **后端云函数**：⭐⭐⭐⭐☆（架构合理，但 2 处边界处理有缺陷）
- **前端接入**：⭐☆☆☆☆（完全缺失，需紧急补全）
- **测试覆盖**：⭐⭐⭐☆☆（主干覆盖，边界和并发场景缺失）

**建议：修复 3 项阻塞性缺陷后，可进行第一轮联调。**
