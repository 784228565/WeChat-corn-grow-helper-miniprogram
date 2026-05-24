"""
农田管家推广页 - Harvest Stillness Canvas
A4 Museum-Quality Single Page
"""
import os
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm, cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor, white, black, Color

# ─── Color helpers ─────────────────────────────────────────────
def alpha_color(hex_color, alpha):
    """Return a Color with given alpha (0-1)."""
    return Color(hex_color.red, hex_color.green, hex_color.blue, alpha=alpha)
from reportlab.lib import colors
import math

# ─── Constants ───────────────────────────────────────────────
FONT_DIR = r"C:\Users\78422\.claude\skills\official_anthropic_skills\skills\canvas-design\canvas-fonts"
OUT_PATH = r"C:\Users\78422\WeChatProjects\checkin - 副本\manual-assets\农田管家-推广页-最终版.pdf"

PAGE_W = 595.27   # A4 portrait width  (mm: 210)
PAGE_H = 841.89   # A4 portrait height  (mm: 297)

# Earth spectrum palette
C_IVORY   = HexColor("#F4EFE6")   # 象牙白背景
C_FOREST  = HexColor("#2D5016")   # 深森林绿
C_MOSS    = HexColor("#4A7A28")   # 苔藓绿
C_LIME    = HexColor("#8AB85C")   # 浅叶绿
C_AMBER   = HexColor("#C9941A")   # 琥珀金
C_ASH     = HexColor("#3D3D3D")   # 深炭
C_SILK    = HexColor("#6B6B5A")   # 绢丝灰
C_CREAM   = HexColor("#EDE5D5")   # 奶油色
C_GOLD    = HexColor("#D4A017")   # 麦穗金

# ─── Register Fonts ────────────────────────────────────────────
FONT_DIR = r"C:\Users\78422\.claude\skills\official_anthropic_skills\skills\canvas-design\canvas-fonts"

def register_fonts():
    # 英文/装饰字体（英文字体目录）
    en_fonts = {
        "BricolageGrotesque-Bold": "BricolageGrotesque-Bold.ttf",
        "InstrumentSerif-Regular": "InstrumentSerif-Regular.ttf",
        "InstrumentSerif-Italic": "InstrumentSerif-Italic.ttf",
        "Jura-Light": "Jura-Light.ttf",
        "Jura-Medium": "Jura-Medium.ttf",
        "Lora-Regular": "Lora-Regular.ttf",
        "Lora-Bold": "Lora-Bold.ttf",
        "CrimsonPro-Regular": "CrimsonPro-Regular.ttf",
        "CrimsonPro-Bold": "CrimsonPro-Bold.ttf",
        "YoungSerif": "YoungSerif-Regular.ttf",
        "Italiana": "Italiana-Regular.ttf",
    }
    for name, fname in en_fonts.items():
        try:
            pdfmetrics.registerFont(TTFont(name, os.path.join(FONT_DIR, fname)))
        except Exception:
            pass

    # 中文字体（使用 Windows 系统字体）
    try:
        pdfmetrics.registerFont(TTFont('SimHei', 'C:/Windows/Fonts/simhei.ttf'))
        pdfmetrics.registerFont(TTFont('SimSun', 'C:/Windows/Fonts/simsun.ttc'))
        pdfmetrics.registerFont(TTFont('MSYH', 'C:/Windows/Fonts/msyh.ttc'))
    except Exception:
        pass

register_fonts()

# ─── Helper Draw Functions ─────────────────────────────────────

def draw_crop_row_lines(c, x_start, x_end, y_start, y_end, angle_deg=22):
    """Draw organic parallel lines reminiscent of crop rows."""
    angle = math.radians(angle_deg)
    spacing = 5  # points between lines

    # Project spacing onto y-axis
    dy = spacing / math.cos(angle)
    num_lines = int((y_end - y_start) / dy) + 40

    for i in range(num_lines):
        y = y_start - i * dy + 20
        # Fade from dark at top to lighter at bottom
        alpha_t = max(0.0, min(1.0, (y - y_start) / (y_end - y_start)))
        # Alternate between forest and moss
        if i % 3 == 0:
            color = C_FOREST
        elif i % 3 == 1:
            color = C_MOSS
        else:
            color = C_LIME

        # Vary opacity slightly
        line_alpha = 0.12 + 0.08 * (i % 5)
        c.setStrokeColor(color)
        c.setLineWidth(0.6)
        c.setLineCap(0)

        # Draw line segment within bounds
        x1 = x_start
        x2 = x_end
        c.line(x1, y, x2, y)

def draw_subtle_grid_lines(c, x, y, w, h, cols=8, rows=12):
    """Draw very subtle grid lines for texture."""
    c.setStrokeColor(HexColor("#D8D0C0"))
    c.setLineWidth(0.3)

    # Horizontal
    for i in range(1, rows):
        gy = y + h * i / rows
        c.line(x, gy, x + w, gy)

    # Vertical
    for i in range(1, cols):
        gx = x + w * i / cols
        c.line(gx, y, gx, y + h)

def draw_amber_accent_bar(c, x, y, w, h, color=C_AMBER):
    """Draw a horizontal accent bar."""
    c.setFillColor(color)
    c.rect(x, y, w, h, fill=1, stroke=0)

def draw_feature_pill(c, x, y, icon_char, label, sublabel):
    """Draw a feature item with icon and labels."""
    # Icon circle
    c.setFillColor(C_FOREST)
    c.circle(x, y + 8, 14, fill=1, stroke=0)
    c.setFillColor(C_IVORY)
    c.setFont("MSYH", 13)
    c.drawCentredString(x, y + 5, icon_char)

    # Label
    c.setFillColor(C_ASH)
    c.setFont("SimHei", 10.5)
    c.drawString(x + 22, y + 12, label)

    # Sub label
    c.setFillColor(C_SILK)
    c.setFont("MSYH", 8.5)
    c.drawString(x + 22, y + 2, sublabel)

def draw_step_item(c, x, y, number, label, sublabel):
    """Draw a numbered step."""
    c.setFillColor(C_AMBER)
    c.circle(x, y + 8, 12, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont("BricolageGrotesque-Bold", 10)
    c.drawCentredString(x, y + 4.5, str(number))

    c.setFillColor(C_ASH)
    c.setFont("SimHei", 10)
    c.drawString(x + 18, y + 10, label)

    c.setFillColor(C_SILK)
    c.setFont("MSYH", 8)
    c.drawString(x + 18, y + 0, sublabel)

def draw_leaf_accent(c, cx, cy, size, rotation=0):
    """Draw a stylized leaf shape."""
    c.saveState()
    c.translate(cx, cy)
    c.rotate(rotation)

    path = c.beginPath()
    path.moveTo(0, 0)
    path.curveTo(size * 0.5, size * 0.3,
                 size * 0.5, size * 0.8,
                 0, size)
    path.curveTo(-size * 0.5, size * 0.8,
                 -size * 0.5, size * 0.3,
                 0, 0)
    path.close()

    c.setFillColor(alpha_color(HexColor("#5A8A30"), 0.15))
    c.setStrokeColor(C_MOSS)
    c.setLineWidth(0.5)
    c.drawPath(path, fill=1, stroke=1)
    c.restoreState()

def draw_wheat_stalk(c, x, y, height, color=C_GOLD):
    """Draw a stylized wheat stalk."""
    c.setStrokeColor(color)
    c.setLineWidth(1.2)
    c.setLineCap(1)

    # Main stem
    c.line(x, y, x, y + height)

    # Wheat grains (small ovals)
    for i in range(5):
        gy = y + height - 10 - i * 8
        gsize = 3.5 - i * 0.3
        c.setFillColor(color)
        c.ellipse(x - gsize, gy - 3, x + gsize, gy + 3, fill=1, stroke=0)
        # Second side
        c.ellipse(x - gsize * 1.3, gy - 2, x + gsize * 0.3, gy + 4, fill=1, stroke=0)

def draw_geometric_frame(c, x, y, w, h, stroke_color, lw=0.5):
    """Draw a thin geometric frame."""
    c.setStrokeColor(stroke_color)
    c.setLineWidth(lw)
    c.rect(x, y, w, h, fill=0, stroke=1)

def draw_corner_accent(c, x, y, size, direction="tl"):
    """Draw a small corner accent."""
    c.setStrokeColor(C_AMBER)
    c.setLineWidth(1.5)
    s = size
    if direction == "tl":
        c.line(x, y + s, x, y)
        c.line(x, y, x + s, y)
    elif direction == "tr":
        c.line(x - s, y, x, y)
        c.line(x, y, x, y + s)
    elif direction == "bl":
        c.line(x, y - s, x, y)
        c.line(x, y, x + s, y)
    elif direction == "br":
        c.line(x - s, y, x, y)
        c.line(x, y, x, y - s)

# ─── Main Canvas ───────────────────────────────────────────────

def build_canvas():
    c = canvas.Canvas(OUT_PATH, pagesize=(PAGE_W, PAGE_H))
    c.setTitle("农田管家 — 您的智能种地帮手")
    c.setAuthor("农田管家")

    # ══════════════════════════════════════════════════════════
    # BACKGROUND
    # ══════════════════════════════════════════════════════════
    c.setFillColor(C_IVORY)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)

    # ══════════════════════════════════════════════════════════
    # LEFT PANEL — Crop Row Texture (organic parallel lines)
    # ══════════════════════════════════════════════════════════
    PANEL_W = PAGE_W * 0.34  # ~202 pts

    # Subtle background gradient for left panel
    for i in range(60):
        t = i / 60.0
        r = 0.44 + t * 0.02
        g_val = 0.31 + t * 0.01
        b_val = 0.09 - t * 0.03
        stripe_h = PAGE_H / 60
        c.setFillColor(HexColor(
            f"#{int(r*255):02x}{int(g_val*255):02x}{int(b_val*255):02x}"))
        c.rect(0, PAGE_H - (i + 1) * stripe_h, PANEL_W, stripe_h, fill=1, stroke=0)

    # Crop row lines at slight angle (field texture)
    angle = 18  # degrees
    line_spacing = 4.5
    num_lines = int(PAGE_H / line_spacing) + 10

    for i in range(num_lines):
        y = PAGE_H - i * line_spacing
        # Color gradient: forest -> moss -> lime
        if i < num_lines * 0.3:
            col = C_FOREST
        elif i < num_lines * 0.6:
            col = C_MOSS
        elif i < num_lines * 0.85:
            col = HexColor("#6A9A3A")
        else:
            col = C_LIME

        # Opacity varies with depth
        alpha = 0.08 + 0.06 * ((i + 3) % 7)
        c.setStrokeColor(alpha_color(col, max(0.05, 1 - alpha)))
        c.setLineWidth(0.5 + 0.2 * ((i + 2) % 4))
        c.line(0, y, PANEL_W, y)

    # Diagonal accent lines (harvest pattern)
    for j in range(25):
        y_off = j * 35
        c.setStrokeColor(alpha_color(HexColor("#FFFFFF"), 0.04))
        c.setLineWidth(0.4)
        c.line(0, PAGE_H - y_off, PANEL_W, PAGE_H - y_off - 8)

    # Left panel right border — clean cut
    c.setStrokeColor(C_CREAM)
    c.setLineWidth(1.5)
    c.line(PANEL_W, 0, PANEL_W, PAGE_H)

    # ══════════════════════════════════════════════════════════
    # DECORATIVE ELEMENTS — Right Panel
    # ══════════════════════════════════════════════════════════
    RIGHT_X = PANEL_W + 30
    RIGHT_W = PAGE_W - PANEL_W - 30

    # Very subtle grid texture on right
    draw_subtle_grid_lines(c, RIGHT_X, 60, RIGHT_W, PAGE_H - 120, cols=6, rows=16)

    # Corner accents
    draw_corner_accent(c, RIGHT_X, PAGE_H - 60, 18, "tl")
    draw_corner_accent(c, PAGE_W - 15, PAGE_H - 60, 18, "tr")
    draw_corner_accent(c, RIGHT_X, 60, 18, "bl")
    draw_corner_accent(c, PAGE_W - 15, 60, 18, "br")

    # ══════════════════════════════════════════════════════════
    # TOP SECTION
    # ══════════════════════════════════════════════════════════

    # Amber accent bar (top)
    draw_amber_accent_bar(c, RIGHT_X, PAGE_H - 22, RIGHT_W, 4)

    # Tag label — top right
    c.setFillColor(C_SILK)
    c.setFont("MSYH", 7.5)
    c.drawRightString(PAGE_W - 18, PAGE_H - 16, "数字农业  ·  智能种地")

    # ══════════════════════════════════════════════════════════
    # TITLE AREA
    # ══════════════════════════════════════════════════════════

    # Chinese main title
    title_x = RIGHT_X + 8
    title_y = PAGE_H - 120

    c.setFillColor(C_FOREST)
    c.setFont("SimHei", 54)
    c.drawString(title_x, title_y, "农田管家")

    # Tagline
    c.setFillColor(C_SILK)
    c.setFont("MSYH", 11)
    c.drawString(title_x + 5, title_y - 22, "您的智能种地帮手")

    # Decorative wheat stalks (left panel, top area)
    draw_wheat_stalk(c, PANEL_W - 30, PAGE_H - 180, 80, color=C_GOLD)
    draw_wheat_stalk(c, PANEL_W - 48, PAGE_H - 160, 65, color=C_AMBER)
    draw_wheat_stalk(c, PANEL_W - 22, PAGE_H - 200, 55, color=HexColor("#B88A10"))

    # ══════════════════════════════════════════════════════════
    # DIVIDER LINE
    # ══════════════════════════════════════════════════════════
    c.setStrokeColor(C_AMBER)
    c.setLineWidth(0.8)
    c.line(title_x, title_y - 52, RIGHT_X + RIGHT_W - 8, title_y - 52)

    # ══════════════════════════════════════════════════════════
    # FEATURES SECTION
    # ══════════════════════════════════════════════════════════
    feat_y = title_y - 80
    feat_x = title_x

    # Section label
    c.setFillColor(C_AMBER)
    c.setFont("MSYH", 7.5)
    c.drawString(feat_x, feat_y + 20, "核心功能")

    features = [
        ("✓", "每日打卡", "记录农事每一步"),
        ("●", "智能提醒", "不错过最佳农时"),
        ("◆", "AI 助手", "科学种田问不倒"),
        ("■", "历史追溯", "产量趋势全掌握"),
    ]

    # 2x2 grid
    feat_spacing_x = RIGHT_W / 2 - 5
    feat_spacing_y = 38

    for idx, (icon, label, sub) in enumerate(features):
        row = idx // 2
        col = idx % 2
        fx = feat_x + col * feat_spacing_x
        fy = feat_y - row * feat_spacing_y
        draw_feature_pill(c, fx, fy, icon, label, sub)

    # ══════════════════════════════════════════════════════════
    # HOW TO START — Steps
    # ══════════════════════════════════════════════════════════
    step_y = feat_y - 100
    step_x = feat_x

    c.setFillColor(C_AMBER)
    c.setFont("MSYH", 7.5)
    c.drawString(step_x, step_y + 18, "三步开始使用")

    steps = [
        (1, "微信扫码", "进入小程序"),
        (2, "填写信息", "绑定农田地块"),
        (3, "每日打卡", "记录农事活动"),
    ]

    step_w = RIGHT_W / 3 - 8
    for idx, (num, label, sub) in enumerate(steps):
        sx = step_x + idx * step_w
        draw_step_item(c, sx + 5, step_y - 8, num, label, sub)

        # Arrow connector (except last)
        if idx < 2:
            ax = sx + step_w - 5
            c.setStrokeColor(C_AMBER)
            c.setLineWidth(0.8)
            c.line(ax, step_y + 5, ax + 15, step_y + 5)
            # Arrowhead
            c.line(ax + 12, step_y + 2, ax + 15, step_y + 5)
            c.line(ax + 12, step_y + 8, ax + 15, step_y + 5)

    # ══════════════════════════════════════════════════════════
    # BENEFITS — subtle list
    # ══════════════════════════════════════════════════════════
    ben_y = step_y - 72
    ben_x = step_x

    c.setFillColor(C_AMBER)
    c.setFont("MSYH", 7.5)
    c.drawString(ben_x, ben_y + 18, "选择理由")

    benefits = [
        "不错过每一个关键农时节点",
        "种地记录永不丢失，云端存储",
        "AI 分析助力科学增产增收",
        "子女可查看，了解老人生活",
    ]

    c.setFillColor(C_ASH)
    c.setFont("SimSun", 9.5)

    check_char = "✓"
    for idx, ben in enumerate(benefits):
        by = ben_y - idx * 18
        c.setFillColor(C_MOSS)
        c.setFont("SimHei", 9)
        c.drawString(ben_x, by, check_char)
        c.setFillColor(C_ASH)
        c.setFont("SimSun", 9.5)
        c.drawString(ben_x + 12, by, ben)

    # ══════════════════════════════════════════════════════════
    # BOTTOM CTA SECTION
    # ══════════════════════════════════════════════════════════
    cta_y = 90

    # CTA background bar
    c.setFillColor(C_FOREST)
    c.rect(RIGHT_X, cta_y - 10, RIGHT_W, 46, fill=1, stroke=0)

    # CTA text
    c.setFillColor(C_IVORY)
    c.setFont("SimHei", 14)
    c.drawCentredString(PAGE_W / 2 + 5, cta_y + 22, "微信搜索「农田管家」")

    c.setFillColor(C_CREAM)
    c.setFont("MSYH", 9)
    c.drawCentredString(PAGE_W / 2 + 5, cta_y + 8, "免费使用 · 永久保存 · 子女关怀")

    # Leaf accents on CTA bar
    draw_leaf_accent(c, RIGHT_X + 18, cta_y + 13, 10, rotation=30)
    draw_leaf_accent(c, PAGE_W - 18, cta_y + 13, 10, rotation=-30)

    # ══════════════════════════════════════════════════════════
    # FOOTER
    # ══════════════════════════════════════════════════════════
    footer_y = 50

    c.setFillColor(C_SILK)
    c.setFont("MSYH", 7)
    c.drawCentredString(PAGE_W / 2 + 5, footer_y, "农田管家  ·  您的智能种地帮手")

    # Thin footer line
    c.setStrokeColor(HexColor("#C8BEA0"))
    c.setLineWidth(0.4)
    c.line(RIGHT_X, footer_y + 8, PAGE_W - 15, footer_y + 8)

    # ══════════════════════════════════════════════════════════
    # LEFT PANEL — Decorative wheat at bottom
    # ══════════════════════════════════════════════════════════
    draw_wheat_stalk(c, 20, 20, 90, color=C_GOLD)
    draw_wheat_stalk(c, 45, 10, 75, color=C_AMBER)
    draw_wheat_stalk(c, 70, 25, 60, color=HexColor("#B88A10"))
    draw_wheat_stalk(c, 90, 15, 50, color=C_LIME)

    # Bottom amber bar on left panel
    c.setFillColor(C_AMBER)
    c.rect(0, 0, PANEL_W, 5, fill=1, stroke=0)

    # ─── Finalize ────────────────────────────────────────────
    c.save()
    print(f"✅ Canvas saved: {OUT_PATH}")

build_canvas()
