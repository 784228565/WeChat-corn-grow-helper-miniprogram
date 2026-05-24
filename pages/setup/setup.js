/**
 * ====================================================================
 * 补丁文件：pages/setup/setup.js — 对接 farmManager.create
 * ====================================================================
 *
 * 修复内容：
 * 1. onComplete 中收集表单数据，调用 farmManager.create 创建农场
 * 2. 创建成功后携带 farmId 跳转到 checkin 页面
 * 3. 创建失败时显示错误提示，不跳转
 * 4. 增加表单校验（名称必填、作物类型必选）
 *
 * 应用方式：将本文件内容替换 pages/setup/setup.js 的全部内容
 * ====================================================================
 */

const { callCloudFunction } = require('../../utils/request');

Page({
  data: {
    varieties: [
      '利合2162', '利合2366', '利合2468', '利合2476',
      '先玉1688', '先玉1420', '先玉1483', '先玉1619',
      '中淼6S', '玉哈哈L189', '中河玉919', 'KWS2163', '迪卡R1831', '凯元001', '中垦玉618',
      '黄羊299', '金苑玉153', '棒博士767', '东单1331', '东科2356', 'DK2207',
      '中玉303', '翔玉322', '斯泰112', '豫中育181', 'GS919', 'MC333', '西蒙616',
      '联达8799', '联达8822'
    ],
    varietyIndex: -1,
    farmName: '',
    fullName: '',
    phone: '',
    contactLocked: false,
    location: '',
    locationObj: null,
    accumulatedTemp: '',
    soilTypeIndex: -1,
    soilTypes: [
      { label: '碱地（pH > 8.5）', value: '碱地' },
      { label: '沙地（pH 7.0-8.0）', value: '沙地' },
      { label: '中性地（pH 7.0-7.5）', value: '中性地' },
      { label: '泥土地（pH 6.5-7.5）', value: '粘土' }
    ],
    irrigationIndex: -1,
    irrigationMethods: ['滴灌', '漫灌'],
    plantingDensity: '',
    rowSpacing: 'Standard',
    submitting: false
  },

  async onLoad(options) {
    console.log('[setup] onLoad options:', options);
    // 从"添加新农场"跳转过来，不自动跳转回 checkin
    if (options && options.mode === 'new') {
      console.log('[setup] mode=new, skip redirect');
      // 拉取已有农场，预填姓名和电话（只要有数据才锁定）
      try {
        var res = await callCloudFunction('farmManager', { action: 'list' });
        console.log('[setup] preload list result:', res);
        if (res.success && res.data.farms && res.data.farms.length > 0) {
          var existingFarm = res.data.farms[0];
          console.log('[setup] existingFarm contact:', existingFarm.fullName, existingFarm.phone);
          var hasContact = !!(existingFarm.fullName || existingFarm.phone);
          this.setData({
            fullName: existingFarm.fullName || '',
            phone: existingFarm.phone || '',
            contactLocked: hasContact
          });
          console.log('[setup] contact locked:', hasContact, 'type:', typeof hasContact);
        } else {
          console.log('[setup] no existing farms');
        }
      } catch (err) {
        console.warn('[setup] preload contact failed:', err);
      }
      return;
    }
    try {
      var res = await callCloudFunction('farmManager', { action: 'list' });
      console.log('[setup] farm list:', res);
      if (res.success && res.data.farms && res.data.farms.length > 0) {
        console.log('[setup] has farms, redirect to checkin');
        wx.redirectTo({ url: '/pages/checkin/checkin' });
      }
    } catch (err) {
      console.warn('[setup] check existing farms failed:', err);
    }
  },

  bindPickerChange(e) {
    this.setData({
      varietyIndex: parseInt(e.detail.value)
    });
  },

  bindSoilTypeChange(e) {
    this.setData({
      soilTypeIndex: parseInt(e.detail.value)
    });
  },

  bindIrrigationChange(e) {
    this.setData({
      irrigationIndex: parseInt(e.detail.value)
    });
  },

  onInputChange(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({
      [field]: e.detail.value
    });
  },



  chooseLocation() {
    var that = this;
    wx.chooseLocation({
      success: function(res) {
        console.log('[setup] chooseLocation success:', res);
        that.setData({
          location: res.address || res.name || '',
          locationObj: res
        });
      },
      fail: function(err) {
        if (err.errMsg && err.errMsg.indexOf('cancel') > -1) {
          return;
        }
        console.warn('[setup] chooseLocation failed:', err);
        wx.showToast({ title: '选择位置失败', icon: 'none' });
      }
    });
  },

  async onComplete() {
    // 表单校验：优先用 farmName，未填写则 fallback 到 location
    var farmName = this.data.farmName && this.data.farmName.trim();
    var location = this.data.location && this.data.location.trim();

    if (!farmName && !location) {
      wx.showToast({ title: '请输入农场位置', icon: 'none' });
      return;
    }

    if (!farmName) {
      farmName = location;
    }

    if (!this.data.fullName || !this.data.fullName.trim()) {
      wx.showToast({ title: '请输入姓名', icon: 'none' });
      return;
    }

    if (!this.data.phone || !this.data.phone.trim()) {
      wx.showToast({ title: '请输入电话', icon: 'none' });
      return;
    }

    var tempNum = parseInt(this.data.accumulatedTemp, 10);
    if (!tempNum || tempNum < 2000 || tempNum > 3500) {
      wx.showToast({ title: '请输入有效积温（2000-3500℃）', icon: 'none' });
      return;
    }

    if (this.data.soilTypeIndex < 0) {
      wx.showToast({ title: '请选择土地类型', icon: 'none' });
      return;
    }

    if (this.data.irrigationIndex < 0) {
      wx.showToast({ title: '请选择灌溉方式', icon: 'none' });
      return;
    }

    if (this.data.varietyIndex < 0) {
      wx.showToast({ title: '请选择种子品种', icon: 'none' });
      return;
    }

    const seedVariety = this.data.varieties[this.data.varietyIndex];
    const densityNum = parseInt(this.data.plantingDensity, 10);

    this.setData({ submitting: true });

    try {
      var locationData = this.data.locationObj;
      if (!locationData) {
        locationData = {
          address: this.data.location || 'Unknown',
          latitude: 0,
          longitude: 0
        };
      }
      const soilTypeValue = this.data.soilTypes[this.data.soilTypeIndex].value;
      const irrigationValue = this.data.irrigationMethods[this.data.irrigationIndex];
      console.log('[setup] submitting fields:', { accumulatedTemp: tempNum, soilType: soilTypeValue, irrigation: irrigationValue });
      const res = await callCloudFunction('farmManager', {
        action: 'create',
        name: farmName,
        cropType: 'corn',
        location: locationData,
        fullName: this.data.fullName || '',
        phone: this.data.phone || '',
        accumulatedTemp: tempNum,
        soilType: soilTypeValue,
        irrigation: irrigationValue,
        plantingDensity: isNaN(densityNum) ? 0 : densityNum,
        seedVariety: seedVariety,
        rowSpacing: this.data.rowSpacing
      });

      if (!res.success) {
        wx.showToast({
          title: res.error.errMsg || '创建失败',
          icon: 'none'
        });
        this.setData({ submitting: false });
        return;
      }

      // 创建成功：先切换到新农场，再跳转 checkin
      wx.showToast({
        title: '农场创建成功！',
        icon: 'success',
        duration: 1500
      });

      var newFarmId = res.data.farmId;
      console.log('[setup] created farm:', newFarmId, 'switching...');

      // 切换到新创建的农场
      try {
        await callCloudFunction('farmManager', {
          action: 'switch',
          farmId: newFarmId
        });
        console.log('[setup] switch to new farm success');
      } catch (switchErr) {
        console.warn('[setup] switch failed, will still navigate:', switchErr);
      }

      setTimeout(function() {
        wx.navigateTo({
          url: '/pages/checkin/checkin'
        });
      }, 1500);
    } catch (err) {
      console.error('[setup] create farm failed:', err);
      wx.showToast({ title: '网络异常，请重试', icon: 'none' });
      this.setData({ submitting: false });
    }
  },

  navigateTo(e) {
    const page = e.currentTarget.dataset.page;
    wx.navigateTo({
      url: '/pages/' + page + '/' + page
    });
  },

  goBack() {
    wx.navigateBack({ delta: 1 });
  }
});
