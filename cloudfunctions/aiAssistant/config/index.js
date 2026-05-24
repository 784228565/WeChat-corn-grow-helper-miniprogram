// Absolute Path: C:\Users\78422\WeChatProjects\checkin\cloudfunctions\aiAssistant\config\index.js
// Description: AI助手配置中心

const cloud = require('wx-server-sdk');
const LOCAL_TOKEN_SECRET = process.env.TOKEN_SECRET || '';

// 优先从云数据库 sys_config 读取 tokenSecret（与 loginManager 保持一致）
async function getTokenSecret() {
  try {
    var db = cloud.database();
    var res = await db.collection('sys_config').doc('auth').get();
    if (res.data && res.data.tokenSecret) {
      return res.data.tokenSecret;
    }
  } catch (e) {
    // 数据库读取失败（表不存在或记录不存在），回退到本地默认值
  }
  return LOCAL_TOKEN_SECRET;
}

const COLLECTIONS = {
  FARMS: 'Farms',
  USERS: 'Users',
  CHAT_HISTORY: 'ChatHistory',
  SYS_CONFIG: 'sys_config'
};

// 腾讯元器(Yuanqi) 智能体配置
const YUANQI_CONFIG = {
  // 生产环境建议在「云开发控制台 → 云函数 → aiAssistant → 环境变量」中设置 YUANQI_TOKEN
  // 本地测试使用下方默认值，部署前请删除或留空
  TOKEN: process.env.YUANQI_TOKEN || '',
  // 智能体 ID，从元器发布页的 URL 中获取: appid=2049113423714714688
  ASSISTANT_ID: '2049113423714714688',
  API_HOST: 'yuanqi.tencent.com',
  API_PATH: '/openapi/v1/agent/chat/completions',
  TIMEOUT_MS: 30000
};

// AI 兜底回复数据（按作物类型 + 阶段 + 问题类型）
const AI_FALLBACKS = {
  corn: {
    VE: {
      pest: '在 VE（出苗期），监测玉米象甲和金针虫。检查出土幼苗的根系和茎部是否有取食损伤。',
      weather: 'VE 阶段需要持续的土壤水分以保证出苗。如果每周降雨不足 25mm，请确保灌溉。',
      weed: '苗前除草剂应该已经施用了。开始巡查早期杂草幼苗。',
      growth: '在 VE 期，胚芽鞘已经出土。清点出苗植株数以评估群体建立情况。',
      nutrient: '如果播前养分充足，VE 期不需要额外施肥。',
      default: '在 VE 阶段，重点是监测出苗率和确保充足的土壤水分。'
    },
    V2: {
      pest: '在 V2 期，巡查切根虫和金针虫。连续检查 10 株植物的叶片取食损伤。早期发现可防止虫害爆发。',
      weather: 'V2 阶段对水涝敏感。大雨后确保排水。土壤饱和时避免田间作业。',
      weed: 'V2-V5 是除草的关键窗口期。如果杂草压力超过阈值，施用苗后除草剂。',
      growth: '在 V2 期，植株有两片叶领叶。根系快速扩展。生长点仍在土表以下。',
      nutrient: '如果播前施氮不足，考虑追肥。建议进行土壤硝酸盐测试。',
      default: '在 V2 阶段，重点是早期杂草控制、虫害巡查和确保充足的土壤水分。'
    },
    V6: {
      pest: '在 V6 期，注意欧洲玉米螟和粘虫。巡查叶心幼虫取食。',
      weather: 'V6 进入快速生长期。此阶段的水分胁迫会显著降低产量潜力。',
      weed: '这是有效苗后除草剂施用的最后机会。杂草竞争现在至关重要。',
      growth: '在 V6 期，生长点已露出地面。植株进入快速营养生长期。',
      nutrient: '追肥应在 V6 前完成。缺氮症状可能表现为下部叶片发黄。',
      default: '在 V6 阶段，确保充足的氮素供应并监测快速生长胁迫因素。'
    },
    VT: {
      pest: '在 VT（抽雄期），巡查玉米穗虫和秋粘虫。丝状修剪昆虫会降低授粉率。',
      weather: 'VT 是对水分最敏感的阶段。整个授粉期保持充足的土壤水分。',
      weed: '到 VT 期杂草控制基本完成。晚期出现的杂草对产量影响最小。',
      growth: '雄穗完全抽出。花粉散落开始。花丝从穗鞘中抽出。关键授粉期。',
      nutrient: '养分吸收达到峰值。此时的任何缺乏都会直接影响籽粒发育。',
      default: '在 VT 阶段，优先灌溉管理和授粉监测。'
    },
    R1: {
      pest: '在 R1（吐丝期），监测丝状修剪昆虫。日本甲虫和玉米根虫成虫会干扰授粉。',
      weather: '保持充足水分以促进花丝伸长和花粉活力。热胁迫会降低结实率。',
      weed: 'R1 期杂草竞争最小。重点准备收获。',
      growth: '花丝可见且可接受花粉。成功授粉后开始籽粒发育。',
      nutrient: '钾对灌浆期至关重要。注意叶缘缺素症状。',
      default: '在 R1 阶段，确保成功授粉并保持灌浆期水分。'
    }
  }
};

// 快捷问题推荐（按阶段）
const STAGE_SUGGESTIONS = {
  VE: [
    { icon: '🌱', text: '出苗率', query: 'VE 阶段如何评估出苗率？' },
    { icon: '💧', text: '灌溉', query: 'VE 阶段玉米需要多少水？' },
    { icon: '🐛', text: '害虫识别', query: 'VE 阶段应该注意哪些害虫？' }
  ],
  V2: [
    { icon: '🐛', text: '害虫识别', query: 'V2 阶段应该注意哪些害虫？' },
    { icon: '🌿', text: '杂草控制', query: 'V2 阶段应该什么时候施用除草剂？' },
    { icon: '⛈️', text: '天气预警', query: '降雨如何影响 V2 阶段的玉米？' }
  ],
  V6: [
    { icon: '🌾', text: '养分检查', query: 'V6 阶段我的玉米需要更多氮肥吗？' },
    { icon: '🐛', text: '害虫识别', query: 'V6 阶段常见哪些害虫？' },
    { icon: '💧', text: '水分胁迫', query: 'V6 阶段如何识别水分胁迫？' }
  ],
  VT: [
    { icon: '🌻', text: '授粉', query: 'VT 阶段如何确保良好授粉？' },
    { icon: '💧', text: '灌溉', query: 'VT 阶段水分有多重要？' },
    { icon: '🐛', text: '穗虫防治', query: '如何防治玉米穗虫？' }
  ],
  R1: [
    { icon: '🌽', text: '籽粒结实', query: 'R1 阶段如何评估籽粒结实？' },
    { icon: '⛈️', text: '热胁迫', query: '高温如何影响 R1 阶段的授粉？' },
    { icon: '🌾', text: '灌浆期', query: '灌浆期需要哪些养分？' }
  ]
};

// 通用快捷问题（当阶段未知时）
const DEFAULT_SUGGESTIONS = [
  { icon: '🐛', text: '害虫识别', query: '帮我识别常见的玉米害虫' },
  { icon: '🌾', text: '生长阶段', query: '解释玉米的生长阶段' },
  { icon: '⛈️', text: '天气预警', query: '天气如何影响玉米产量？' }
];

module.exports = {
  LOCAL_TOKEN_SECRET,
  getTokenSecret,
  COLLECTIONS,
  YUANQI_CONFIG,
  AI_FALLBACKS,
  STAGE_SUGGESTIONS,
  DEFAULT_SUGGESTIONS
};
