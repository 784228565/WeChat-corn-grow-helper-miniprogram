// Absolute Path: C:\Users\78422\WeChatProjects\checkin\cloudfunctions\taskManager\config\index.js
// Description: 任务管理模块配置中心

// Token 签名密钥（与 loginManager / farmManager 保持一致）
const TOKEN_SECRET = process.env.TOKEN_SECRET || '';

// 数据库集合名
const COLLECTIONS = {
  FARMS: 'Farms',
  TASKS: 'Tasks',
  TASK_TEMPLATES: 'TaskTemplates',
  USERS: 'Users'
};

// 支持的作物类型
const SUPPORTED_CROPS = ['corn', 'soybean', 'wheat', 'rice', 'cotton'];

// 玉米生长阶段定义（共12阶段）
const CORN_STAGES = [
  'VE', 'V1', 'V2', 'V3', 'V4', 'V5',
  'V6', 'V7', 'V8', 'V9', 'VT', 'R1'
];

// AI Insight 兜底数据（按作物类型 + 阶段预置）
// 兼容说明：本配置为新增字段，不影响既有 Users/Farms 结构
const PREBUILT_INSIGHTS = {
  corn: {
    VE: {
      title: '出苗期重点',
      content: '每天监测土壤湿度。确保发芽所需水分充足，但避免积水。检查田间出苗是否均匀。',
      priorityTask: '土壤湿度检查',
      weatherAlert: '预计2天内有强降雨，请确保排水通畅。'
    },
    V1: {
      title: '一叶期发育',
      content: '第一片叶已完全展开，根系正在建立。注意早期害虫如地老虎和金针虫。',
      priorityTask: '虫害巡查',
      weatherAlert: null
    },
    V2: {
      title: '除草关键窗口期',
      content: 'V2期植株有两片叶领，根系快速扩展。这是早期除草和确保水分充足的关键时期。',
      priorityTask: '杂草评估',
      weatherAlert: '预计明天有强降雨，请优先完成田间巡查。'
    },
    V3: {
      title: '生长点仍在地下',
      content: '三片叶完全展开，生长点仍在土表以下，使植株能抵御霜冻和冰雹。继续除草管理。',
      priorityTask: '杂草评估',
      weatherAlert: null
    },
    V4: {
      title: '转向地上生长',
      content: '四片叶展开，生长点接近土表。如土壤条件允许，开始追施氮肥。',
      priorityTask: '营养评估',
      weatherAlert: null
    },
    V5: {
      title: '快速营养生长',
      content: '五片叶展开，根系已充分建立。这是苗后除草剂施用的最后有效窗口期。',
      priorityTask: '除草剂施用窗口',
      weatherAlert: null
    },
    V6: {
      title: '中期营养生长',
      content: '六片叶展开，植株进入快速生长期。注意营养缺乏，尤其是氮素。',
      priorityTask: '营养评估',
      weatherAlert: null
    },
    VT: {
      title: '抽雄期',
      content: '雄穗完全抽出。这是需水最敏感的时期，确保授粉期间灌溉充足。',
      priorityTask: '灌溉检查',
      weatherAlert: '预计高温，请增加灌溉频率。'
    },
    R1: {
      title: '吐丝期',
      content: '花丝已可见，授粉至关重要。注意剪花丝害虫并确保水分充足。',
      priorityTask: '授粉监测',
      weatherAlert: null
    }
  }
};

// 任务模板初始化数据 — 中性/沙性土壤全程施肥方案（12阶段 × 2-4任务）
// 来源：副本施肥方案.xlsx
const DEFAULT_TASK_TEMPLATES = [
  { cropType: 'corn', stage: 'VE', name: '完成底肥/干播湿出滴灌（30方/亩）', description: '4月25日 · 底肥/干播湿出，滴灌水量30方/亩', category: 'irrigation', sortOrder: 1 },
  { cropType: 'corn', stage: 'VE', name: '施用增产包1（拌种剂、杀虫剂）', description: '4月25日 · 底肥/干播湿出：施用增产包1（拌种剂、杀虫剂），成本约25元/亩', category: 'fertilizer', sortOrder: 2 },
  { cropType: 'corn', stage: 'VE', name: '施用15-32-6 复合肥料（35斤/亩）', description: '4月25日 · 底肥/干播湿出：施用15-32-6 复合肥料 35斤/亩，成本约92.6元/亩', category: 'fertilizer', sortOrder: 3 },
  { cropType: 'corn', stage: 'VE', name: '施用增产包2（有机肥、菌肥）', description: '4月25日 · 底肥/干播湿出：施用增产包2（有机肥、菌肥），成本约25元/亩', category: 'fertilizer', sortOrder: 4 },
  { cropType: 'corn', stage: 'V1', name: '完成第二水滴灌（30方/亩）', description: '6月5日 · 第二水，滴灌水量30方/亩', category: 'irrigation', sortOrder: 1 },
  { cropType: 'corn', stage: 'V1', name: '施用19-19-19 水溶肥（7斤/亩）', description: '6月5日 · 第二水：施用19-19-19 水溶肥 7斤/亩，成本约26.9元/亩', category: 'fertilizer', sortOrder: 2 },
  { cropType: 'corn', stage: 'V1', name: '施用硫铵追肥（20斤/亩）', description: '6月5日 · 第二水：施用硫铵追肥 20斤/亩，成本约8元/亩', category: 'fertilizer', sortOrder: 3 },
  { cropType: 'corn', stage: 'V1', name: '施用增产包3（促进吸收、活化土壤）', description: '6月5日 · 第二水：施用增产包3（促进吸收、活化土壤），成本约24元/亩', category: 'fertilizer', sortOrder: 4 },
  { cropType: 'corn', stage: 'V2', name: '完成第三水滴灌（30方/亩）', description: '6月15日 · 第三水，滴灌水量30方/亩', category: 'irrigation', sortOrder: 1 },
  { cropType: 'corn', stage: 'V2', name: '施用19-19-19 水溶肥（7斤/亩）', description: '6月15日 · 第三水：施用19-19-19 水溶肥 7斤/亩，成本约26.9元/亩', category: 'fertilizer', sortOrder: 2 },
  { cropType: 'corn', stage: 'V2', name: '施用硫铵追肥（20斤/亩）', description: '6月15日 · 第三水：施用硫铵追肥 20斤/亩，成本约8元/亩', category: 'fertilizer', sortOrder: 3 },
  { cropType: 'corn', stage: 'V3', name: '完成第四水滴灌（30方/亩）', description: '6月25日 · 第四水，滴灌水量30方/亩', category: 'irrigation', sortOrder: 1 },
  { cropType: 'corn', stage: 'V3', name: '施用19-19-19 水溶肥（7斤/亩）', description: '6月25日 · 第四水：施用19-19-19 水溶肥 7斤/亩，成本约26.9元/亩', category: 'fertilizer', sortOrder: 2 },
  { cropType: 'corn', stage: 'V3', name: '施用硫铵追肥（20斤/亩）', description: '6月25日 · 第四水：施用硫铵追肥 20斤/亩，成本约8元/亩', category: 'fertilizer', sortOrder: 3 },
  { cropType: 'corn', stage: 'V4', name: '完成第五水滴灌（25方/亩）', description: '7月5日 · 第五水，滴灌水量25方/亩', category: 'irrigation', sortOrder: 1 },
  { cropType: 'corn', stage: 'V4', name: '施用10-5-39 水溶肥（7斤/亩）', description: '7月5日 · 第五水：施用10-5-39 水溶肥 7斤/亩，成本约26.9元/亩', category: 'fertilizer', sortOrder: 2 },
  { cropType: 'corn', stage: 'V4', name: '施用硫铵追肥（20斤/亩）', description: '7月5日 · 第五水：施用硫铵追肥 20斤/亩，成本约8元/亩', category: 'fertilizer', sortOrder: 3 },
  { cropType: 'corn', stage: 'V4', name: '施用增产包4（营养全面、长效增产）', description: '7月5日 · 第五水：施用增产包4（营养全面、长效增产），成本约25元/亩', category: 'fertilizer', sortOrder: 4 },
  { cropType: 'corn', stage: 'V5', name: '完成第六水滴灌（25方/亩）', description: '7月12日 · 第六水，滴灌水量25方/亩', category: 'irrigation', sortOrder: 1 },
  { cropType: 'corn', stage: 'V5', name: '施用10-5-39 水溶肥（7斤/亩）', description: '7月12日 · 第六水：施用10-5-39 水溶肥 7斤/亩，成本约26.9元/亩', category: 'fertilizer', sortOrder: 2 },
  { cropType: 'corn', stage: 'V5', name: '施用尿硝追肥（10斤/亩）', description: '7月12日 · 第六水：施用尿硝追肥 10斤/亩，成本约17.5元/亩', category: 'fertilizer', sortOrder: 3 },
  { cropType: 'corn', stage: 'V6', name: '完成第七水滴灌（25方/亩）', description: '7月19日 · 第七水，滴灌水量25方/亩', category: 'irrigation', sortOrder: 1 },
  { cropType: 'corn', stage: 'V6', name: '施用尿素追肥（10斤/亩）', description: '7月19日 · 第七水：施用尿素追肥 10斤/亩，成本约8元/亩', category: 'fertilizer', sortOrder: 2 },
  { cropType: 'corn', stage: 'V6', name: '施用10-5-39 水溶肥（7斤/亩）', description: '7月19日 · 第七水：施用10-5-39 水溶肥 7斤/亩，成本约26.9元/亩', category: 'fertilizer', sortOrder: 3 },
  { cropType: 'corn', stage: 'V7', name: '完成第八水滴灌（25方/亩）', description: '7月26日 · 第八水，滴灌水量25方/亩', category: 'irrigation', sortOrder: 1 },
  { cropType: 'corn', stage: 'V7', name: '施用尿硝追肥（10斤/亩）', description: '7月26日 · 第八水：施用尿硝追肥 10斤/亩，成本约17.5元/亩', category: 'fertilizer', sortOrder: 2 },
  { cropType: 'corn', stage: 'V7', name: '施用10-5-39 水溶肥（7斤/亩）', description: '7月26日 · 第八水：施用10-5-39 水溶肥 7斤/亩，成本约26.9元/亩', category: 'fertilizer', sortOrder: 3 },
  { cropType: 'corn', stage: 'V8', name: '完成第九水滴灌（30方/亩）', description: '8月5日 · 第九水，滴灌水量30方/亩', category: 'irrigation', sortOrder: 1 },
  { cropType: 'corn', stage: 'V8', name: '施用尿素追肥（10斤/亩）', description: '8月5日 · 第九水：施用尿素追肥 10斤/亩，成本约8元/亩', category: 'fertilizer', sortOrder: 2 },
  { cropType: 'corn', stage: 'V9', name: '完成第十水滴灌（30方/亩）', description: '8月15日 · 第十水，滴灌水量30方/亩', category: 'irrigation', sortOrder: 1 },
  { cropType: 'corn', stage: 'V9', name: '施用尿素追肥（10斤/亩）', description: '8月15日 · 第十水：施用尿素追肥 10斤/亩，成本约8元/亩', category: 'fertilizer', sortOrder: 2 },
  { cropType: 'corn', stage: 'VT', name: '完成第十一水滴灌（30方/亩）', description: '8月25日 · 第十一水，滴灌水量30方/亩', category: 'irrigation', sortOrder: 1 },
  { cropType: 'corn', stage: 'VT', name: '施用尿素追肥（10斤/亩）', description: '8月25日 · 第十一水：施用尿素追肥 10斤/亩，成本约8元/亩', category: 'fertilizer', sortOrder: 2 },
  { cropType: 'corn', stage: 'R1', name: '完成第十二水滴灌（25方/亩）', description: '9月5日 · 第十二水，滴灌水量25方/亩', category: 'irrigation', sortOrder: 1 },
  { cropType: 'corn', stage: 'R1', name: '白水灌溉（无肥料）', description: '9月5日 · 第十二水：白水灌溉，仅清水，无肥料', category: 'irrigation', sortOrder: 2 },
];

module.exports = {
  TOKEN_SECRET,
  COLLECTIONS,
  SUPPORTED_CROPS,
  CORN_STAGES,
  PREBUILT_INSIGHTS,
  DEFAULT_TASK_TEMPLATES
};
