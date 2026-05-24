# farmManager（模块二：农场管理）

## 1. 功能概述

提供基于微信登录态（`_auth.token`）鉴权的农场 CRUD 与活跃农场切换能力。

## 2. 接口设计

所有接口均需在 `data` 中携带 `_auth: { token }`。

### 2.1 获取农场列表 — `action: 'list'`

```js
callFunction({
  name: 'farmManager',
  data: {
    action: 'list',
    includeArchived: false, // 可选，默认 false
    _auth: { token: 'xxx' },
  },
});
```

**成功响应：**

```json
{
  "success": true,
  "data": {
    "farms": [
      {
        "farmId": "f_abc12345",
        "name": "河套一号田",
        "cropType": "corn",
        "currentStage": "V2",
        "isActive": true,
        "area": { "unit": "亩", "size": 50 }
      }
    ]
  }
}
```

### 2.2 切换活跃农场 — `action: 'switch'`

```js
callFunction({
  name: 'farmManager',
  data: {
    action: 'switch',
    farmId: 'f_abc12345',
    _auth: { token: 'xxx' },
  },
});
```

**成功响应：**

```json
{
  "success": true,
  "data": {
    "farmId": "f_abc12345",
    "name": "河套一号田",
    "isActive": true,
    "currentStage": "V2"
  }
}
```

**事务说明：**

- 使用 `db.runTransaction` 原子性将当前活跃农场设为 `isActive: false`，目标农场设为 `isActive: true`；
- 任一环节失败即回滚，确保「最多只有一个活跃农场」的约束。

### 2.3 创建新农场 — `action: 'create'`

```js
callFunction({
  name: 'farmManager',
  data: {
    action: 'create',
    name: '河套二号田',
    cropType: 'corn',
    location: { address: '内蒙古巴彦淖尔市', latitude: 40.7512, longitude: 107.4174 },
    plantingDensity: 48000,
    seedVariety: 'DKC 65-95',
    rowSpacing: '大小行',
    _auth: { token: 'xxx' },
  },
});
```

**字段校验：**

| 字段 | 规则 |
|------|------|
| name | 必填，2-20 字符 |
| cropType | 必填，枚举：`corn`, `soybean`, `wheat` |
| latitude / longitude | 可选，范围合法 |
| plantingDensity | 可选，0 - 100000 |
| seedVariety | 可选，1-50 字符 |
| rowSpacing | 可选，任意字符串 |

**成功响应：**

```json
{
  "success": true,
  "data": {
    "farmId": "f_xyz98765",
    "name": "河套二号田",
    "isActive": false,
    "createdAt": 1755607300
  }
}
```

**约束：**

- 每个用户最多 5 个农场；超出返回 `ERR_FARM_LIMIT_REACHED`。

### 2.4 获取农场详情 — `action: 'detail'`

```js
callFunction({
  name: 'farmManager',
  data: {
    action: 'detail',
    farmId: 'f_abc12345',
    _auth: { token: 'xxx' },
  },
});
```

**成功响应：**

```json
{
  "success": true,
  "data": {
    "farmId": "f_abc12345",
    "name": "河套一号田",
    "userId": "u_xxxx",
    "cropType": "corn",
    "location": { "address": "...", "latitude": 40.7512, "longitude": 107.4174 },
    "area": { "unit": "亩", "size": 50 },
    "planting": { "density": 48000, "seedVariety": "DKC 65-95", "rowSpacing": "大小行" },
    "stage": { "currentStage": "V2", "lastCheckIn": null },
    "status": "active"
  }
}
```

## 3. 错误码汇总

| 错误码 | 含义 | 处理策略 |
|--------|------|----------|
| `ERR_UNAUTHORIZED` | Token 无效或过期 | 前端触发重新登录 |
| `ERR_INVALID_PARAM` | 参数校验失败 | 提示用户修正输入 |
| `ERR_INVALID_DENSITY` | 种植密度超出范围 | 提示用户输入合理范围 |
| `ERR_FARM_LIMIT_REACHED` | 农场数量已达上限（5个） | 提示用户删除或归档旧农场 |
| `ERR_FARM_NOT_FOUND` | 农场不存在 | 刷新列表或提示 |
| `ERR_FORBIDDEN` | 越权访问 | 提示无权操作 |
| `ERR_INTERNAL` | 系统异常 | 稍后重试或联系客服 |

## 4. 代码审查关注点（CR Focus）

### 4.1 事务的原子性与隔离性

- 切换农场使用 `db.runTransaction`，确保「只有一个活跃农场」；
- 回滚策略：事务内任一 `update` 失败即抛出异常，自动回滚。

### 4.2 种植密度业务阈值

- 当前上限 `100000`（株/亩），通过 `utils/validator.js` 统一校验；
- 该数值为业务硬阈值，若需调整，仅修改一处。

### 4.3 Token 验证与 farmId 归属校验

- `checkOwnership` 使用 `_id` 精确查询，避免扫描；
- 归属失败返回 `ERR_FORBIDDEN`，明确区分「不存在」与「无权限」。

### 4.4 生成器不可预测性

- `generateFarmId` 使用 `crypto.randomBytes`，不依赖 `Math.random`。

## 5. 部署说明

1. 安装依赖：在 `farmManager/` 目录下执行 `npm install wx-server-sdk`；
2. 上传部署：微信开发者工具 → 右键 `farmManager` → 上传并部署：所有文件；
3. 确保 `Farms` 集合已在云数据库中创建（字段参考 `detail` 响应）。
