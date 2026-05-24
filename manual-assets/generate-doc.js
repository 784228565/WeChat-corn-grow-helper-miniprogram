const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell,
        AlignmentType, HeadingLevel, BorderStyle, WidthType, ShadingType,
        TableOfContents, PageBreak, Header, Footer, PageNumber } = require('docx');

const IMG_DIR = __dirname;
const CW = 9026; // A4 content width DXA (11906 - 1440*2)

function img(file, w=260) {
  const f = path.join(IMG_DIR, file);
  if (!fs.existsSync(f)) return new Paragraph({ children: [new TextRun(`[图片缺失: ${file}]`)] });
  const buf = fs.readFileSync(f);
  const ext = path.extname(file).slice(1);
  const type = ext === 'jpg' ? 'jpg' : ext === 'jpeg' ? 'jpeg' : 'png';
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 120 },
    children: [new ImageRun({ type, data: buf, transformation: { width: w, height: Math.round(w*1.8) }, altText: { title: file, description: file, name: file } })]
  });
}

function p(text, opts={}) {
  return new Paragraph({
    spacing: { before: opts.before ?? 80, after: opts.after ?? 80, line: 360 },
    indent: opts.indent ? { left: 360 } : undefined,
    alignment: opts.center ? AlignmentType.CENTER : undefined,
    children: [new TextRun({ text, font: 'Microsoft YaHei', size: opts.size ?? 24, bold: opts.bold, color: opts.color })]
  });
}

function h1(t) { return new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 }, children: [new TextRun({ text: t, font: 'Microsoft YaHei', size: 36, bold: true, color: '154212' })] }); }
function h2(t) { return new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 }, children: [new TextRun({ text: t, font: 'Microsoft YaHei', size: 28, bold: true, color: '376B10' })] }); }
function h3(t) { return new Paragraph({ heading: HeadingLevel.HEADING_3, spacing: { before: 200, after: 100 }, children: [new TextRun({ text: t, font: 'Microsoft YaHei', size: 26, bold: true })] }); }

function tip(title, lines, color='D5E8F0') {
  const border = { style: BorderStyle.SINGLE, size: 1, color: 'AAAAAA' };
  const cell = new TableCell({
    borders: { top: border, bottom: border, left: border, right: border },
    shading: { fill: color, type: ShadingType.CLEAR },
    margins: { top: 100, bottom: 100, left: 150, right: 150 },
    width: { size: CW, type: WidthType.DXA },
    children: [
      new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: '【'+title+'】', font: 'Microsoft YaHei', size: 22, bold: true, color: '154212' })] }),
      ...lines.map(l => new Paragraph({ spacing: { before: 40, after: 40 }, children: [new TextRun({ text: '• '+l, font: 'Microsoft YaHei', size: 22 })] }))
    ]
  });
  return new Table({ width: { size: CW, type: WidthType.DXA }, columnWidths: [CW], rows: [new TableRow({ children: [cell] })] });
}

const children = [];

// ===== 封面 =====
children.push(p('', { before: 2000 }));
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: '农田管家', font: 'Microsoft YaHei', size: 72, bold: true, color: '154212' })] }));
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 400 }, children: [new TextRun({ text: '使用手册', font: 'Microsoft YaHei', size: 56, bold: true, color: '376B10' })] }));
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: '—— 玉米种植农户操作指南 ——', font: 'Microsoft YaHei', size: 28, color: '666666' })] }));
children.push(p('', { before: 600 }));
children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '本手册由推广人员/技术员携带使用', font: 'Microsoft YaHei', size: 24, color: '888888' })] }));
children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '面向农民进行现场讲解和教学', font: 'Microsoft YaHei', size: 24, color: '888888' })] }));
children.push(new Paragraph({ children: [new PageBreak()] }));

// ===== 目录 =====
children.push(h1('目录'));
children.push(new TableOfContents('目录', { hyperlink: true, headingStyleRange: '1-3' }));
children.push(new Paragraph({ children: [new PageBreak()] }));

// ===== 第一章 =====
children.push(h1('第一章 认识"农田管家"'));
children.push(p('"农田管家"是一款专门为玉米种植农户设计的微信小程序，由推广人员或技术员帮助农户在手机上安装和使用。它可以帮农户记录每天的农事活动、查看种植进度、获得AI农事建议，让种地更科学、更高效。'));
children.push(h2('1.1 主要功能'));
children.push(p('小程序包含以下核心功能：'));
const features = [
  '首次设置：确认种植作物，填写农场基本信息（姓名、电话、位置、积温、土地类型等）',
  '每日打卡：按照玉米生长节点，每天完成农事任务并拍照上传',
  '打卡记录：随时查看历史打卡记录，回顾整个种植周期的农事活动',
  'AI农事助手：咨询作物健康、天气趋势、病虫害识别等问题',
  '多农场管理：如果有多个地块，可以分别管理，随时切换查看',
  '施肥提醒订阅：订阅节点提醒，到关键农事节点时自动收到通知'
];
features.forEach(f => children.push(p('• '+f, { indent: true })));
children.push(tip('技术员提示', ['首次见面时，先帮农户打开手机微信，搜索小程序名称并打开。','告诉农户："这个小程序就像您的种地日记本，每天花两分钟记一下，年底看记录就知道今年怎么种的。"']));

// ===== 第二章 =====
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(h1('第二章 首次使用设置'));
children.push(p('第一次打开小程序时，需要进行一些基础设置。技术员可以协助农户一步步完成。'));

children.push(h2('2.1 确认种植作物'));
children.push(p('打开小程序后，首先会看到欢迎页面。页面上会询问："您今年是否种植玉米？"'));
children.push(img('screenshot-welcome.png'));
children.push(p('如果农户今年种植玉米，请点击"是，种植玉米"按钮，进入下一步设置。'));
children.push(p('如果农户今年没有种植玉米，可以点击"否，查看其他作物"，小程序会给出相应提示。'));
children.push(tip('讲解要点', ['强调：只有选择种植玉米，才能看到完整的玉米生长节点和打卡任务。','如果农户犹豫不决，可以说："先选玉米试试，以后想改也可以。"']));

children.push(h2('2.2 填写农场信息'));
children.push(p('选择种植玉米后，进入农场信息设置页面。需要填写以下信息：'));
children.push(img('screenshot-setup.png'));
const fields = [
  '农户姓名：填写真实姓名，方便技术员识别和管理',
  '联系电话：填写常用手机号，用于接收提醒通知',
  '农场位置：点击选择位置，可以在地图上标注农场具体位置',
  '积温：当地年有效积温（技术员可帮助查询并填写）',
  '土地类型：选择沙土、壤土或黏土',
  '灌溉方式：选择滴灌、漫灌或雨养',
  '种植密度：每亩种植多少株（如4500株/亩）',
  '玉米品种：选择种植的具体品种名称'
];
fields.forEach(f => children.push(p(f, { indent: true })));
children.push(p('所有信息填写完成后，点击页面底部的"保存并开始使用"按钮，即可完成设置，进入主页面。'));
children.push(tip('讲解要点', ['积温是农户最容易混淆的概念，可解释："积温就是地里累积的温度，温度高长得快，温度低长得慢，系统根据积温推算每个农事节点的时间。"','种植密度可补充："一般4500-5000株/亩，密植品种可以更高，稀植品种可以更低。"','提醒农户：照片拍摄必须当日现场拍摄，不能使用相册旧照片。']));

// ===== 第三章 =====
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(h1('第三章 每日打卡'));
children.push(p('设置完成后，农户每天的核心操作就是"打卡"。打卡页面是小程序的主页面，打开小程序默认就会进入这里。'));

children.push(h2('3.1 打卡主页介绍'));
children.push(p('打卡主页从上到下分为几个区域：'));
children.push(img('screenshot-checkin.png'));
children.push(h3('顶部区域'));
children.push(p('显示当前农场名称、作物名称（玉米），以及当前所处的生长节点名称（如"苗期-三叶期"）。'));
children.push(h3('时间节点时间线'));
children.push(p('页面中部有一条横向时间线，显示了玉米整个生长周期的所有关键节点，从左到右依次排列：'));
const nodes = ['播种','出苗','三叶期','拔节期','大喇叭口期','抽雄期','吐丝期','灌浆期','乳熟期','蜡熟期','完熟期'];
children.push(p(nodes.join(' → ')));
children.push(p('每个节点有三种状态：'));
children.push(p('• 未开放（灰色）：还没到该节点的时间，无法打卡'));
children.push(p('• 可打卡（绿色）：当前正处于该节点，可以打卡'));
children.push(p('• 已逾期（红色）：该节点时间已过，但未打卡，可以补打卡'));
children.push(h3('当前节点卡片'));
children.push(p('时间线下方是当前节点的详细卡片，包含：'));
children.push(p('• 节点名称和日期范围'));
children.push(p('• 农事任务清单（如"查看苗情"、"喷洒除草剂"等）'));
children.push(p('• 每个任务前面有一个复选框，完成后点击勾选'));
children.push(h3('打卡按钮'));
children.push(p('页面底部有一个大大的打卡按钮，根据状态显示不同文字：'));
children.push(p('• "未到打卡时间"（灰色）：当前节点未开放'));
children.push(p('• "立即打卡"（绿色）：当前节点可打卡，点击完成打卡'));
children.push(p('• "补打卡"（橙色）：节点已逾期，可以补打卡'));
children.push(p('• "已打卡"（蓝色）：今天已经完成打卡'));

children.push(h2('3.2 上传照片/视频'));
children.push(p('打卡时需要上传当天在田间拍摄的照片或视频，作为农事活动的凭证。'));
children.push(p('点击打卡按钮后，系统会弹出上传界面。农户可以：'));
children.push(p('• 点击"拍照"按钮，直接调用相机拍摄现场照片'));
children.push(p('• 点击"从相册选择"，选择当天拍摄的照片（注意：不能使用以前的照片）'));
children.push(p('• 最多可以上传2张照片或1段视频'));
children.push(p('上传完成后，点击"确认打卡"即可完成当日打卡。'));
children.push(tip('重点强调', ['照片必须当日现场拍摄！系统会记录拍摄时间，旧照片无法通过审核。','建议农户每天在同一个位置拍照，方便对比作物生长变化。','如果当天没有需要记录的农事活动，也可以拍一张田间全景照片作为记录。']));

children.push(h2('3.3 完成打卡'));
children.push(p('打卡成功后，页面会显示"今日已打卡"的状态，打卡按钮变成蓝色，显示"已打卡"。'));
children.push(p('农户可以在"记录"页面查看本次打卡的详细内容，包括上传的照片和完成的任务清单。'));

children.push(h2('3.4 切换农场'));
children.push(p('如果农户有多个地块，或者一个手机管理多个农场，可以点击顶部农场名称旁边的下拉箭头，打开农场切换菜单。'));
children.push(img('screenshot-farm-menu.png'));
children.push(p('在弹出的菜单中，可以看到所有已创建的农场列表。点击想要查看的农场名称，即可切换到该农场的打卡页面。'));
children.push(p('如果需要添加新农场，点击菜单底部的"+ 添加新农场"按钮，按照设置流程填写新农场信息即可。'));
children.push(tip('讲解要点', ['多农场管理适合种植大户或合作社使用，普通农户一般只有一个农场。','切换农场时，每个农场有独立的种植进度和打卡记录，互不干扰。']));

// ===== 第四章 =====
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(h1('第四章 查看打卡记录'));
children.push(p('农户可以随时查看自己的历史打卡记录，回顾整个种植周期都做了哪些农事活动。'));

children.push(h2('4.1 记录页面'));
children.push(p('点击底部导航栏的"记录"图标，进入打卡记录页面。'));
children.push(img('screenshot-logs.png'));
children.push(p('记录页面以列表形式展示所有历史打卡，每条记录包含：'));
children.push(p('• 打卡日期'));
children.push(p('• 所属生长节点'));
children.push(p('• 完成的任务清单'));
children.push(p('• 上传的照片缩略图（点击可放大查看）'));
children.push(p('列表按时间倒序排列，最新的打卡显示在最上面。'));

children.push(h2('4.2 查看详情'));
children.push(p('点击任意一条打卡记录，可以查看该次打卡的详细信息，包括完整照片和任务完成情况。'));
children.push(tip('技术员提示', ['建议农户定期查看记录，尤其是在遇到问题时，可以回顾之前的农事操作，帮助分析原因。','年底时，完整的打卡记录可以作为种植总结的重要依据。']));

// ===== 第五章 =====
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(h1('第五章 AI农事助手'));
children.push(p('小程序内置了AI农事助手，农户可以随时咨询种植过程中遇到的问题。'));

children.push(h2('5.1 打开AI助手'));
children.push(p('点击底部导航栏的"AI助手"图标，进入AI农事助手页面。'));
children.push(img('screenshot-ai.png'));
children.push(p('页面类似于微信聊天界面，下方有输入框，可以输入文字问题或上传照片。'));

children.push(h2('5.2 可以咨询的问题'));
children.push(p('AI助手可以回答以下几类问题：'));
const aiQs = [
  '作物健康："我的玉米叶子发黄是怎么回事？"（需上传照片）',
  '病虫害识别："这是什么虫子？需要打药吗？"（需上传照片）',
  '天气趋势："最近天气对玉米生长有什么影响？"',
  '农事建议："现在该浇水还是该施肥？"',
  '节点解释："大喇叭口期需要注意什么？"'
];
aiQs.forEach(q => children.push(p('• '+q, { indent: true })));
children.push(p('输入问题后，AI会给出详细的回答和建议。如果对回答不满意，可以补充更多细节再次提问。'));
children.push(tip('讲解要点', ['鼓励农户多拍照上传，AI识别病虫害的准确率与照片清晰度直接相关。','告诉农户："AI助手就像随身的农业专家，遇到问题随时问，不用等技术员上门。"','注意：AI建议仅供参考，重要决策仍需咨询当地农业技术部门。']));

// ===== 第六章 =====
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(h1('第六章 常见问题解答'));
const faqs = [
  {q:'打不开小程序怎么办？',a:'检查手机网络连接是否正常，或尝试重新进入微信搜索"农田管家"。如仍有问题，请联系技术员协助。'},
  {q:'忘记打卡了可以补吗？',a:'可以。如果某个节点已逾期，打卡按钮会显示"补打卡"，点击后按正常流程上传照片即可。'},
  {q:'照片传不上怎么办？',a:'检查手机网络是否稳定，或尝试拍摄较小尺寸的照片。如果网络信号差，可以等信号恢复后再上传。'},
  {q:'一个手机能管几个农场？',a:'可以管理多个农场。点击顶部农场名称旁的下拉箭头，选择"添加新农场"即可创建。'},
  {q:'积温填错了怎么改？',a:'目前农场信息设置后不支持自行修改。如需修改，请联系技术员在后台协助调整。'},
  {q:'AI回答不准确怎么办？',a:'AI建议仅供参考，具体问题建议拍照后咨询当地农业技术推广站或技术员。'},
  {q:'如何接收节点提醒？',a:'在打卡页面点击"订阅提醒"按钮，授权小程序发送通知，到关键农事节点时会自动收到微信通知。'}
];
faqs.forEach((f,i) => {
  children.push(h3((i+1)+'. '+f.q));
  children.push(p(f.a));
});

// ===== 附录 =====
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(h1('附录 技术员讲解要点汇总'));
children.push(p('本附录汇总了手册各章节中的讲解要点，供技术员现场讲解时快速查阅。'));
children.push(h2('开场话术'));
children.push(p('"大爷/大妈，这个小程序是帮您记种地日记的。每天花两分钟拍张照、点个勾，年底您就能清楚知道今年啥时候播种的、啥时候施肥的、打了几次药，清清楚楚，比脑子记靠谱多了。"'));
children.push(h2('关键强调事项'));
const emphases = [
  '照片必须当日现场拍摄，不能使用相册里的旧照片',
  '积温决定生长节点时间，填写准确非常重要',
  '每个生长节点都有对应的农事任务，按任务清单操作更科学',
  '遇到问题随时用AI助手咨询，就像随身带了农业专家',
  '多个地块可以分别管理，切换农场查看各自进度'
];
emphases.forEach(e => children.push(p('• '+e, { indent: true })));
children.push(h2('农户常见顾虑及应对'));
const concerns = [
  {c:'"我年纪大了，不会用智能手机。"',r:'"没关系，我帮您设置好，以后每天就点这一个按钮，我教您三遍，保证会。"'},
  {c:'"每天打卡太麻烦了。"',r:'"就两分钟，比您抽根烟还快。而且年底看记录，您就知道今年哪步做得好、哪步可以改进。"'},
  {c:'"我的信息会不会泄露？"',r:'"您的信息只存在这个小程序里，用来给您推算农事时间，不会给别人的。"'},
  {c:'"这个收费吗？"',r:'"不收费，是农业推广项目免费给咱农户用的。"'}
];
concerns.forEach(c => {
  children.push(p(c.c, { bold: true }));
  children.push(p(c.r, { indent: true }));
});
children.push(tip('最后提醒', ['讲解时语速放慢，每操作一步等农户看清再下一步。','让农户自己动手操作，技术员在旁指导，比单纯演示效果更好。','留下技术员的联系方式，方便农户后续有问题时咨询。']));

// ===== 生成文档 =====
const doc = new Document({
  styles: {
    default: { document: { run: { font: 'Microsoft YaHei', size: 24 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 36, bold: true, font: 'Microsoft YaHei', color: '154212' },
        paragraph: { spacing: { before: 400, after: 200 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 28, bold: true, font: 'Microsoft YaHei', color: '376B10' },
        paragraph: { spacing: { before: 300, after: 150 }, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 26, bold: true, font: 'Microsoft YaHei' },
        paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2 } }
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
      }
    },
    headers: {
      default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: '农田管家使用手册', font: 'Microsoft YaHei', size: 20, color: '888888' })] })] })
    },
    footers: {
      default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '第 ', font: 'Microsoft YaHei', size: 20 }), new TextRun({ children: [PageNumber.CURRENT], font: 'Microsoft YaHei', size: 20 }), new TextRun({ text: ' 页', font: 'Microsoft YaHei', size: 20 })] })] })
    },
    children
  }]
});

Packer.toBuffer(doc).then(buf => {
  const out = path.join(__dirname, '..', '农田管家使用手册.docx');
  fs.writeFileSync(out, buf);
  console.log('文档已生成: ' + out);
}).catch(err => {
  console.error('生成失败:', err);
});
