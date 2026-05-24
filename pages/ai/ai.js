const { callCloudFunction } = require('../../utils/request')

Page({
  data: {
    messages: [],
    inputValue: '',
    loading: false,
    farmId: null,
    currentStage: 'V2',
    suggestions: [],
    avatarUrl: ''
  },

  initAvatarUrl() {
    var app = getApp()
    var avatarUrl = (app.globalData.userInfo && app.globalData.userInfo.avatarUrl) || ''
    this.setData({ avatarUrl: avatarUrl })
  },

  loadAvatarFromStorage() {
    try {
      var auth = wx.getStorageSync('auth')
      if (auth && auth.avatarUrl) {
        this.setData({ avatarUrl: auth.avatarUrl })
      }
    } catch (e) {}
  },

  onLoad() {
    this.initAvatarUrl()
    this.loadFarmContext()
  },

  async loadFarmContext() {
    try {
      var res = await callCloudFunction('farmManager', { action: 'list' })
      if (res.success && res.data.farms && res.data.farms.length > 0) {
        var activeFarm = res.data.farms.find(function(f) { return f.isActive }) || res.data.farms[0]
        this.setData({
          farmId: activeFarm.farmId,
          currentStage: activeFarm.currentStage || 'V2'
        })
        this.loadSuggestions()
        this.addWelcomeMessage()
      }
    } catch (err) {
      console.error('[ai] 加载农场上下文出错:', err)
    }
  },

  async loadSuggestions() {
    if (!this.data.farmId) return
    try {
      var res = await callCloudFunction('aiAssistant', {
        action: 'getSuggestions',
        farmId: this.data.farmId,
        currentStage: this.data.currentStage
      })
      if (res.success) {
        this.setData({ suggestions: res.data.suggestions || [] })
      }
    } catch (err) {
      console.error('[ai] 加载建议出错:', err)
    }
  },

  addWelcomeMessage() {
    this.setData({
      messages: [{
        type: 'ai',
        content: '早上好！我是您的 AI 农事助手。请问关于 ' + this.data.currentStage + ' 阶段玉米的作物健康、天气趋势或病虫害识别方面的问题。',
        chips: [{ label: this.data.currentStage + ' 阶段', value: this.data.currentStage }]
      }]
    })
  },

  onInputChange(e) {
    this.setData({ inputValue: e.detail.value })
  },

  async sendMessage() {
    var message = this.data.inputValue.trim()
    if (!message) {
      wx.showToast({ title: '请输入消息', icon: 'none' })
      return
    }
    if (!this.data.farmId) {
      wx.showToast({ title: '未获取到农场信息，请先创建农场', icon: 'none' })
      return
    }

    var messages = this.data.messages.concat([{ type: 'user', content: message }])
    this.setData({ messages: messages, inputValue: '', loading: true })

    try {
      console.log('[ai] 调用 aiAssistant, 农场ID=' + this.data.farmId)
      var res = await callCloudFunction('aiAssistant', {
        action: 'chat',
        farmId: this.data.farmId,
        message: message,
        context: { currentStage: this.data.currentStage, location: '' }
      })
      console.log('[ai] aiAssistant 返回:', res)

      if (res && res.success) {
        messages = messages.concat([{
          type: 'ai',
          content: res.data.reply.content,
          chips: res.data.reply.chips || [],
          source: res.data.reply.source || 'unknown',
          steps: res.data.reply.steps || [],
          showSteps: false
        }])
      } else {
        var errMsg = (res && res.error && res.error.errMsg) ? res.error.errMsg : '服务暂时不可用，请重试。'
        var errCode = (res && res.error && res.error.errCode) ? res.error.errCode : 'UNKNOWN'
        console.error('[ai] aiAssistant 返回错误: 错误码=' + errCode + ', 消息=' + errMsg)
        console.error('[ai] 完整响应:', JSON.stringify(res, null, 2))
        messages = messages.concat([{ type: 'ai', content: '⚠️ [' + errCode + '] ' + errMsg }])
      }
    } catch (err) {
      console.error('[ai] 发送消息出错:', err)
      messages = messages.concat([{ type: 'ai', content: '网络异常，请检查网络连接后重试。' }])
    }

    this.setData({ messages: messages, loading: false })
  },

  async sendSuggestion(e) {
    var query = e.currentTarget.dataset.query
    this.setData({ inputValue: query })
    await this.sendMessage()
  },

  toggleSteps(e) {
    var index = e.currentTarget.dataset.index
    var messages = this.data.messages.map(function(msg, i) {
      if (i === index && msg.type === 'ai') {
        return Object.assign({}, msg, { showSteps: !msg.showSteps })
      }
      return msg
    })
    this.setData({ messages: messages })
  },

  formatRole(role) {
    var map = { assistant: '助手', tool: '工具调用', system: '系统', user: '用户' }
    return map[role] || role || '步骤'
  },

  onAvatarError() {
    this.setData({ avatarUrl: '' })
  },

  navigateTo(e) {
    var page = e.currentTarget.dataset.page
    if (page === 'ai') return
    wx.navigateTo({ url: '/pages/' + page + '/' + page })
  }
})
