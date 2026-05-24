Page({
  onYesTap() {
    wx.navigateTo({
      url: '/pages/setup/setup'
    })
  },
  onNoTap() {
    wx.navigateTo({
      url: '/pages/notcorn/notcorn'
    })
  }
})
