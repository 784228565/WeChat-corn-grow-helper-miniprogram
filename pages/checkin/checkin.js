const { callCloudFunction } = require('../../utils/request');
const cornPlanner = require('../../corn-planner/index');

/**
 * 状态文本映射
 */
function getStatusText(status) {
  var map = { readable: '未开放', checkable: '可打卡', expired: '已逾期' };
  return map[status] || status;
}

Page({
  data: {
    // 农场信息
    farmId: null,
    farmName: '',
    cropName: '',

    // 节点时间线（动态，因方案而异：19~22个节点）
    nodes: [],
    currentNodeIndex: 0,
    totalNodes: 0,
    currentNode: null,
    nodeStatus: 'readable',
    nodeStatusText: '未开放',
    canCheckIn: false,
    nodeStatuses: [],

    // 当前节点任务清单
    tasks: [],
    checkedIn: false,

    // 打卡按钮状态（预计算，避免 WXML 复杂表达式）
    checkInBtnClass: 'btn-disabled',
    checkInBtnIcon: '🔒',
    checkInBtnText: '未到打卡时间',

    // 上传
    uploadCount: 0,
    uploadRemaining: 2,

    // 农场下拉菜单
    showFarmMenu: false,
    farms: [],

    // 加载状态
    loading: true,
    loadingDetail: false,
    hasFarms: false,

    // 订阅状态
    hasSubscribed: false,

    // 用户头像
    avatarUrl: '',

    // 方案摘要
    planScenario: null,

    // 节点日历对象
    nodeCalendar: null,

    // 时间线节点显示样式（预计算，避免 WXML 复杂表达式）
    nodeDisplayClasses: []
  },

  /**
   * 预计算打卡按钮状态
   */
  computeCheckInBtnState: function(checkedIn, nodeStatus) {
    if (checkedIn) {
      return { checkInBtnClass: 'btn-checked', checkInBtnIcon: '✓', checkInBtnText: '已打卡' };
    }
    if (nodeStatus === 'readable') {
      return { checkInBtnClass: 'btn-disabled', checkInBtnIcon: '🔒', checkInBtnText: '未到打卡时间' };
    }
    if (nodeStatus === 'expired') {
      return { checkInBtnClass: '', checkInBtnIcon: '⏰', checkInBtnText: '补打卡' };
    }
    return { checkInBtnClass: '', checkInBtnIcon: '📝', checkInBtnText: '立即打卡' };
  },

  /**
   * 预计算时间线节点显示样式
   */
  computeNodeDisplayClasses: function(nodeStatuses, currentNodeIndex) {
    return nodeStatuses.map(function(status, index) {
      var isActive = index === currentNodeIndex;
      var itemClass, dotClass, labelClass, icon;
      if (isActive) {
        itemClass = 'active';
        dotClass = 'active-dot';
        icon = '🌾';
        labelClass = 'active-label';
      } else if (status === 'expired') {
        itemClass = 'completed';
        dotClass = 'expired-dot';
        icon = '⏰';
        labelClass = 'expired-label';
      } else if (status === 'checkable') {
        itemClass = 'checkable';
        dotClass = 'checkable-dot';
        icon = '📍';
        labelClass = 'checkable-label';
      } else {
        itemClass = 'upcoming';
        dotClass = 'upcoming-dot';
        icon = '🌿';
        labelClass = 'upcoming-label';
      }
      return {
        nodeIndex: index + 1,
        itemClass: itemClass,
        dotClass: dotClass,
        icon: icon,
        labelClass: labelClass,
        lineClass: status === 'expired' ? 'completed-line' : 'upcoming-line',
        hasLine: index < nodeStatuses.length - 1
      };
    });
  },

  /**
   * 检查当前用户订阅状态
   */
  checkSubscriptionStatus: function() {
    var that = this;
    callCloudFunction('subscribeManager', {
      action: 'check'
    }).then(function(res) {
      if (res.success) {
        that.setData({ hasSubscribed: res.data.subscribed });
        console.log('[checkin] subscription status:', res.data.subscribed);
      }
    }).catch(function(err) {
      console.warn('[checkin] check subscription failed:', err);
    });
  },

  /**
   * 页面加载：拉取农场列表 + 活跃农场详情
   */
  onLoad() {
    var app = getApp();
    var avatarUrl = (app.globalData.userInfo && app.globalData.userInfo.avatarUrl) || '';
    this.setData({ avatarUrl: avatarUrl });
    this.loadFarmList();
  },

  /**
   * 页面显示：刷新列表（处理从 setup 返回的情况）
   */
  onShow() {
    this.loadFarmList();
  },

  /**
   * 拉取农场列表
   */
  async loadFarmList() {
    this.setData({ loading: true });

    try {
      const res = await callCloudFunction('farmManager', { action: 'list' });

      if (!res.success) {
        wx.showToast({ title: res.error.errMsg || '加载失败', icon: 'none' });
        this.setData({ loading: false });
        return;
      }

      const rawFarms = res.data.farms || [];

      // 无农场：显示空状态
      if (rawFarms.length === 0) {
        this.setData({
          farms: [],
          hasFarms: false,
          loading: false,
          farmName: '',
          cropName: ''
        });
        return;
      }

      // 字段对齐
      const farms = rawFarms.map(function(f) {
        return {
          farmId: f.farmId,
          name: f.name,
          location: (f.location && f.location.address) ? f.location.address : '位置未知',
          isActive: !!f.isActive,
          currentStage: f.currentStage || 'VE',
          cropType: f.cropType || 'corn'
        };
      });

      // 找到当前活跃农场
      let activeFarm = farms.find(function(f) { return f.isActive; });
      if (!activeFarm && farms.length > 0) {
        activeFarm = farms[0];
        farms[0].isActive = true;
      }

      this.setData({
        farms: farms,
        hasFarms: true,
        farmId: activeFarm ? activeFarm.farmId : null,
        farmName: activeFarm ? activeFarm.name : '',
        cropName: activeFarm ? formatCropName(activeFarm.cropType) : '',
        loading: false
      });

      // 拉取活跃农场的完整详情
      if (activeFarm && activeFarm.farmId) {
        this.loadFarmDetail(activeFarm.farmId);
      }
    } catch (err) {
      console.error('[checkin] loadFarmList failed:', err);
      wx.showToast({ title: '网络异常，请稍后重试', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  /**
   * 拉取农场详情并生成动态节点日历
   */
  async loadFarmDetail(farmId) {
    if (!farmId) return;
    this.setData({ loadingDetail: true });

    try {
      const res = await callCloudFunction('farmManager', {
        action: 'detail',
        farmId: farmId
      });

      if (!res.success || !res.data || !res.data.farm) {
        console.warn('[checkin] loadFarmDetail invalid response:', res);
        this.setData({ loadingDetail: false });
        return;
      }

      const farm = res.data.farm;
      const now = new Date();

      // 生成动态节点日历（基于农场条件，每个方案节点数不同）
      var calendar = cornPlanner.generateNodeCalendar(farm);
      if (!calendar) {
        console.warn('[checkin] failed to generate node calendar');
        this.setData({
          nodes: [],
          currentNode: null,
          tasks: [],
          planScenario: null,
          nodeCalendar: null,
          loadingDetail: false
        });
        return;
      }

      // 计算最佳展示节点
      var bestIndex = cornPlanner.findBestNode(calendar, now);
      var currentIndex = bestIndex;
      var currentNode = calendar.nodes[currentIndex];

      // 计算当前节点状态
      var status = currentNode.targetDate
        ? cornPlanner.computeNodeStatus(currentNode.targetDate, now)
        : 'readable';

      // 计算所有节点状态（用于时间线渲染）
      var allStatuses = cornPlanner.computeAllNodeStatuses(calendar, now);

      // 预计算时间线显示样式
      var displayClasses = this.computeNodeDisplayClasses(allStatuses, currentIndex);

      // 加载方案摘要
      var scenario = cornPlanner.matchScenario(farm.accumulatedTemp, farm.soilType, farm.irrigation);
      var summary = scenario ? cornPlanner.getPlanSummary(farm, scenario) : null;
      if (summary) {
        summary.farmName = farm.name;
        summary.accumulatedTemp = farm.accumulatedTemp;
        summary.soilType = farm.soilType;
        summary.irrigation = farm.irrigation;
        summary.userVariety = farm.planting && farm.planting.variety ? farm.planting.variety : '';
        summary.userDensity = farm.planting && farm.planting.density ? farm.planting.density : '';
        summary.userRowSpacing = farm.planting && farm.planting.rowSpacing ? farm.planting.rowSpacing : '';
      }

      // 加载当前节点任务
      var tasks = currentNode.tasks || [];

      this.setData({
        nodes: calendar.nodes,
        currentNodeIndex: currentIndex,
        totalNodes: calendar.nodes.length,
        currentNode: currentNode,
        nodeStatus: status,
        nodeStatusText: getStatusText(status),
        canCheckIn: status !== 'readable',
        nodeStatuses: allStatuses,
        nodeDisplayClasses: displayClasses,
        tasks: tasks,
        farmName: farm.name,
        cropName: formatCropName(farm.cropType),
        farmDetail: farm,
        planScenario: summary,
        nodeCalendar: calendar,
        loadingDetail: false
      });

      // 加载当前节点的打卡和上传状态
      this.loadNodeStatus(farmId, currentNode.id);

      // 检查订阅状态
      this.checkSubscriptionStatus();
    } catch (err) {
      console.error('[checkin] loadFarmDetail failed:', err);
      this.setData({ loadingDetail: false });
    }
  },

  /**
   * 切换农场
   */
  async selectFarm(e) {
    const farmId = e.currentTarget.dataset.farmid;
    if (!farmId || farmId === this.data.farmId) {
      this.setData({ showFarmMenu: false });
      return;
    }

    const targetFarm = this.data.farms.find(function(f) { return f.farmId === farmId; });
    if (!targetFarm) {
      this.setData({ showFarmMenu: false });
      return;
    }

    const prevFarmId = this.data.farmId;
    const prevNodeIndex = this.data.currentNodeIndex;
    const prevFarmName = this.data.farmName;

    // 乐观更新：简化过渡状态
    const updatedFarms = this.data.farms.map(function(f) {
      return Object.assign({}, f, { isActive: f.farmId === farmId });
    });

    this.setData({
      showFarmMenu: false,
      farms: updatedFarms,
      farmId: farmId,
      farmName: targetFarm.name,
      cropName: formatCropName(targetFarm.cropType),
      nodes: [],
      currentNode: null,
      currentNodeIndex: 0,
      totalNodes: 0,
      nodeStatus: 'readable',
      nodeStatusText: '未开放',
      canCheckIn: false,
      nodeStatuses: [],
      tasks: [],
      nodeCalendar: null,
      loadingDetail: true,
      checkedIn: false
    });

    try {
      const res = await callCloudFunction('farmManager', {
        action: 'switch',
        farmId: farmId
      });

      if (!res.success) {
        console.warn('[checkin] switch failed, rolling back:', res.error);
        this.rollbackFarmSelection(prevFarmId, prevNodeIndex, prevFarmName);
        wx.showToast({
          title: res.error.errMsg || '切换失败，请重试',
          icon: 'none'
        });
        return;
      }

      wx.showToast({
        title: '已切换到：' + res.data.name,
        icon: 'none',
        duration: 1500
      });

      this.loadFarmDetail(farmId);
      this.emitFarmSwitched(farmId);
    } catch (err) {
      console.error('[checkin] switch error:', err);
      this.rollbackFarmSelection(prevFarmId, prevNodeIndex, prevFarmName);
      wx.showToast({ title: '网络异常，切换失败: ' + (err.message || ''), icon: 'none' });
    }
  },

  /**
   * 加载当前节点的打卡和上传状态
   */
  async loadNodeStatus(farmId, nodeId) {
    try {
      // 查询该节点是否已打卡
      var checkRes = await callCloudFunction('checkinManager', {
        action: 'list',
        farmId: farmId,
        page: 1,
        limit: 50
      });
      var checkedIn = false;
      if (checkRes.success && checkRes.data.logs) {
        checkedIn = checkRes.data.logs.some(function(log) { return log.nodeId === nodeId; });
      }

      // 查询该节点已上传的媒体文件数量
      var mediaRes = await callCloudFunction('mediaManager', {
        action: 'listByStage',
        farmId: farmId,
        stage: nodeId
      });
      var uploadCount = 0;
      if (mediaRes.success && mediaRes.data.files) {
        uploadCount = mediaRes.data.files.length;
      }

      this.setData({
        checkedIn: checkedIn,
        uploadCount: uploadCount,
        uploadRemaining: Math.max(0, 2 - uploadCount)
      });
    } catch (err) {
      console.warn('[checkin] loadNodeStatus failed:', err);
    }
  },

  /**
   * 回滚农场选择（乐观更新失败时调用）
   */
  rollbackFarmSelection(prevFarmId, prevNodeIndex, prevFarmName) {
    const farms = this.data.farms.map(function(f) {
      return Object.assign({}, f, { isActive: f.farmId === prevFarmId });
    });
    this.setData({
      farms: farms,
      farmId: prevFarmId,
      farmName: prevFarmName,
      loadingDetail: false
    });
  },

  /**
   * 触发跨模块事件
   */
  emitFarmSwitched(farmId) {
    try {
      const eventBus = require('../../utils/eventBus');
      eventBus.emit('farm:switched', { farmId: farmId });
    } catch (e) {
      const app = getApp();
      if (app && app.globalData) {
        app.globalData.farmInfo = {
          farmId: farmId,
          switchedAt: Date.now()
        };
      }
    }
  },

  /**
   * 任务切换（前端乐观更新）
   */
  async toggleTask(e) {
    const id = e.currentTarget.dataset.id;
    const prevTasks = this.data.tasks;
    const task = prevTasks.find(function(t) { return t.id === id; });
    if (!task) return;

    const newCompleted = !task.completed;
    const tasks = prevTasks.map(function(t) {
      if (t.id === id) {
        return Object.assign({}, t, {
          completed: newCompleted,
          meta: newCompleted ? '刚刚' : t.meta
        });
      }
      return t;
    });
    this.setData({ tasks: tasks });

    // 如需同步到后端，可在这里调用 taskManager
    // 当前版本仅本地记录完成状态
  },

  /**
   * 打卡提交
   */
  async onCheckIn() {
    if (this.data.nodeStatus === 'readable') {
      wx.showToast({ title: '该节点未到打卡时间', icon: 'none' });
      return;
    }

    if (this.data.checkedIn) {
      wx.showToast({ title: '该节点已打卡，请勿重复打卡', icon: 'none' });
      return;
    }

    const allCompleted = this.data.tasks.every(function(t) { return t.completed; });
    if (!allCompleted) {
      wx.showToast({ title: '请先完成所有任务', icon: 'none' });
      return;
    }

    var farm = this.data.farms.find(function(f) { return f.farmId === this.data.farmId; }.bind(this));
    var timestamp = Date.now();
    var currentNode = this.data.currentNode;

    try {
      var res = await callCloudFunction('checkinManager', {
        action: 'submit',
        farmId: this.data.farmId,
        stage: currentNode ? currentNode.id : '',
        nodeId: currentNode ? currentNode.id : '',
        nodeTitle: currentNode ? currentNode.title : '',
        timestamp: timestamp,
        location: farm ? farm.location : '',
        note: '',
        photos: []
      });

      if (!res.success) {
        wx.showToast({ title: res.error.errMsg || '打卡失败', icon: 'none' });
        return;
      }

      var btnState = this.computeCheckInBtnState(true, this.data.nodeStatus);
      this.setData(Object.assign({ checkedIn: true }, btnState));
      wx.showToast({ title: '打卡成功！', icon: 'success', duration: 2000 });

      setTimeout(function() {
        wx.navigateTo({ url: '/pages/logs/logs' });
      }, 1500);
    } catch (err) {
      console.error('[checkin] submit error:', err);
      wx.showToast({ title: 'Network error, please retry', icon: 'none' });
    }
  },

  /**
   * 上传图片/视频（每节点最多2次）
   */
  async onUploadMedia(e) {
    if (this.data.nodeStatus === 'readable') {
      wx.showToast({ title: '该节点未到上传时间', icon: 'none' });
      return;
    }

    if (this.data.uploadRemaining <= 0) {
      wx.showToast({ title: '该节点上传次数已达上限（2次）', icon: 'none' });
      return;
    }

    var fileType = e.currentTarget.dataset.type;
    var that = this;
    var chooseFunc = fileType === 'video' ? wx.chooseVideo : wx.chooseImage;
    var chooseParams = fileType === 'video'
      ? { sourceType: ['album', 'camera'], maxDuration: 60, camera: 'back' }
      : { count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'] };

    chooseFunc.call(wx, Object.assign({}, chooseParams, {
      success: function(res) {
        var tempFilePath = fileType === 'video' ? res.tempFilePath : res.tempFilePaths[0];
        var nodeId = that.data.currentNode ? that.data.currentNode.id : 'unknown';
        var cloudPath = 'media/' + that.data.farmId + '/' + nodeId + '/' + Date.now() + '_' + Math.floor(Math.random() * 10000) + (fileType === 'video' ? '.mp4' : '.jpg');

        wx.showLoading({ title: '上传中...' });

        wx.cloud.uploadFile({
          cloudPath: cloudPath,
          filePath: tempFilePath,
          success: function(uploadRes) {
            callCloudFunction('mediaManager', {
              action: 'upload',
              farmId: that.data.farmId,
              stage: nodeId,
              nodeId: nodeId,
              fileId: uploadRes.fileID,
              fileType: fileType
            }).then(function(recordRes) {
              wx.hideLoading();
              if (recordRes.success) {
                var newCount = that.data.uploadCount + 1;
                that.setData({
                  uploadCount: newCount,
                  uploadRemaining: Math.max(0, 2 - newCount)
                });
                wx.showToast({ title: '上传成功（还剩' + that.data.uploadRemaining + '次）', icon: 'none' });
              } else {
                wx.showToast({ title: recordRes.error?.errMsg || '上传记录失败', icon: 'none' });
              }
            }).catch(function(err) {
              wx.hideLoading();
              console.error('[checkin] upload record failed:', err);
              wx.showToast({ title: '上传记录失败', icon: 'none' });
            });
          },
          fail: function(err) {
            wx.hideLoading();
            console.error('[checkin] upload file failed:', err);
            wx.showToast({ title: '上传失败', icon: 'none' });
          }
        });
      },
      fail: function(err) {
        console.log('[checkin] user cancelled upload');
      }
    }));
  },

  /**
   * 点击 Timeline 节点切换
   */
  onSelectNode(e) {
    var index = e.currentTarget.dataset.index;
    if (index === undefined || index === this.data.currentNodeIndex) return;

    var calendar = this.data.nodeCalendar;
    if (!calendar || !calendar.nodes[index]) return;

    var now = new Date();
    var node = calendar.nodes[index];
    var status = node.targetDate ? cornPlanner.computeNodeStatus(node.targetDate, now) : 'readable';

    // 重新计算时间线显示样式（因为 currentNodeIndex 变了）
    var displayClasses = this.computeNodeDisplayClasses(this.data.nodeStatuses, index);

    var btnState = this.computeCheckInBtnState(false, status);
    this.setData(Object.assign({
      currentNodeIndex: index,
      currentNode: node,
      nodeStatus: status,
      nodeStatusText: getStatusText(status),
      canCheckIn: status !== 'readable',
      nodeDisplayClasses: displayClasses,
      tasks: node.tasks || [],
      checkedIn: false,
      loadingDetail: true
    }, btnState));

    // 加载新节点的打卡和上传状态
    var that = this;
    this.loadNodeStatus(this.data.farmId, node.id).then(function() {
      that.setData({ loadingDetail: false });
    }).catch(function() {
      that.setData({ loadingDetail: false });
    });
  },

  /**
   * 下拉菜单开关
   */
  toggleFarmMenu() {
    this.setData({ showFarmMenu: !this.data.showFarmMenu });
  },

  closeFarmMenu() {
    this.setData({ showFarmMenu: false });
  },

  /**
   * 添加新农场
   */
  addNewFarm() {
    this.setData({ showFarmMenu: false });
    wx.navigateTo({
      url: '/pages/setup/setup?mode=new',
      fail: function(err) {
        console.error('[checkin] navigateTo setup failed:', err);
        wx.showToast({ title: '跳转失败: ' + err.errMsg, icon: 'none' });
      }
    });
  },

  /**
   * 请求订阅次日施肥提醒
   */
  requestSubscribe() {
    var that = this;
    var TEMPLATE_ID = '-wzNyO3VNSqWHEZzgt1LLuhP0GQ3bex0Pp8TYBaZNAg';

    if (!TEMPLATE_ID || TEMPLATE_ID.length < 20) {
      wx.showToast({ title: '模板ID格式不正确', icon: 'none' });
      return;
    }

    wx.requestSubscribeMessage({
      tmplIds: [TEMPLATE_ID],
      success: function(res) {
        if (res[TEMPLATE_ID] === 'accept') {
          wx.showToast({ title: '订阅成功', icon: 'success' });
          that.setData({ hasSubscribed: true });
          callCloudFunction('subscribeManager', {
            action: 'subscribe',
            farmId: that.data.farmId,
            templateId: TEMPLATE_ID
          }).catch(function(err) {
            console.warn('[checkin] save subscribe failed:', err);
          });
        } else if (res[TEMPLATE_ID] === 'reject') {
          wx.showToast({ title: '您已拒绝订阅', icon: 'none' });
        } else if (res[TEMPLATE_ID] === 'ban') {
          wx.showToast({ title: '请前往设置开启订阅权限', icon: 'none' });
        }
      },
      fail: function(err) {
        console.error('[checkin] requestSubscribeMessage failed:', err);
        wx.showToast({ title: '订阅失败: ' + (err.errMsg || ''), icon: 'none' });
      }
    });
  },

  /**
   * 底部导航
   */
  onAvatarError() {
    this.setData({ avatarUrl: '' });
  },

  navigateTo(e) {
    const page = e.currentTarget.dataset.page;
    if (page === 'checkin') return;
    wx.navigateTo({
      url: '/pages/' + page + '/' + page
    });
  }
});

/**
 * 作物类型 → 显示名称
 */
function formatCropName(cropType) {
  const map = {
    'corn': '甜玉米',
    'soybean': '大豆',
    'wheat': '小麦',
    'rice': '水稻',
    'cotton': '棉花'
  };
  return map[cropType] || (cropType || '作物');
}
