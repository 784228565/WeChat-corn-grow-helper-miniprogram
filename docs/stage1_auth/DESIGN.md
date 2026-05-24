# 模块一：用户认证与授权 — 设计文档

> 功能：用户静默登录与身份同步
> 版本：v1.0
> 日期：2026-04-20

---

## 1. 明确目标

实现微信 OpenID 换取与本地 User 档案的无缝同步。

- **核心目标**：用户打开小程序时无需手动登录，通过 `wx.login` 获取临时 `code`，由后端云函数向微信 auth 服务换取稳定的 `openid`，并以此作为用户唯一标识。
- **同步目标**：若用户是首次访问，自动创建 `Users` 集合记录；若已存在，则更新 `lastLoginAt` 与 `loginCount`。
- **安全目标**：后端不直接暴露 `openid`，而是生成自定义 `token` 返回前端，作为后续请求的鉴权凭证。
- **体验目标**：整个鉴权流程对用户完全透明，耗时控制在 800ms 以内（P95）。

---

## 2. 边界与异常

### 2.1 微信 `code` 过期
- **场景**：`wx.login` 获取的 `code` 有效期为 5 分钟，若因网络延迟导致后端调用 `jscode2session` 时 `code` 已失效。
- **处理**：后端返回错误码 `ERR_CODE_EXPIRED`（`errCode: -1`），前端收到后重新调用 `wx.login` 获取新 `code` 并重试，最多重试 2 次。

### 2.2 网络超时
- **场景**：云函数调用微信服务器超时（默认 5s）。
- **处理**：
  - 云函数内部设置 `axios` / `wx-server-sdk` 请求超时为 3s。
  - 超时后返回 `ERR_NETWORK_TIMEOUT`，前端降级为"游客模式"（仅展示静态内容，禁止打卡和提交数据），并在网络恢复后自动重试。

### 2.3 用户拒绝授权头像昵称
- **场景**：微信小程序 `getUserProfile` / `getUserInfo` 已被回收，新用户可能从未授权过头像和昵称。
- **处理**：
  - `userInfo` 参数为可选（`optional`）。
  - 若缺失，后端使用微信默认昵称（"微信用户"）和默认头像占位图创建档案。
  - 前端在后续流程中通过 "完善资料" 浮层引导用户补充，而非阻塞登录。

### 2.4 其他异常
| 异常类型 | 错误码 | 前端行为 |
|---------|--------|---------|
| 微信服务器 40029 (code 无效) | `ERR_INVALID_CODE` | 重新获取 code 重试 |
| 云函数冷启动超时 | `ERR_FUNCTION_TIMEOUT` | 显示加载动画，3s 后再次调用 |
| 数据库写入失败 | `ERR_DB_WRITE` | 记录日志，返回游客 token，前端提示稍后重试 |

---

## 3. 定义验收标准

### 3.1 安全指标
1. **OpenID 隔离**：`openid` 和 `unionid` 仅存储于云数据库，绝不通过 API 返回给前端；前端仅接收自定义 `token` 和脱敏 `userId`（如 `u_abc123`）。
2. **Token 时效**：自定义 `token` 有效期 7 天，支持静默刷新（前端在 `onShow` 时检测 token 过期时间，小于 1 天时自动调用刷新接口）。
3. **防重放**：`token` 包含签发时间 `iat` 和随机 `jti`，后端校验 `iat` 与当前时间差不得超过 7 天。

### 3.2 性能指标
1. **端到端耗时**：从 `wx.login` 到拿到 `token` 的 P95 耗时 ≤ 800ms（其中微信 `jscode2session` 平均 150-300ms，云函数执行 50-100ms，数据库操作 30-50ms）。
2. **冷启动优化**：通过云函数「预置并发」或「最小实例数 1」降低冷启动概率，确保高峰时段冷启动率 < 5%。

### 3.3 可用性指标
1. **成功率**：鉴权接口可用性 ≥ 99.5%（排除微信服务端故障）。
2. **降级能力**：当鉴权完全失败时，前端可进入"只读游客模式"，保证核心页面（如 Logs 历史）仍可浏览缓存数据。

---

## 4. 整体实现路径

```
┌─────────────┐     ┌─────────────┐     ┌─────────────────┐     ┌─────────────┐
│   小程序    │     │   云函数    │     │   微信服务器    │     │  云数据库   │
│  wx.login   │────▶│  auth.login │────▶│ jscode2session  │     │   Users     │
│  获取 code  │     │  接收 code  │     │  换取 openid   │     │             │
└─────────────┘     └─────────────┘     └─────────────────┘     └─────────────┘
       │                   │                                               ▲
       │                   │                                               │
       │                   │◀──────────────────────────────────────────────┘
       │                   │   查询/创建用户记录，生成自定义 token
       │                   │
       │◀──────────────────┘
       │   返回 { userId, token, isNewUser }
       │
┌──────▼──────┐
│  前端存储   │
│ wx.setStorageSync('token', token)
│ wx.setStorageSync('userId', userId)
└─────────────┘
```

### 详细时序

1. **前端 `App.onLaunch`**：调用 `wx.login()` 获取 `code`。
2. **前端调用云函数**：`wx.cloud.callFunction({ name: 'authLogin', data: { code, userInfo? } })`。
3. **云函数接收请求**：
   - 校验 `code` 非空且长度合法（32 位字符串）。
   - 调用微信 `auth.code2Session`（或 HTTP `jscode2session`）换取 `openid` + `session_key`。
   - 使用 `openid` 作为 key 查询云数据库 `Users` 集合。
4. **分支判断**：
   - **新用户**：`openid` 不存在 → 插入新记录，设置 `createdAt`、`isNewUser: true`。
   - **老用户**：`openid` 存在 → 更新 `lastLoginAt`、`loginCount++`，设置 `isNewUser: false`。
5. **生成 Token**：使用 JWT 或对称签名（`crypto.createHmac`）生成 `token`，载荷包含 `userId`、`openid`（加密存储）、`iat`、`exp`。
6. **返回前端**：`{ success: true, userId, token, isNewUser }`。
7. **前端存储**：`wx.setStorageSync('auth', { token, userId, exp })`。
8. **后续请求**：前端在每个云函数调用中通过 `data: { token }` 传递，后端统一鉴权。

---

## 5. 架构与模块划分

### 5.1 鉴权中间件方案选型

本项目采用 **"基于对称签名的自定义 Token + 云数据库 Session 校验"** 的混合方案，而非纯 JWT。

**理由**：
- 微信小程序云开发环境下，云函数天然可信（腾讯内部网络），无需复杂的非对称签名。
- 对称签名（HMAC-SHA256）计算快、体积小，适合移动端低功耗场景。
- 云数据库中维护 `session` 子文档，支持后端随时吊销 token（如用户登出或异常登录）。

### 5.2 模块划分

```
checkin-server/
├── cloudfunctions/
│   └── auth/
│       ├── index.ts              # 云函数入口
│       ├── handlers/
│       │   └── login.ts          # 登录主逻辑
│       ├── services/
│       │   ├── wechatAuth.ts     # 微信 jscode2session 封装
│       │   ├── tokenService.ts   # token 生成与校验
│       │   └── userService.ts    # 用户 CRUD
│       └── utils/
│           ├── crypto.ts         # HMAC 签名工具
│           └── response.ts       # 统一响应格式
```

### 5.3 中间件流程

```
请求到达云函数
    │
    ▼
┌───────────────┐
│  参数校验层   │  ← 校验 code 格式、userInfo 结构
└───────┬───────┘
        │
        ▼
┌───────────────┐
│  微信鉴权层   │  ← 调用 jscode2session 换取 openid
└───────┬───────┘
        │
        ▼
┌───────────────┐
│  用户同步层   │  ← 查询/创建 Users 记录
└───────┬───────┘
        │
        ▼
┌───────────────┐
│  Token 签发层 │  ← 生成 token 并写入 Sessions
└───────┬───────┘
        │
        ▼
┌───────────────┐
│  响应封装层   │  ← 返回 { success, userId, token, isNewUser }
└───────────────┘
```

---

## 6. 接口与数据库设计

### 6.1 Users 集合表结构

```typescript
interface UserDoc {
  _id: string;              // 云数据库自动生成的唯一 ID
  openid: string;           // 微信 openid（全局唯一，Indexed）
  unionid?: string;         // 微信 unionid（跨应用唯一，可选）
  userId: string;           // 对外暴露的脱敏 ID，如 "u_8a3f9e2"
  profile: {
    nickName: string;       // 昵称，默认 "微信用户"
    avatarUrl: string;      // 头像 URL，默认占位图
    gender: number;         // 0: 未知, 1: 男, 2: 女
  };
  farms: string[];          // 关联的农场 ID 列表
  activeFarmId?: string;    // 当前活跃农场 ID
  stats: {
    loginCount: number;     // 累计登录次数
    firstLoginAt: Date;     // 首次登录时间
    lastLoginAt: Date;      // 最后登录时间
    lastLoginIp?: string;   // 最后登录 IP（云函数自动获取）
  };
  session: {
    token: string;          // 当前有效 token
    expiresAt: Date;        // token 过期时间
    refreshCount: number;   // 累计刷新次数
  };
  createdAt: Date;
  updatedAt: Date;
}
```

### 6.2 索引设计

| 索引字段 | 类型 | 说明 |
|---------|------|------|
| `openid` | 唯一索引 | 微信鉴权核心字段，查询频率最高 |
| `userId` | 唯一索引 | 前端交互使用的脱敏 ID |
| `session.token` | 普通索引 | token 校验时快速定位用户 |
| `stats.lastLoginAt` | 普通索引 | 运营统计、清理过期会话 |

### 6.3 云函数接口定义

```typescript
// 入参
interface AuthLoginInput {
  code: string;                       // wx.login 获取的临时 code
  userInfo?: {                        // 可选，用户授权信息
    nickName?: string;
    avatarUrl?: string;
    gender?: number;
  };
}

// 出参
interface AuthLoginOutput {
  success: boolean;
  userId: string;                     // 脱敏用户 ID，如 "u_8a3f9e2"
  token: string;                      // 自定义鉴权 token
  isNewUser: boolean;                 // 是否首次注册
  expiresIn?: number;                 // token 有效秒数，默认 604800 (7天)
}
```

---

## 7. 方案评审

### 7.1 高并发启动时的冷启动延迟评估

**风险点**：
- 微信小程序云函数在首次调用或长时间无请求时会进入"冷启动"状态，初始化时间 300ms ~ 2000ms 不等。
- 若大量用户同时打开小程序（如早晨 7:00 农事提醒推送后），冷启动叠加会导致鉴权延迟飙升。

**缓解策略**：
1. **预置并发**：在云开发控制台为 `auth` 云函数配置「最小实例数」为 1-2，保持函数热备。
2. **前端防抖**：`App.onLaunch` 中若 1s 内未收到响应，显示骨架屏而非白屏，避免用户感知延迟。
3. **本地缓存**：首次登录成功后，token 本地缓存 7 天。杀后台后再次打开，若 token 未过期，直接跳过鉴权，进入页面后再静默刷新。
4. **降级策略**：若鉴权接口超时，前端使用缓存的 `userId` 进入"离线模式"，关键操作（如打卡）本地队列化，网络恢复后批量同步。

### 7.2 微信服务端依赖风险

- `jscode2session` 是微信官方接口，可用性 99.9%+，但偶发 502/504。
- 云函数内部需设置 **指数退避重试**（1s、2s、4s），最多 3 次。

---

## 8. 编写代码（TypeScript Interface 定义）

见同目录下 `types.ts` 文件。

---

## 9. 单元测试

### 9.1 测试范围

针对 `login.ts` 中的新老用户判定逻辑设计单测。

### 9.2 单测大纲

| 用例编号 | 用例名称 | 前置条件 | 输入 | 预期输出 |
|---------|---------|---------|------|---------|
| TC-01 | 全新用户首次登录 | Users 集合为空 | `code: "valid_code_001"`, `userInfo: { nickName: "Farmer Joe" }` | `isNewUser: true`, `userId` 新生成，`loginCount: 1` |
| TC-02 | 老用户重复登录 | 已存在 openid 记录 | `code: "valid_code_002"` | `isNewUser: false`, `loginCount` +1, `lastLoginAt` 更新 |
| TC-03 | 微信 code 过期 | mock 微信返回 40029 | `code: "expired_code"` | `success: false`, `errCode: "ERR_INVALID_CODE"` |
| TC-04 | 用户拒绝授权 | `userInfo` 为 `undefined` | `code: "valid_code_003"` | `isNewUser: true`, `nickName` 为 "微信用户", `avatarUrl` 为默认图 |
| TC-05 | token 生成唯一性 | 同一用户连续登录两次 | 同一 openid 两次请求 | 两次返回不同 `token`，旧 token 在数据库中被覆盖 |
| TC-06 | 并发登录安全性 | 两个相同 openid 的请求同时到达 | 两个并行请求 | 数据库最终只存在一条用户记录，无重复插入（依赖唯一索引） |

---

## 10. 代码审查

### 10.1 PR 审查清单

| 审查项 | 要求 |
|--------|------|
| **OpenID 脱敏** | 禁止在任何日志、`console.log`、错误信息中打印完整 `openid`。如需调试，仅打印前 4 位 + `****` + 后 4 位。 |
| **Token 密钥管理** | HMAC 密钥必须通过云开发「环境变量」注入，禁止硬编码在代码仓库中。 |
| **数据库权限** | `Users` 集合的安全规则必须设置为 `read: false, write: false`（仅云函数可读写），禁止前端直接访问。 |
| **SQL/NoSQL 注入** | `code` 参数必须经过正则校验（`^[a-zA-Z0-9]{32}$`），防止特殊字符注入。 |
| **敏感字段隔离** | `session_key` 仅用于后端业务（如未来解密手机号），禁止返回给前端或存入数据库长期保留。 |

### 10.2 日志规范

```typescript
// ✅ 正确
console.log('[authLogin] new user created, userId:', userId);

// ❌ 错误
console.log('[authLogin] openid:', openid);  // 泄露敏感信息
```

---

## 11. 集成测试

### 11.1 Token 注入方式

前端在每次调用业务云函数时，将 `token` 放入 `data` 的 `_auth` 字段中：

```typescript
// 前端统一请求封装（位于 utils/request.ts）
function callCloudFunction(name: string, data: any) {
  const auth = wx.getStorageSync('auth');
  return wx.cloud.callFunction({
    name,
    data: {
      ...data,
      _auth: auth?.token,   // 自动注入 token
    }
  });
}
```

### 11.2 后端统一鉴权中间件

每个业务云函数入口处调用 `authMiddleware`：

```typescript
// 云函数入口示例
export async function main(event: any, context: any) {
  const { _auth, ...businessData } = event.data;
  
  // 鉴权中间件
  const authResult = await authMiddleware.verify(_auth);
  if (!authResult.valid) {
    return { success: false, errCode: 'ERR_UNAUTHORIZED' };
  }
  
  // 将 userId 和 openid 注入上下文，供业务逻辑使用
  context.user = authResult.user;
  
  // 执行业务逻辑...
}
```

### 11.3 Token 刷新机制

- 前端在 `App.onShow` 中检查 `auth.exp`（过期时间戳）。
- 若 `exp - now < 86400`（小于 1 天），静默调用 `auth.refresh` 云函数获取新 token。
- 刷新接口校验旧 token 有效性后，生成新 token 并返回，同时更新数据库 `session` 字段。

---

## 12. UI/UX 走查

### 12.1 `isNewUser` 对前端路由的支撑能力

| `isNewUser` 值 | 前端行为 | 目标页面 |
|---------------|---------|---------|
| `true` | 新用户首次打开，跳转「农场设置引导页」 | `pages/setup/setup` |
| `false` | 老用户直接跳转「今日打卡页」 | `pages/checkin/checkin` |
| `true`（但已有未完成设置） | 用户上次中途退出设置，跳转上次进度 | `pages/setup/setup`（带进度恢复） |

### 12.2 前端状态机设计

```
App.onLaunch
    │
    ▼
wx.login() + callFunction('authLogin')
    │
    ├──► 失败 ──► 进入「游客只读模式」（浏览 logs，禁止打卡）
    │
    └──► 成功
            │
            ├──► isNewUser === true ──► wx.redirectTo('/pages/setup/setup')
            │
            └──► isNewUser === false ──► wx.switchTab('/pages/checkin/checkin')
```

### 12.3 体验细节

- **加载态**：鉴权期间显示品牌 Logo + 旋转动画，避免白屏。
- **失败提示**：若鉴权失败，底部出现非阻塞提示条 "网络异常，以游客模式浏览"，点击可手动重试。
- **首次引导**：`isNewUser` 为 `true` 时，setup 页面顶部增加 "欢迎加入！仅需 1 分钟完成设置" 的友好提示。

---

## 13. 用户验收测试 (UAT)

### 13.1 测试链路 A：首次打开小程序

| 步骤 | 操作 | 预期结果 |
|------|------|---------|
| A1 | 卸载小程序后重新搜索进入 | 触发 `App.onLaunch` |
| A2 | 页面显示品牌加载动画 | 用户感知到「正在初始化」 |
| A3 | 自动弹出微信授权框（头像昵称） | 用户点击「允许」 |
| A4 | 云函数 `authLogin` 执行成功 | 返回 `isNewUser: true` |
| A5 | 前端自动跳转到 `setup` 页面 | URL 变为 `pages/setup/setup` |
| A6 | 填写表单并点击 Complete Setup | 跳转到 `checkin` 页面，显示今日任务 |
| A7 | 检查 Storage | `wx.getStorageSync('auth')` 包含 `token`、`userId`、`exp` |
| A8 | 检查云数据库 | `Users` 集合新增一条记录，`openid` 存在，`loginCount: 1` |

### 13.2 测试链路 B：杀后台后二次打开

| 步骤 | 操作 | 预期结果 |
|------|------|---------|
| B1 | 完成链路 A 后，将小程序切到后台（ Home 键） | 小程序进入后台 |
| B2 | 等待 5 分钟后重新打开小程序 | 触发 `App.onShow` |
| B3 | 前端检测到本地 `token` 未过期（< 7 天） | 跳过 `wx.login`，直接使用缓存 token |
| B4 | 页面直接显示 `checkin` 页面内容 | 无加载延迟，用户无感知 |
| B5 | 静默调用 `auth.refresh`（若 token < 1 天过期） | 新 token 自动替换旧 token |
| B6 | 检查云数据库 | `lastLoginAt` 已更新，`loginCount` +1 |

### 13.3 测试链路 C：token 过期场景

| 步骤 | 操作 | 预期结果 |
|------|------|---------|
| C1 | 模拟 token 过期（手动清空 Storage 或等待 7 天） | 前端检测到 `token` 无效 |
| C2 | 用户尝试点击打卡按钮 | 前端拦截，自动触发重新登录流程 |
| C3 | `wx.login` 重新获取 code | 云函数返回新 token |
| C4 | 打卡操作自动重试 | 用户无感知完成鉴权刷新 |

---

## 附录：错误码一览表

| 错误码 | 含义 | HTTP 状态 |
|--------|------|----------|
| `ERR_INVALID_CODE` | 微信 code 无效或已过期 | 400 |
| `ERR_CODE_EXPIRED` | 微信 code 超过 5 分钟有效期 | 400 |
| `ERR_NETWORK_TIMEOUT` | 调用微信服务器超时 | 504 |
| `ERR_FUNCTION_TIMEOUT` | 云函数执行超时 | 504 |
| `ERR_DB_WRITE` | 数据库写入失败 | 500 |
| `ERR_UNAUTHORIZED` | token 无效或已吊销 | 401 |
| `ERR_INVALID_PARAM` | 参数校验失败（如 code 格式不对） | 400 |
