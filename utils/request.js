/**
 * 前端请求拦截器（Request Interceptor）
 * 自动携带 Token、处理过期刷新、统一错误处理
 */

const AUTH_KEY = 'auth';
const TOKEN_REFRESH_THRESHOLD = 24 * 60 * 60 * 1000; // 1 天（ms）

function getAuth() {
  try {
    return wx.getStorageSync(AUTH_KEY) || null;
  } catch (e) {
    return null;
  }
}

function setAuth(auth) {
  wx.setStorageSync(AUTH_KEY, auth);
}

function clearAuth() {
  wx.removeStorageSync(AUTH_KEY);
}

function isTokenExpiringSoon(exp) {
  if (!exp) return true;
  return exp - Date.now() < TOKEN_REFRESH_THRESHOLD;
}

function isTokenExpired(exp) {
  if (!exp) return true;
  return Date.now() >= exp;
}

/**
 * 执行静默登录
 * 云开发环境下，云函数通过 getWXContext() 直接获取 openid，
 * 前端无需调用 wx.login 传 code。
 */
function silentLogin() {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: 'loginManager',
      data: {
        action: 'login',
        // userInfo 可选，若已通过按钮获取可传入
      },
    }).then((res) => {
      const result = res.result;
      if (!result || !result.success) {
        reject(new Error(result?.error?.errMsg || '登录失败'));
        return;
      }

      setAuth({
        token: result.data.token,
        userId: result.data.userId,
        exp: Date.now() + result.data.expiresIn * 1000,
        isNewUser: result.data.isNewUser,
        avatarUrl: result.data.avatarUrl || '',
      });

      resolve({
        success: true,
        userId: result.data.userId,
        isNewUser: result.data.isNewUser,
        avatarUrl: result.data.avatarUrl || '',
      });
    }).catch((err) => {
      reject(err);
    });
  });
}

/**
 * 刷新 token
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
        clearAuth();
        return silentLogin().then(resolve).catch(reject);
      }

      auth.token = result.data.token;
      auth.exp = Date.now() + result.data.expiresIn * 1000;
      setAuth(auth);

      resolve({ success: true });
    }).catch((err) => {
      console.warn('[refreshToken] 网络异常，保留旧 token:', err);
      resolve({ success: false, reason: 'network' });
    });
  });
}

/**
 * 统一的云函数调用拦截器
 */
async function callCloudFunction(name, data, options) {
  const opts = Object.assign({ showErrorToast: true, retryCount: 1 }, options);
  let auth = getAuth();

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

  if (isTokenExpiringSoon(auth.exp)) {
    refreshToken().catch(() => {});
  }

  const requestData = Object.assign({}, data, {
    _auth: { token: auth.token }
  });

  try {
    const res = await wx.cloud.callFunction({
      name,
      data: requestData,
    });

    const result = res.result;

    if (result && !result.success && result.error) {
      const errCode = result.error.errCode;
      if ((errCode === 'ERR_UNAUTHORIZED') && opts.retryCount > 0) {
        clearAuth();
        await silentLogin();
        return callCloudFunction(name, data, {
          showErrorToast: opts.showErrorToast,
          retryCount: opts.retryCount - 1,
        });
      }

      if (opts.showErrorToast) {
        wx.showToast({ title: result.error.errMsg, icon: 'none' });
      }
    }

    return result;
  } catch (err) {
    console.error(`[callCloudFunction] ${name} failed:`, err);
    if (opts.showErrorToast) {
      wx.showToast({ title: '网络异常，请稍后重试', icon: 'none' });
    }
    throw err;
  }
}

/**
 * 初始化登录态
 */
async function initAuth() {
  const auth = getAuth();

  if (!auth || !auth.token) {
    return silentLogin();
  }

  if (isTokenExpired(auth.exp)) {
    clearAuth();
    return silentLogin();
  }

  if (isTokenExpiringSoon(auth.exp)) {
    return refreshToken();
  }

  return { success: true, userId: auth.userId, isNewUser: false, avatarUrl: auth.avatarUrl || '' };
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
