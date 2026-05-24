from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, white, black
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.platypus import Frame, KeepInFrame
import os

# A4 size
WIDTH, HEIGHT = A4  # 210mm x 297mm
W = WIDTH
H = HEIGHT

# Colors
GREEN_DARK = HexColor('#2d4a1c')
GREEN_MED = HexColor('#4a7c23')
GREEN_LIGHT = HexColor('#6b9b3a')
GOLD = HexColor('#d4a84b')
CREAM = HexColor('#faf6f0')
BROWN = HexColor('#8b6b4a')
TEXT_DARK = HexColor('#2c2416')
TEXT_MUTED = HexColor('#6b5d4d')

# Register Chinese font
try:
    pdfmetrics.registerFont(TTFont('SimHei', 'C:/Windows/Fonts/simhei.ttf'))
    pdfmetrics.registerFont(TTFont('SimSun', 'C:/Windows/Fonts/simsun.ttc'))
    pdfmetrics.registerFont(TTFont('MSYH', 'C:/Windows/Fonts/msyh.ttc'))
    FONT = 'SimHei'
    FONT_BODY = 'SimSun'
    FONT_ENG = 'MSYH'
except:
    FONT = 'Helvetica'
    FONT_BODY = 'Helvetica'
    FONT_ENG = 'Helvetica'

output_path = 'c:/Users/78422/WeChatProjects/checkin - 副本/manual-assets/农田管家推广页.pdf'
c = canvas.Canvas(output_path, pagesize=A4)

# ============ BACKGROUND ============
# Top banner - gradient effect (multiple rects)
for i in range(20):
    ratio = i / 20
    r = int(45 + (74 - 45) * ratio)
    g = int(74 + (124 - 74) * ratio)
    b = int(28 + (58 - 28) * ratio)
    c.setFillColorRGB(r/255, g/255, b/255)
    c.rect(0, H - 85 - i*3, W, 3, fill=1, stroke=0)

# Bottom footer band
c.setFillColor(GREEN_DARK)
c.rect(0, 0, W, 18*mm, fill=1, stroke=0)

# ============ HEADER CONTENT ============
# Logo badge
c.setFillColor(HexColor('#ffffff22'))
c.roundRect(20*mm, H - 75*mm, 45*mm, 12*mm, 6*mm, fill=1, stroke=0)
c.setFillColor(white)
c.setFont(FONT, 14)
c.drawString(30*mm, H - 66*mm, '农田管家')

# Main title
c.setFillColor(white)
c.setFont(FONT, 36)
c.drawCentredString(W/2, H - 48*mm, '您的智能种地帮手')

# Subtitle
c.setFont(FONT, 18)
c.setFillColor(GOLD)
c.drawCentredString(W/2, H - 57*mm, '科学种田 · 增产增收')

# Tagline
c.setFillColor(HexColor('#ffffffcc'))
c.setFont(FONT_BODY, 11)
c.drawCentredString(W/2, H - 65*mm, '拍照打卡记录农事 · AI智能分析指导 · 什么时候施肥浇水防虫一目了然')

# ============ FEATURES SECTION (2x2 grid) ============
feat_y_start = H - 105*mm
feat_spacing = 42*mm
feat_box_w = 88*mm
feat_box_h = 38*mm

features = [
    ('每日打卡记录', '拍张照片记录今天干了什么，\n上传后自动保存，随时回顾。'),
    ('智能任务提醒', '什么时候该施肥、浇水、打药，\n小程序提前提醒，不误农时。'),
    ('AI农事助手', '病虫害识别、种植技术咨询，\n有问题就问AI，随时解答。'),
    ('历史数据追溯', '所有打卡记录永久保存，\n按时间查看，为来年提供参考。'),
]

# Section label
c.setFillColor(GOLD)
c.setFont(FONT, 12)
c.drawString(20*mm, feat_y_start + 5*mm, '▌ 四大核心功能')

for i, (title, desc) in enumerate(features):
    col = i % 2
    row = i // 2
    x = 20*mm + col * (feat_box_w + 4*mm)
    y = feat_y_start - row * feat_box_h - feat_box_h

    # Card background
    c.setFillColor(white)
    c.setStrokeColor(HexColor('#e8e4dc'))
    c.roundRect(x, y, feat_box_w, feat_box_h - 3*mm, 3*mm, fill=1, stroke=1)

    # Green accent bar on left
    c.setFillColor(GREEN_MED)
    c.roundRect(x, y, 3*mm, feat_box_h - 3*mm, 1*mm, fill=1, stroke=0)

    # Title
    c.setFillColor(TEXT_DARK)
    c.setFont(FONT, 13)
    c.drawString(x + 8*mm, y + feat_box_h - 12*mm, title)

    # Description
    c.setFillColor(TEXT_MUTED)
    c.setFont(FONT_BODY, 9)
    lines = desc.split('\n')
    for li, line in enumerate(lines):
        c.drawString(x + 8*mm, y + feat_box_h - 22*mm - li * 5*mm, line)

# ============ HOW IT WORKS (3 columns) ============
how_y = feat_y_start - 2 * feat_box_h - 12*mm
step_w = 52*mm

# Section label
c.setFillColor(GOLD)
c.setFont(FONT, 12)
c.drawString(20*mm, how_y + 38*mm, '▌ 三步开始使用')

c.setFillColor(TEXT_MUTED)
c.setFont(FONT_BODY, 9)
c.drawString(20*mm, how_y + 30*mm, '操作简单，老人家也能轻松上手')

steps = [
    ('01', '微信扫码进入', '用微信扫描二维码或搜索\n"农田管家"，直接进入小程序'),
    ('02', '填写农场信息', '告诉小程序您的玉米种植\n面积、品种、播种日期'),
    ('03', '每日拍照打卡', '每天打开小程序拍照记录\n农事活动，获取任务提醒'),
]

for i, (num, title, desc) in enumerate(steps):
    x = 20*mm + i * (step_w + 7*mm)
    y = how_y

    # Circle number
    c.setFillColor(GOLD)
    c.circle(x + step_w/2, y + 24*mm, 8*mm, fill=1, stroke=0)
    c.setFillColor(TEXT_DARK)
    c.setFont(FONT, 14)
    c.drawCentredString(x + step_w/2, y + 21*mm, num)

    # Connector line (except last)
    if i < 2:
        c.setStrokeColor(GOLD)
        c.setLineWidth(0.5)
        c.line(x + step_w/2 + 9*mm, y + 24*mm, x + step_w + 7*mm + step_w/2 - 9*mm, y + 24*mm)

    # Title
    c.setFillColor(TEXT_DARK)
    c.setFont(FONT, 12)
    c.drawCentredString(x + step_w/2, y + 12*mm, title)

    # Description
    c.setFillColor(TEXT_MUTED)
    c.setFont(FONT_BODY, 9)
    lines = desc.split('\n')
    for li, line in enumerate(lines):
        c.drawCentredString(x + step_w/2, y + 6*mm - li * 5*mm, line)

# ============ BENEFITS (horizontal list) ============
ben_y = how_y - 42*mm

# Section label
c.setFillColor(GOLD)
c.setFont(FONT, 12)
c.drawString(20*mm, ben_y + 28*mm, '▌ 用农田管家有什么好处？')

benefits = [
    '不错过最佳农时',
    '农事记录不丢失',
    'AI帮您分析问题',
    '科学种田增产量',
    '免费使用无负担',
    '子女也能看得到',
]

ben_y_pos = ben_y + 18*mm
for i, text in enumerate(benefits):
    # Checkmark circle
    c.setFillColor(GREEN_MED)
    c.circle(26*mm, ben_y_pos - i * 5.5*mm, 2.5*mm, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont(FONT, 7)
    c.drawCentredString(26*mm, ben_y_pos - i * 5.5*mm - 1*mm, '✓')

    # Benefit text
    c.setFillColor(TEXT_DARK)
    c.setFont(FONT_BODY, 10)
    c.drawString(30*mm, ben_y_pos - i * 5.5*mm - 1*mm, text)

# ============ CTA SECTION ============
cta_y = ben_y - 40*mm

# CTA box
c.setFillColor(GREEN_MED)
c.roundRect(20*mm, cta_y, W - 40*mm, 22*mm, 4*mm, fill=1, stroke=0)

c.setFillColor(white)
c.setFont(FONT, 14)
c.drawCentredString(W/2, cta_y + 14*mm, '现在就试试吧！微信搜索"农田管家"')

c.setFont(FONT_BODY, 10)
c.setFillColor(HexColor('#ffffffbb'))
c.drawCentredString(W/2, cta_y + 8*mm, '打开微信 → 发现 → 小程序 → 搜索"农田管家" · 完全免费')

# ============ FOOTER ============
c.setFillColor(white)
c.setFont(FONT_BODY, 8)
c.drawCentredString(W/2, 7*mm, '农田管家 · 您的智能种地帮手')

# ============ DECORATIVE ELEMENTS ============
# Corner decoration
c.setFillColor(HexColor('#ffffff11'))
c.circle(W - 15*mm, H - 15*mm, 25*mm, fill=1, stroke=0)
c.setFillColor(HexColor('#ffffff08'))
c.circle(W - 5*mm, H - 25*mm, 18*mm, fill=1, stroke=0)

c.save()
print(f'PDF created: {output_path}')
