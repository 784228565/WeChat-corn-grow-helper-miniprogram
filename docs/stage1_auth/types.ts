/**
 * 模块一：用户认证与授权 — TypeScript 类型定义
 * @module stage1_auth
 * @version 1.0.0
 */

// ============================================================
// 1. 微信官方接口返回类型
// ============================================================

/**
 * 微信 jscode2session 接口返回结构
 * @see https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/user-login/code2Session.html
 */
export interface WechatCode2SessionResponse {
  /** 用户唯一标识 */
  openid: string;
  /** 会话密钥（仅用于后端解密，禁止返回前端） */
  session_key: string;
  /** 用户在开放平台的唯一标识符（需绑定微信开放平台） */
  unionid?: string;
  /** 错误码 */
  errcode?: number;
  /** 错误信息 */
  errmsg?: string;
}

// ============================================================
// 2. 云函数入参 / 出参类型
// ============================================================

/**
 * auth.login 云函数入参
 * 由前端 wx.login() + wx.cloud.callFunction 传入
 */
export interface AuthLoginInput {
  /** wx.login 获取的临时登录凭证，有效期 5 分钟 */
  code: string;
  /** 可选：用户授权的头像昵称信息 */
  userInfo?: WechatUserInfo;
}

/**
 * 微信用户信息（getUserProfile / getUserInfo 返回结构）
 */
export interface WechatUserInfo {
  /** 用户昵称 */
  nickName?: string;
  /** 头像 URL */
  avatarUrl?: string;
  /** 性别：0-未知，1-男，2-女 */
  gender?: number;
  /** 用户所在国家 */
  country?: string;
  /** 用户所在省份 */
  province?: string;
  /** 用户所在城市 */
  city?: string;
  /** 显示 country + province + city 的完整地址 */
  language?: string;
}

/**
 * auth.login 云函数成功出参
 */
export interface AuthLoginOutput {
  /** 业务成功标识 */
  success: true;
  /** 对外暴露的脱敏用户 ID，示例：u_8a3f9e2 */
  userId: string;
  /** 自定义鉴权令牌，后续请求携带 */
  token: string;
  /** 是否为首次注册的新用户 */
  isNewUser: boolean;
  /** token 有效时长，单位：秒，默认 7 天 */
  expiresIn: number;
}

/**
 * auth.login 云函数错误出参
 */
export interface AuthLoginError {
  /** 业务失败标识 */
  success: false;
  /** 错误码，用于前端判断具体错误类型 */
  errCode: AuthErrorCode;
  /** 人类可读的错误描述 */
  errMsg: string;
  /** 建议前端行为：retry / redirect / fallback */
  action?: ErrorAction;
}

/**
 * auth.refresh 云函数入参（Token 刷新）
 */
export interface AuthRefreshInput {
  /** 当前有效的旧 token */
  token: string;
}

/**
 * auth.refresh 云函数出参
 */
export interface AuthRefreshOutput {
  success: true;
  token: string;
  expiresIn: number;
}

// ============================================================
// 3. 错误码枚举
// ============================================================

/** 认证模块错误码 */
export type AuthErrorCode =
  | 'ERR_INVALID_CODE'      // 微信 code 无效或格式错误
  | 'ERR_CODE_EXPIRED'      // 微信 code 已过期（> 5 分钟）
  | 'ERR_NETWORK_TIMEOUT'   // 调用微信服务器超时
  | 'ERR_FUNCTION_TIMEOUT'  // 云函数执行超时
  | 'ERR_DB_WRITE'          // 数据库写入失败
  | 'ERR_DB_READ'           // 数据库读取失败
  | 'ERR_UNAUTHORIZED'      // token 无效、过期或已吊销
  | 'ERR_INVALID_PARAM'     // 参数校验失败
  | 'ERR_WECHAT_SERVER'     // 微信服务端返回非预期错误
  | 'ERR_INTERNAL';         // 内部未知错误

/** 建议前端动作 */
export type ErrorAction =
  | 'retry'      // 重新调用 wx.login 并重试
  | 'redirect'   // 跳转特定页面（如授权页）
  | 'fallback'   // 进入游客只读模式
  | 'logout';    // 清除本地缓存并重新登录

// ============================================================
// 4. 数据库集合类型定义
// ============================================================

/**
 * Users 集合文档结构
 * 存储于云数据库 `Users` 集合
 */
export interface UserDoc {
  /** 云数据库自动生成的文档 ID */
  _id: string;
  /** 微信 openid（全局唯一，敏感信息） */
  openid: string;
  /** 微信 unionid（跨应用唯一，可选） */
  unionid?: string;
  /** 对外暴露的脱敏用户 ID */
  userId: string;
  /** 用户个人资料 */
  profile: UserProfile;
  /** 关联的农场 ID 列表 */
  farms: string[];
  /** 当前活跃农场 ID */
  activeFarmId?: string;
  /** 用户统计信息 */
  stats: UserStats;
  /** 会话与 Token 信息 */
  session: UserSession;
  /** 文档创建时间 */
  createdAt: Date;
  /** 文档最后更新时间 */
  updatedAt: Date;
}

/**
 * 用户个人资料子文档
 */
export interface UserProfile {
  /** 用户昵称，默认 "微信用户" */
  nickName: string;
  /** 头像 URL，默认系统占位图 */
  avatarUrl: string;
  /** 性别：0-未知，1-男，2-女 */
  gender: number;
  /** 用户所在国家 */
  country?: string;
  /** 用户所在省份 */
  province?: string;
  /** 用户所在城市 */
  city?: string;
}

/**
 * 用户统计信息子文档
 */
export interface UserStats {
  /** 累计登录次数 */
  loginCount: number;
  /** 首次登录时间 */
  firstLoginAt: Date;
  /** 最后登录时间 */
  lastLoginAt: Date;
  /** 最后登录 IP（云函数自动注入） */
  lastLoginIp?: string;
}

/**
 * 用户会话子文档
 */
export interface UserSession {
  /** 当前有效 token */
  token: string;
  /** token 过期时间 */
  expiresAt: Date;
  /** 累计刷新次数 */
  refreshCount: number;
}

// ============================================================
// 5. Token 载荷类型（JWT / HMAC 签名内部结构）
// ============================================================

/**
 * Token 解码后的载荷结构
 * 不对外暴露，仅后端鉴权中间件使用
 */
export interface TokenPayload {
  /** 对外用户 ID */
  userId: string;
  /** 加密后的 openid（AES-256-GCM） */
  encryptedOpenid: string;
  /** token 唯一标识（防重放） */
  jti: string;
  /** 签发时间（Unix 时间戳） */
  iat: number;
  /** 过期时间（Unix 时间戳） */
  exp: number;
}

/**
 * 鉴权中间件校验结果
 */
export interface AuthVerifyResult {
  /** token 是否有效 */
  valid: boolean;
  /** 若有效，返回解密后的用户信息 */
  user?: {
    userId: string;
    openid: string;
  };
  /** 若无效，返回具体错误码 */
  errCode?: AuthErrorCode;
}

// ============================================================
// 6. 前端本地存储类型
// ============================================================

/**
 * 前端 wx.setStorageSync('auth') 存储结构
 */
export interface FrontendAuthStorage {
  /** 鉴权 token */
  token: string;
  /** 脱敏用户 ID */
  userId: string;
  /** token 过期时间戳（Unix ms） */
  exp: number;
  /** 是否为新用户，用于控制首次引导 */
  isNewUser: boolean;
}

// ============================================================
// 7. 云函数通用上下文类型
// ============================================================

/**
 * 经过鉴权中间件注入后的云函数上下文
 */
export interface AuthenticatedContext {
  /** 当前请求的用户信息 */
  user: {
    userId: string;
    openid: string;
  };
  /** 云函数环境信息 */
  env: string;
  /** 请求来源 IP */
  sourceIp: string;
}

/**
 * 统一云函数响应包装器
 */
export interface CloudFunctionResponse<T = any> {
  /** 请求唯一追踪 ID（用于日志排查） */
  requestId: string;
  /** 业务成功/失败 */
  success: boolean;
  /** 业务数据 */
  data?: T;
  /** 错误信息（success=false 时存在） */
  error?: AuthLoginError;
}
