/**
 * 替换后的 app.js 完整实现
 * 原文件位于：checkin/app.js
 */

const { initAuth, getAuth } = require('./utils/request');

App({
  globalData: {
    userInfo: null,
    farmInfo: null,
  },

  async onLaunch() {
    // 必须先初始化云开发环境
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
      return
    }
    wx.cloud.init({
      env: wx.cloud.DYNAMIC_CURRENT_ENV,
      traceUser: true,
    })
    console.log('[App] 云开发初始化完成')

    try {
      const result = await initAuth();

      if (result.success) {
        // 清理已失效的微信默认头像 URL（老用户缓存中可能还存着）
        var avatarUrl = this._sanitizeAvatarUrl(result.avatarUrl);

        this.globalData.userInfo = {
          userId: result.userId,
          isNewUser: result.isNewUser,
          avatarUrl: avatarUrl,
        };

        // 根据新老用户决定跳转
        if (result.isNewUser) {
          console.log('[App] 新用户，跳转农场设置');
          wx.redirectTo({ url: '/pages/setup/setup' });
        } else {
          console.log('[App] 老用户，跳转今日打卡');
          wx.redirectTo({ url: '/pages/checkin/checkin' });
        }
      } else {
        console.warn('[App] 登录态初始化失败，进入游客模式');
        this._enterGuestMode();
      }
    } catch (err) {
      console.error('[App] 登录异常:', err);
      this._enterGuestMode();
    }
  },

  async onShow() {
    // 杀后台后重新唤起时，检查 token 是否即将过期
    const auth = getAuth();
    if (auth && auth.exp) {
      const oneDay = 24 * 60 * 60 * 1000;
      if (auth.exp - Date.now() < oneDay) {
        console.log('[App] onShow 检测到 token 即将过期，静默刷新');
        const { refreshToken } = require('./utils/request');
        refreshToken().catch(() => {});
      }
    }
  },

  /**
   * 过滤已失效的头像 URL，避免渲染层 400 错误
   */
  _sanitizeAvatarUrl(url) {
    if (!url) return '';
    // 微信官方默认头像域名，在小程序渲染层会被拦截返回 400
    if (url.indexOf('mmbiz.qpic.cn') !== -1) {
      // 同时清理本地 storage 中的缓存
      try {
        var auth = wx.getStorageSync('auth');
        if (auth && auth.avatarUrl) {
          auth.avatarUrl = '';
          wx.setStorageSync('auth', auth);
        }
      } catch (e) {}
      return '';
    }
    return url;
  },

  /**
   * 进入游客模式（降级策略）
   * 允许浏览静态内容，禁止打卡和提交数据
   */
  _enterGuestMode() {
    wx.showToast({
      title: '网络异常，以游客模式浏览',
      icon: 'none',
      duration: 3000,
    });

    // 游客模式下停留在当前页面，不强制跳转
    // 关键操作按钮（打卡、提交）应在各自页面判断 auth 是否存在
  },
});
