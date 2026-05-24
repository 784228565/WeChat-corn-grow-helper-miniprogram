# loginManager 云函数

> 用户静默登录与身份同步 — 模块一核心实现

---

## 目录结构

```
loginManager/
├── index.js              # 云函数入口，action 路由分发
├── config/
│   └── index.js          # 配置中心（密钥走环境变量）
├── handlers/
│   └── login.js          # 登录业务 Controller
├── services/
│   ├── wechatAuth.js     # 微信 code2Session 封装
│   ├── userService.js    # Users 集合 CRUD + 并发安全
│   └── tokenService.js   # HMAC Token 签发与校验
├── utils/
│   ├── crypto.js         # 加密/签名工具
│   ├── response.js       # 统一响应格式
│   └── validator.js      # 参数校验
├── __tests__/
│   └── login.test.js     # Jest 单元测试
└── package.json
```

---

## 10. 代码审查（自我 Review）

### Promise 嵌套地狱检查

**结论：无嵌套地狱。**

全项目采用 `async/await` 线性编写，异常通过顶层 `try/catch` 统一捕获：

```js
// ✅ 正确：线性异步流
const { openid } = await WechatAuth.code2Session(code);
const { userId, isNewUser } = await UserService.syncUser(openid, ...);
return Response.success({ userId, token, isNewUser }, requestId);

// ❌ 避免：以下模式在本项目中不存在
someAsync().then(r => {
  return anotherAsync().then(r2 => {
    return thirdAsync().then(r3 => { ... });
  });
});
```

### 其他审查项

| 审查项 | 结论 |
|--------|------|
| 硬编码密钥 | ❌ 不存在。`TOKEN_SECRET` 必须从云开发「环境变量」配置 |
| OpenID 日志泄露 | ❌ 不存在。错误日志仅打印 `requestId` 和 `err.message` |
| 数据库前端权限 | `Users` 集合安全规则应为 `read: false, write: false` |
| 参数注入风险 | `code` 经过正则 `/^[a-zA-Z0-9]{32}$/` 严格校验 |
| 时序攻击风险 | `crypto.timingSafeEqual` 用于签名比对 |

---

## 11. 集成测试：本地 Mock 微信登录态

### 方法一：使用微信开发者工具真机调试（推荐）

1. 在微信开发者工具中点击「云开发」→「云函数」→ 上传并部署 `loginManager`
2. 前端调用 `wx.login()` 获取真实 `code`
3. 调用 `wx.cloud.callFunction({ name: 'loginManager', data: { action: 'login', code } })`
4. 在开发者工具「云开发」→「日志」中查看执行日志

### 方法二：本地 Jest Mock 测试（无微信环境）

```bash
cd cloudfunctions/loginManager
npm install
npm test
```

Jest 已 Mock 整个 `wx-server-sdk`，可离线运行全部 7 个单测用例。

### 方法三：手动构造 Mock Event（Postman/脚本调试）

```js
// 本地调试脚本 mock-local.js
const { main } = require('./index');

async function mockLogin() {
  const event = {
    data: {
      action: 'login',
      code: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6',
      userInfo: { nickName: 'Test Farmer', gender: 1 },
    },
    // 模拟微信云函数调用上下文
    userInfo: { openId: 'mock_openid_local' },
  };

  const result = await main(event, {});
  console.log('Mock Result:', JSON.stringify(result, null, 2));
}

mockLogin();
```

**注意**：本地运行需在 `config/index.js` 中临时设置 `TOKEN_SECRET='dev_secret_123'`，生产环境必须通过环境变量注入。

---

## 12. UI/UX 走查：错误信息 Toast 友好性

所有错误响应的 `errMsg` 字段均经过人工润色，可直接作为前端 `wx.showToast` 的 `title`：

| 场景 | errMsg | 建议 action | 前端表现 |
|------|--------|------------|---------|
| code 过期 | "微信登录凭证已过期，请重新获取" | retry | Toast + 自动重试 wx.login |
| 网络超时 | "连接微信服务器超时" | fallback | Toast + 进入游客模式 |
| 参数错误 | "登录凭证缺失，请重新调用 wx.login" | retry | Toast + 重新登录 |
| 系统繁忙 | "系统繁忙，请稍后再试" | fallback | Toast + 保留当前页面 |
| token 过期 | "登录已过期，请重新登录" | logout | Toast + 跳转欢迎页 |

**前端调用示例：**

```js
wx.cloud.callFunction({
  name: 'loginManager',
  data: { action: 'login', code }
}).then(res => {
  const r = res.result;
  if (!r.success) {
    wx.showToast({ title: r.error.errMsg, icon: 'none' });
    if (r.error.action === 'retry') { /* 自动重试逻辑 */ }
    if (r.error.action === 'logout') { /* 清除缓存并跳转 */ }
  }
});
```

---

## 13. 用户验收测试 (UAT)：Mock 账号数据结构

### Mock 账号 A：新用户「张三」

```json
{
  "_id": "oxABCD1234EFGH5678IJKL9012MNOP3",
  "openid": "oxABCD1234EFGH5678IJKL9012MNOP3",
  "userId": "u_a1b2c3d4",
  "profile": {
    "nickName": "张三",
    "avatarUrl": "https://thirdwx.qlogo.cn/mmopen/vi_32/xxx/132",
    "gender": 1,
    "country": "中国",
    "province": "河南",
    "city": "郑州"
  },
  "farms": [],
  "activeFarmId": "",
  "stats": {
    "loginCount": 1,
    "firstLoginAt": "2026-04-20T08:00:00.000Z",
    "lastLoginAt": "2026-04-20T08:00:00.000Z",
    "lastLoginIp": "218.xxx.xxx.100"
  },
  "session": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "expiresAt": "2026-04-27T08:00:00.000Z",
    "refreshCount": 0
  },
  "createdAt": "2026-04-20T08:00:00.000Z",
  "updatedAt": "2026-04-20T08:00:00.000Z"
}
```

### Mock 账号 B：老用户「李四」（拥有 2 个农场）

```json
{
  "_id": "oxXYZ7890ABCD1234EFGH5678IJKL90",
  "openid": "oxXYZ7890ABCD1234EFGH5678IJKL90",
  "userId": "u_e5f6g7h8",
  "profile": {
    "nickName": "李四",
    "avatarUrl": "https://thirdwx.qlogo.cn/mmopen/vi_32/yyy/132",
    "gender": 2,
    "country": "",
    "province": "",
    "city": ""
  },
  "farms": [
    "farm_001_heritage_corn",
    "farm_002_organic_soy"
  ],
  "activeFarmId": "farm_001_heritage_corn",
  "stats": {
    "loginCount": 42,
    "firstLoginAt": "2025-11-15T06:30:00.000Z",
    "lastLoginAt": "2026-04-20T07:45:00.000Z",
    "lastLoginIp": "36.xxx.xxx.50"
  },
  "session": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "expiresAt": "2026-04-27T07:45:00.000Z",
    "refreshCount": 8
  },
  "createdAt": "2025-11-15T06:30:00.000Z",
  "updatedAt": "2026-04-20T07:45:00.000Z"
}
```

### UAT 验证清单

| 检查项 | 张三（新用户） | 李四（老用户） |
|--------|---------------|---------------|
| 首次登录返回 `isNewUser=true` | ✅ | ❌（应为 false） |
| 前端跳转 setup 引导页 | ✅ | ❌（直达 checkin） |
| 数据库 `loginCount=1` | ✅ | ✅（=42） |
| 数据库 `farms=[]` | ✅ | ✅（=2 个） |
| Token 有效期 7 天 | ✅ | ✅ |
| 杀后台复用缓存 token | ✅ | ✅ |

---

## 部署说明

### 1. 配置环境变量

在微信开发者工具 → 云开发控制台 → 设置 → 环境变量中添加：

```
TOKEN_SECRET=your_random_32_bytes_string_here
```

### 2. 部署云函数

```bash
# 在微信开发者工具中右键 loginManager 文件夹 → 创建并部署：云端安装依赖
# 或命令行
cd cloudfunctions/loginManager
wx cloud functions deploy --name loginManager --env your-env-id
```

### 3. 初始化数据库索引

在云开发控制台 → 数据库 → `Users` 集合 → 索引管理中添加：

- `_id`: 默认主键索引
- `openid`: 唯一索引
- `userId`: 唯一索引
- `session.token`: 普通索引

### 4. 设置安全规则

```json
{
  "Users": {
    "read": false,
    "write": false
  }
}
```

> `Users` 集合禁止前端直接读写，所有操作必须通过 `loginManager` 等云函数代理。
