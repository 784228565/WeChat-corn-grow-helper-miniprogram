# 农田管家 (The Living Ledger)

一个基于微信小程序云开发的玉米种植管理助手，提供农场设置、生长阶段任务管理、打卡记录、AI 农事咨询等功能。

## 功能特性

- **农场管理**：创建并管理多个农场，设置作物类型、种植面积、地理位置
- **生长阶段追踪**：按玉米生长阶段（VE → R1）推送对应农事任务
- **打卡与日志**：每日农事操作打卡，支持文字、图片记录
- **AI 农事助手**：集成腾讯元器智能体，提供作物病虫害识别、施肥建议、天气预警等咨询服务
- **多媒体记录**：支持上传田间照片，生成临时访问链接
- **订阅消息**：关键农事节点推送提醒

## 技术栈

- **前端**：微信小程序原生框架（WXML / WXSS / JS）
- **后端**：微信云开发（CloudBase）
- **云函数**：Node.js + wx-server-sdk
- **数据库**：云开发 JSON 数据库
- **AI 服务**：腾讯元器（Yuanqi）OpenAPI

## 前置要求

1. [注册微信小程序账号](https://mp.weixin.qq.com/)（个人或企业主体均可）
2. 开通**微信云开发**，记下你的**云开发环境 ID**
3. （可选）注册[腾讯元器](https://yuanqi.tencent.com/)并发布智能体，获取 **Assistant ID** 和 **Token**

## 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/yourusername/the-living-ledger.git
cd the-living-ledger
```

### 2. 配置小程序 AppID

打开 `project.config.json`，填入你的小程序 AppID：

```json
{
  "appid": "wx1234567890abcdef"
}
```

> 在微信公众平台 → 开发 → 开发管理 → 开发设置 中获取 AppID。

### 3. 用微信开发者工具打开项目

1. 下载并安装 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 选择「导入项目」，指向本项目根目录
3. 在弹窗中填入你的 AppID，勾选「使用云开发」
4. 在开发者工具右上角点击「云开发」，确认环境已开通

### 4. 配置云函数环境变量

进入**微信开发者工具 → 云开发控制台 → 云函数 → 版本与配置 → 环境变量**，为以下云函数添加环境变量：

#### 所有业务云函数（共 7 个）

对 `loginManager`、`checkinManager`、`farmManager`、`taskManager`、`mediaManager`、`aiAssistant`、`subscribeManager` 均设置：

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| `TOKEN_SECRET` | Token 签名密钥，**所有云函数必须保持一致** | `your-random-secret-key-min-32-chars` |

> **安全提示**：`TOKEN_SECRET` 建议生成 32 位以上随机字符串，可使用 `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` 生成。请勿将密钥提交到代码仓库。

#### aiAssistant 云函数（额外设置）

| 变量名 | 说明 | 获取方式 |
|--------|------|----------|
| `YUANQI_TOKEN` | 腾讯元器 API Token | 元器发布页 → API 接入 → 复制 Token |

如需修改智能体 ID，编辑 `cloudfunctions/aiAssistant/config/index.js` 中的 `ASSISTANT_ID`。

### 5. 初始化数据库

1. 在开发者工具中，右键 `cloudfunctions/initDatabase` 文件夹 →「创建并部署：云端安装依赖」
2. 部署成功后，再次右键 →「上传并部署：云端安装依赖」（如已部署则跳过）
3. 在开发者工具「云开发控制台 → 数据库」中确认以下集合已创建：
   - `Farms`
   - `Users`
   - `Tasks`
   - `TaskTemplates`
   - `CheckIns`
   - `MediaRecords`
   - `sys_config`

> 若集合未自动创建，可在控制台手动创建同名集合。

### 6. 配置数据库密钥（推荐）

为增强安全性，可在数据库 `sys_config` 集合中创建文档 `_id: "auth"`，写入：

```json
{
  "_id": "auth",
  "tokenSecret": "与 TOKEN_SECRET 环境变量相同的值"
}
```

`loginManager` 和 `aiAssistant` 会优先从数据库读取密钥，支持热更新而无需重新部署云函数。

### 7. 部署所有云函数

在开发者工具中，对以下每个云函数右键 →「上传并部署：云端安装依赖」：

- `loginManager`
- `checkinManager`
- `farmManager`
- `taskManager`
- `mediaManager`
- `aiAssistant`
- `subscribeManager`

### 8. 运行项目

点击微信开发者工具的「编译」按钮，即可在模拟器中预览小程序。

首次进入会自动触发静默登录，新用户将跳转农场设置页面。

## 项目结构

```
.
├── app.js                  # 小程序入口，云开发初始化、登录态管理
├── app.json                # 全局页面与窗口配置
├── app.wxss                # 全局样式
├── project.config.json     # 项目配置（需填入你的 AppID）
├── sitemap.json            # 搜索引擎索引配置
│
├── pages/                  # 小程序页面
│   ├── welcome/            # 欢迎页
│   ├── setup/              # 农场初始化设置
│   ├── checkin/            # 今日打卡首页
│   ├── logs/               # 打卡记录列表
│   ├── ai/                 # AI 农事助手
│   └── notcorn/            # 非玉米作物提示页
│
├── cloudfunctions/         # 云函数
│   ├── loginManager/       # 用户登录与 Token 管理
│   ├── farmManager/        # 农场 CRUD
│   ├── taskManager/        # 任务与生长阶段管理
│   ├── checkinManager/     # 打卡提交与查询
│   ├── mediaManager/       # 图片上传与临时链接
│   ├── aiAssistant/        # 腾讯元器 AI 对话代理
│   ├── subscribeManager/   # 订阅消息推送
│   └── initDatabase/       # 数据库初始化（一次性）
│
├── utils/                  # 前端工具
│   └── request.js          # 统一请求拦截器（自动注入 Token）
│
└── docs/                   # 项目文档与设计稿
```

## 常见问题

### Q1: 提示 "TOKEN_SECRET 未配置"

请确认已在云开发控制台为对应云函数设置了 `TOKEN_SECRET` 环境变量，且已重新部署该云函数。本地修改环境变量后必须重新部署才能生效。

### Q2: AI 助手返回 "配置错误" 或无响应

请检查：
1. `aiAssistant` 云函数是否已设置 `YUANQI_TOKEN` 环境变量
2. `ASSISTANT_ID` 是否与你发布的智能体 ID 一致
3. 智能体是否已在腾讯元器平台发布（未发布状态无法调用）

### Q3: 云函数调用返回 "errCode: -501000"

通常为云开发环境未正确初始化。请检查：
1. 开发者工具右上角是否已登录并选择正确的云开发环境
2. `app.js` 中的 `wx.cloud.init` 是否执行成功
3. 对应云函数是否已正确部署到当前环境

### Q4: 数据库集合未创建

微信云开发的数据库集合不会自动创建（除云函数内首次写入外）。如果 `initDatabase` 执行失败，请在「云开发控制台 → 数据库」中手动创建所需集合。

### Q5: 如何更换 AI 服务提供商？

本项目 AI 对话逻辑封装在 `cloudfunctions/aiAssistant/index.js` 中。如需接入其他 LLM（如 OpenAI、文心一言等），替换该云函数中的请求逻辑即可，前端无需修改。

## 贡献指南

欢迎提交 Issue 和 Pull Request。请在提交前确保：

1. 不要提交任何包含真实 AppID、Token、密钥的代码
2. 云函数配置优先使用 `process.env` 读取环境变量
3. 更新相关文档（如修改数据库结构，请同步更新本文档）

## 许可证

MIT License
