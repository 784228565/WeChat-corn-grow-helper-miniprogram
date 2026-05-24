// 数据库集合名
const COLLECTIONS = {
  FARMS: 'Farms',
  USERS: 'Users',
  TASKS: 'Tasks',
  TASK_TEMPLATES: 'TaskTemplates',
  CHECKINS: 'CheckIns',
  MEDIA_RECORDS: 'MediaRecords'
};

// 玉米生长阶段
const CORN_STAGES = [
  'VE', 'V1', 'V2', 'V3', 'V4', 'V5',
  'V6', 'V7', 'V8', 'V9', 'VT', 'R1'
];

// 默认任务模板数据 — 中性/沙性土壤全程施肥方案（来源：副本施肥方案.xlsx）
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

// 需要手动创建的索引列表（供返回提示）
const REQUIRED_INDEXES = [
  { collection: 'Tasks', name: 'farmId_stage', fields: [{ farmId: 1 }, { stage: 1 }] },
  { collection: 'CheckIns', name: 'farmId_checkedInAt', fields: [{ farmId: 1 }, { checkedInAt: -1 }] },
  { collection: 'Farms', name: 'userId', fields: [{ userId: 1 }] },
  { collection: 'Users', name: 'userId', fields: [{ userId: 1 }] },
  { collection: 'TaskTemplates', name: 'cropType_stage', fields: [{ cropType: 1 }, { stage: 1 }] },
  { collection: 'MediaRecords', name: 'farmId_stage', fields: [{ farmId: 1 }, { stage: 1 }] }
];

module.exports = {
  COLLECTIONS,
  CORN_STAGES,
  DEFAULT_TASK_TEMPLATES,
  REQUIRED_INDEXES
};
