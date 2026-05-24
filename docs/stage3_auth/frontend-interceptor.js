/**
 * 前端请求拦截器（Request Interceptor）
 * 目标：自动携带 Token、处理过期刷新、统一错误处理
 *
 * 使用方式：
 *   1. 将本文件复制到小程序 utils/request.js
 *   2. 在 app.js 中 import 并初始化
 *   3. 所有业务页面统一使用 callCloudFunction() 替代 wx.cloud.callFunction()
 */

const AUTH_KEY = 'auth';
const TOKEN_REFRESH_THRESHOLD = 24 * 60 * 60 * 1000; // 1 天（ms）

/**
 * 获取本地存储的鉴权信息
 */
function getAuth() {
  try {
    return wx.getStorageSync(AUTH_KEY) || null;
  } catch (e) {
    return null;
  }
}

/**
 * 保存鉴权信息到本地
 */
function setAuth(auth) {
  wx.setStorageSync(AUTH_KEY, auth);
}

/**
 * 清除本地鉴权信息（登出）
 */
function clearAuth() {
  wx.removeStorageSync(AUTH_KEY);
}

/**
 * 检查 token 是否即将过期
 * @param {number} exp - 过期时间戳（Unix ms）
 */
function isTokenExpiringSoon(exp) {
  if (!exp) return true;
  return exp - Date.now() < TOKEN_REFRESH_THRESHOLD;
}

/**
 * 检查 token 是否已过期
 * @param {number} exp - 过期时间戳（Unix ms）
 */
function isTokenExpired(exp) {
  if (!exp) return true;
  return Date.now() >= exp;
}

/**
 * 执行静默登录
 * 触发场景：首次打开、token 完全过期、用户清除缓存后
 * @returns {Promise<{success: boolean, userId?: string, isNewUser?: boolean}>}
 */
function silentLogin() {
  return new Promise((resolve, reject) => {
    wx.login({
      success: (loginRes) => {
        if (!loginRes.code) {
          reject(new Error('wx.login 未返回 code'));
          return;
        }

        wx.cloud.callFunction({
          name: 'loginManager',
          data: {
            action: 'login',
            code: loginRes.code,
            // 可选：若已通过按钮获取用户信息，可传入
            // userInfo: { nickName, avatarUrl, gender }
          },
        }).then((res) => {
          const result = res.result;
          if (!result || !result.success) {
            reject(new Error(result?.error?.errMsg || '登录失败'));
            return;
          }

          // 保存鉴权信息
          setAuth({
            token: result.data.token,
            userId: result.data.userId,
            exp: Date.now() + result.data.expiresIn * 1000,
            isNewUser: result.data.isNewUser,
          });

          resolve({
            success: true,
            userId: result.data.userId,
            isNewUser: result.data.isNewUser,
          });
        }).catch((err) => {
          reject(err);
        });
      },
      fail: (err) => {
        reject(err);
      },
    });
  });
}

/**
 * 刷新 token
 * 触发场景：token 即将过期（< 1 天）时自动调用
 * @returns {Promise<{success: boolean}>}
 */
function refreshToken() {
  const auth = getAuth();
  if (!auth || !auth.token) {
    return silentLogin();
  }

  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: 'loginManager',
      data: {
        action: 'refresh',
        token: auth.token,
      },
    }).then((res) => {
      const result = res.result;
      if (!result || !result.success) {
        // refresh 失败（token 已被吊销或用户不存在）
        // 降级为重新登录
        clearAuth();
        return silentLogin().then(resolve).catch(reject);
      }

      // 更新本地 token
      auth.token = result.data.token;
      auth.exp = Date.now() + result.data.expiresIn * 1000;
      setAuth(auth);

      resolve({ success: true });
    }).catch((err) => {
      // 网络异常时保留旧 token，不强制登出
      console.warn('[refreshToken] 网络异常，保留旧 token:', err);
      resolve({ success: false, reason: 'network' });
    });
  });
}

/**
 * 统一的云函数调用拦截器
 * 功能：
 *   1. 自动注入 token
 *   2. token 即将过期时自动刷新
 *   3. 业务返回 401 时自动重新登录并重试
 *   4. 统一的错误 Toast 提示
 *
 * @param {string} name - 云函数名称
 * @param {object} data - 业务参数
 * @param {object} options - 额外选项 { showErrorToast: boolean, retryCount: number }
 */
async function callCloudFunction(name, data, options) {
  const opts = Object.assign({ showErrorToast: true, retryCount: 1 }, options);
  let auth = getAuth();

  // 1. 若本地无 token，先执行静默登录
  if (!auth || !auth.token || isTokenExpired(auth.exp)) {
    try {
      await silentLogin();
      auth = getAuth();
    } catch (err) {
      if (opts.showErrorToast) {
        wx.showToast({ title: '登录失败，请检查网络', icon: 'none' });
      }
      throw err;
    }
  }

  // 2. 若 token 即将过期，先刷新（不阻塞业务请求）
  if (isTokenExpiringSoon(auth.exp)) {
    refreshToken().catch(() => {}); // 失败不阻塞主流程
  }

  // 3. 注入 token 并发起请求
  const requestData = Object.assign({}, data, {
    _auth: auth.token,
    _userId: auth.userId,
  });

  try {
    const res = await wx.cloud.callFunction({
      name,
      data: requestData,
    });

    const result = res.result;

    // 4. 处理业务层鉴权失败
    if (result && !result.success && result.error) {
      const errCode = result.error.errCode;
      const action = result.error.action;

      // Token 过期/无效，且允许重试
      if ((errCode === 'ERR_UNAUTHORIZED') && opts.retryCount > 0) {
        clearAuth();
        await silentLogin();
        // 重试原请求（retryCount - 1 防止无限循环）
        return callCloudFunction(name, data, {
          showErrorToast: opts.showErrorToast,
          retryCount: opts.retryCount - 1,
        });
      }

      // 其他错误，统一 Toast 提示
      if (opts.showErrorToast) {
        wx.showToast({ title: result.error.errMsg, icon: 'none' });
      }
    }

    return result;
  } catch (err) {
    // 5. 云函数调用本身失败（网络、超时等）
    console.error(`[callCloudFunction] ${name} failed:`, err);
    if (opts.showErrorToast) {
      wx.showToast({ title: '网络异常，请稍后重试', icon: 'none' });
    }
    throw err;
  }
}

/**
 * 初始化登录态
 * 应在 App.onLaunch 中调用
 */
async function initAuth() {
  const auth = getAuth();

  if (!auth || !auth.token) {
    // 首次打开或缓存被清除
    return silentLogin();
  }

  if (isTokenExpired(auth.exp)) {
    // token 已过期，重新登录
    clearAuth();
    return silentLogin();
  }

  if (isTokenExpiringSoon(auth.exp)) {
    // token 即将过期，静默刷新
    return refreshToken();
  }

  // token 健康，无需操作
  return { success: true, userId: auth.userId, isNewUser: false };
}

/**
 * 主动登出
 */
function logout() {
  clearAuth();
  wx.reLaunch({ url: '/pages/welcome/welcome' });
}

module.exports = {
  callCloudFunction,
  initAuth,
  silentLogin,
  refreshToken,
  logout,
  getAuth,
  clearAuth,
};
