const { callCloudFunction } = require('../../utils/request')

Page({
  data: {
    logs: [],
    loading: true,
    hasMore: false,
    page: 1,
    limit: 10,
    farmId: null,
    avatarUrl: ''
  },

  initAvatarUrl() {
    var app = getApp()
    var avatarUrl = (app.globalData.userInfo && app.globalData.userInfo.avatarUrl) || ''
    this.setData({ avatarUrl: avatarUrl })
  },

  onLoad() {
    this.initAvatarUrl()
    this.loadFarmAndLogs()
  },

  onShow() {
    this.loadFarmAndLogs()
  },

  async loadFarmAndLogs() {
    try {
      var farmRes = await callCloudFunction('farmManager', { action: 'list' })
      if (!farmRes.success || !farmRes.data.farms || farmRes.data.farms.length === 0) {
        this.setData({ loading: false, logs: [] })
        return
      }

      var activeFarm = farmRes.data.farms.find(function(f) { return f.isActive })
      if (!activeFarm) activeFarm = farmRes.data.farms[0]

      this.setData({ farmId: activeFarm.farmId })
      this.loadLogs(1)
    } catch (err) {
      console.error('[logs] loadFarmAndLogs error:', err)
      this.setData({ loading: false })
    }
  },

  async loadLogs(page) {
    if (!this.data.farmId) return
    if (page === 1) {
      this.setData({ loading: true, logs: [] })
    }

    try {
      var res = await callCloudFunction('checkinManager', {
        action: 'list',
        farmId: this.data.farmId,
        page: page,
        limit: this.data.limit
      })

      if (!res.success) {
        this.setData({ loading: false })
        return
      }

      var logs = res.data.logs || []
      var hasMore = res.data.hasMore

      var formattedLogs = logs.map(function(log) {
        var date = new Date(log.checkedInAt)
        return Object.assign({}, log, {
          dateText: formatDate(date),
          stageLabel: log.stage + ' STAGE'
        })
      })

      var allLogs = page === 1 ? formattedLogs : this.data.logs.concat(formattedLogs)

      this.setData({
        logs: allLogs,
        hasMore: hasMore,
        page: page,
        loading: false
      })
    } catch (err) {
      console.error('[logs] loadLogs error:', err)
      this.setData({ loading: false })
    }
  },

  loadMore() {
    if (!this.data.hasMore || this.data.loading) return
    this.loadLogs(this.data.page + 1)
  },

  async viewDetail(e) {
    var checkInId = e.currentTarget.dataset.id
    wx.showToast({ title: '详情：' + checkInId, icon: 'none' })
  },

  onAvatarError() {
    this.setData({ avatarUrl: '' })
  },

  navigateTo(e) {
    var page = e.currentTarget.dataset.page
    if (page === 'logs') return
    wx.navigateTo({ url: '/pages/' + page + '/' + page })
  }
})

function formatDate(date) {
  return (date.getMonth() + 1) + '月' + date.getDate() + '日 ' + date.getFullYear() + '年'
}
