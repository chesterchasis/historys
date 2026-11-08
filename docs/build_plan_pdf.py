"""Genera docs/plan-10-fases.pdf. Esquemas sobre un Samsung Galaxy S25 (One UI, agujero central y barra de gestos)."""

from reportlab.lib.colors import Color, HexColor, white
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    CondPageBreak,
    Flowable,
    Frame,
    KeepTogether,
    ListFlowable,
    ListItem,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

pdfmetrics.registerFont(TTFont("Segoe", r"C:\Windows\Fonts\segoeui.ttf"))
pdfmetrics.registerFont(TTFont("Segoe-Bold", r"C:\Windows\Fonts\segoeuib.ttf"))
pdfmetrics.registerFontFamily("Segoe", normal="Segoe", bold="Segoe-Bold")

INK = HexColor("#2f3638")
BEIGE = HexColor("#f1efeb")
PAPER = HexColor("#f9f8f6")
LINE = HexColor("#c7c2bc")
BLUE = HexColor("#7a9ccc")
BLACK = HexColor("#14191a")
TRUE_BLACK = HexColor("#000000")
MUTED = HexColor("#626a6e")
PHOTO = HexColor("#d7cfc3")
PHOTO_B = HexColor("#efe8df")
VIDEO = HexColor("#b7c4d6")
EMPTY = HexColor("#101415")
SOFT = HexColor("#e7e2da")
WARN = HexColor("#b85c4b")
TITANIUM = HexColor("#3a4043")

PAGE_W, PAGE_H = A4
LEFT = 16 * mm
RIGHT = 16 * mm
CONTENT_W = PAGE_W - LEFT - RIGHT


def S(name, **kw):
    base = dict(
        fontName="Segoe",
        fontSize=10.3,
        leading=14.2,
        textColor=INK,
        alignment=TA_LEFT,
    )
    base.update(kw)
    return ParagraphStyle(name, **base)


STYLES = {
    "kicker": S("kicker", fontName="Segoe-Bold", fontSize=9, leading=12, textColor=BLUE, spaceAfter=2),
    "cover_title": S("cover_title", fontName="Segoe-Bold", fontSize=27, leading=32, textColor=INK),
    "cover_sub": S("cover_sub", fontSize=11.5, leading=16.5, textColor=MUTED, spaceBefore=8),
    "h1": S("h1", fontName="Segoe-Bold", fontSize=15.5, leading=19.5, spaceBefore=0, spaceAfter=5),
    "h2": S("h2", fontName="Segoe-Bold", fontSize=11, leading=14, textColor=INK, spaceBefore=7, spaceAfter=2),
    "body": S("body", fontSize=10.2, leading=14.0, textColor=INK),
    "small": S("small", fontSize=9.3, leading=12.8, textColor=MUTED),
    "label": S("label", fontName="Segoe-Bold", fontSize=8.5, leading=11, textColor=BLUE, spaceBefore=6, spaceAfter=1),
    "done": S("done", fontSize=10, leading=13.5, textColor=INK),
    "cell": S("cell", fontSize=8.5, leading=11, textColor=INK),
    "cell_b": S("cell_b", fontName="Segoe-Bold", fontSize=8.5, leading=11, textColor=INK),
}


def P(text, style="body"):
    return Paragraph(text, STYLES[style])


class Wire(Flowable):
    def __init__(self, kind, height=184):
        super().__init__()
        self.kind = kind
        self.width = CONTENT_W
        self.height = height

    def draw(self):
        c = self.canv
        c.saveState()
        rrect(c, 0, 0, self.width, self.height, 10, BEIGE, LINE, 0.6)
        DRAW[self.kind](c, 10, 10, self.width - 20, self.height - 20)
        c.restoreState()


def rrect(c, x, y, w, h, r, fill, stroke=None, sw=1):
    c.setFillColor(fill)
    c.setStrokeColor(stroke or fill)
    c.setLineWidth(sw)
    c.roundRect(x, y, w, h, r, fill=1, stroke=1 if stroke else 0)


def txt(c, text, x, y, size=8, bold=False, color=INK, align="left"):
    c.setFillColor(color)
    c.setFont("Segoe-Bold" if bold else "Segoe", size)
    if align == "center":
        c.drawCentredString(x, y, text)
    elif align == "right":
        c.drawRightString(x, y, text)
    else:
        c.drawString(x, y, text)


def s25_phone(c, x, y, w, h, screen=BEIGE, dark_status=False, show_bars=True):
    """Dibuja un Samsung Galaxy S25: marco recto con esquinas suaves, agujero central y barra de gestos One UI.
    Devuelve (sx, sy, sw, sh, safe_top, safe_bot) del área de pantalla."""
    # Botones laterales S25 (volumen y encendido a la derecha)
    c.setFillColor(TITANIUM)
    c.roundRect(x + w - 0.6, y + h * 0.56, 2.0, h * 0.14, 0.8, fill=1, stroke=0)
    c.roundRect(x + w - 0.6, y + h * 0.44, 2.0, h * 0.07, 0.8, fill=1, stroke=0)
    # Chasis y bisel fino
    rrect(c, x, y, w, h, 11, TITANIUM, BLACK, 0.9)
    sx, sy = x + 3.2, y + 3.2
    sw, sh = w - 6.4, h - 6.4
    rrect(c, sx, sy, sw, sh, 8.5, screen)

    status_h = 11
    nav_h = 9
    fg = HexColor("#e8e5e0") if dark_status else INK
    sub_fg = HexColor("#a8b0b3") if dark_status else MUTED
    if show_bars:
        # Hora a la izquierda e iconos One UI a la derecha
        txt(c, "12:45", sx + 6, sy + sh - 8.2, 5.2, True, fg)
        txt(c, "5G  98%", sx + sw - 6, sy + sh - 8.2, 4.8, False, sub_fg, "right")
    # Cámara perforada centrada (Infinity-O del S25)
    c.setFillColor(TRUE_BLACK)
    c.circle(sx + sw / 2, sy + sh - 5.6, 2.3, fill=1, stroke=0)
    # Barra de gestos inferior One UI
    pill_w = sw * 0.34
    c.setFillColor(HexColor("#d8d4cd") if dark_status else HexColor("#5e6669"))
    c.roundRect(sx + (sw - pill_w) / 2, sy + 2.6, pill_w, 2.0, 1.0, fill=1, stroke=0)
    return sx, sy, sw, sh, sy + sh - status_h, sy + nav_h


def app_header(c, sx, top_y, sw, compact=True):
    """Encabezado real de Historys: icono, título y botones i / R."""
    hy = top_y - (11 if compact else 13)
    rrect(c, sx + 5, hy, 8, 8, 2, INK)
    txt(c, "Historys", sx + 16, hy + 1.5, 6.6 if compact else 7.2, True, INK)
    # Botón i y botón R
    c.setStrokeColor(LINE)
    c.setFillColor(PAPER)
    c.circle(sx + sw - 18, hy + 4, 3.6, fill=1, stroke=1)
    txt(c, "i", sx + sw - 18, hy + 2.1, 4.8, True, INK, "center")
    c.setFillColor(INK)
    c.circle(sx + sw - 8.5, hy + 4, 3.6, fill=1, stroke=0)
    txt(c, "R", sx + sw - 8.5, hy + 2.1, 4.8, True, white, "center")
    return hy


def play(c, cx, cy, s, color=white):
    p = c.beginPath()
    p.moveTo(cx - s * 0.28, cy - s * 0.38)
    p.lineTo(cx - s * 0.28, cy + s * 0.38)
    p.lineTo(cx + s * 0.42, cy)
    p.close()
    c.setFillColor(color)
    c.drawPath(p, fill=1, stroke=0)


def story(c, x, y, w, h, mode="bands", clutter=False, borders=True, empty_third=False):
    c.setFillColor(TRUE_BLACK)
    c.rect(x, y, w, h, fill=1, stroke=0)
    pad = (2.6 if not clutter else 2.2) if borders else 0
    gap = 2.4 if borders else 0
    inner_x, inner_y = x + pad, y + pad
    inner_w, inner_h = w - pad * 2, h - pad * 2
    if mode == "bands":
        n = 3
        sh = (inner_h - gap * (n - 1)) / n
        colors = [PHOTO, VIDEO, EMPTY if empty_third else PHOTO_B]
        for i in range(n):
            sy = inner_y + inner_h - (i + 1) * sh - i * gap
            if clutter:
                draw_clutter_slot(c, inner_x, sy, inner_w, sh, colors[i], video=(i == 1))
            else:
                c.setFillColor(colors[i])
                c.rect(inner_x, sy, inner_w, sh, fill=1, stroke=0)
                if i == 1:
                    play(c, inner_x + inner_w / 2, sy + sh / 2, min(sh * 0.55, 12), INK)
                if i == 2 and empty_third:
                    txt(c, "Toca para cargar", inner_x + inner_w / 2, sy + sh / 2 - 2, 4.6, True, HexColor("#c8c2b8"), "center")
    elif mode == "twoone":
        top_h = (inner_h - gap) * 0.64
        bot_h = inner_h - gap - top_h
        col_w = (inner_w - gap) / 2
        top_y = inner_y + bot_h + gap
        c.setFillColor(PHOTO)
        c.rect(inner_x, top_y, col_w, top_h, fill=1, stroke=0)
        c.setFillColor(VIDEO)
        c.rect(inner_x + col_w + gap, top_y, col_w, top_h, fill=1, stroke=0)
        play(c, inner_x + col_w + gap + col_w / 2, top_y + top_h / 2, 10, INK)
        c.setFillColor(EMPTY if empty_third else PHOTO_B)
        c.rect(inner_x, inner_y, inner_w, bot_h, fill=1, stroke=0)
    elif mode == "onetwo":
        top_h = (inner_h - gap) * 0.34
        bot_h = inner_h - gap - top_h
        col_w = (inner_w - gap) / 2
        c.setFillColor(PHOTO)
        c.rect(inner_x, inner_y + bot_h + gap, inner_w, top_h, fill=1, stroke=0)
        c.setFillColor(VIDEO)
        c.rect(inner_x, inner_y, col_w, bot_h, fill=1, stroke=0)
        play(c, inner_x + col_w / 2, inner_y + bot_h / 2, 10, INK)
        c.setFillColor(PHOTO_B)
        c.rect(inner_x + col_w + gap, inner_y, col_w, bot_h, fill=1, stroke=0)


def draw_clutter_slot(c, x, y, w, h, color, video=False):
    c.setFillColor(color)
    c.rect(x, y, w, h, fill=1, stroke=0)
    bar_h = min(12, h * 0.44)
    c.setFillColor(HexColor("#f7f5f1"))
    c.rect(x, y, w, bar_h, fill=1, stroke=0)
    labels = ["Cargar", "Ajustar", "Quitar"]
    bw = (w - 6) / 3
    for i, lab in enumerate(labels):
        bx = x + 1.5 + i * (bw + 1.5)
        rrect(c, bx, y + 2, bw, bar_h - 4, 3, INK if i == 0 else SOFT)
        txt(c, lab, bx + bw / 2, y + 4.1, 3.8, True, white if i == 0 else INK, "center")
    if video:
        play(c, x + w - 9, y + h - 7, 6, INK)


def pill(c, x, y, w, h, text, fill=INK, fg=white, size=6.5, stroke=None):
    rrect(c, x, y, w, h, h / 2, fill, stroke, 0.6 if stroke else 0)
    txt(c, text, x + w / 2, y + h * 0.30, size, True, fg, "center")


def tag_state(c, x, y, text, good=False):
    fill = HexColor("#dde7f2") if good else HexColor("#efe4e0")
    fg = INK if good else WARN
    rrect(c, x, y, 66, 12, 6, fill)
    txt(c, text, x + 33, y + 3.5, 5.9, True, fg, "center")


def arrow_between(c, cx, cy, label=""):
    c.setStrokeColor(BLUE)
    c.setFillColor(BLUE)
    c.setLineWidth(1.3)
    c.line(cx - 12, cy, cx + 8, cy)
    p = c.beginPath()
    p.moveTo(cx + 8, cy + 4)
    p.lineTo(cx + 14, cy)
    p.lineTo(cx + 8, cy - 4)
    c.drawPath(p, fill=1, stroke=0)
    if label:
        txt(c, label, cx, cy + 7, 5.8, True, BLUE, "center")


def callout(c, x, y, w, title, body):
    rrect(c, x, y, w, 34, 6, PAPER, LINE, 0.5)
    txt(c, title, x + 7, y + 21, 7.0, True, INK)
    txt(c, body, x + 7, y + 9, 6.2, False, MUTED)


def draw_bloqueo(c, x, y, w, h):
    pw, ph = 92, h - 24
    py = y + 6
    p1x, p2x = x + 8, x + 134
    # Antes: dos sesiones posibles
    sx, sy, sw, sh, top_y, bot_y = s25_phone(c, p1x, py, pw, ph)
    tag_state(c, p1x + (pw - 66) / 2, py + ph + 3, "ANTES", False)
    hy = app_header(c, sx, top_y, sw)
    story(c, sx + 14, bot_y + 38, sw - 28, hy - bot_y - 44, mode="bands")
    pill(c, sx + 6, bot_y + 20, (sw - 15) / 2, 13, "Preview", PAPER, INK, 5.4, LINE)
    pill(c, sx + 9 + (sw - 15) / 2, bot_y + 20, (sw - 15) / 2, 13, "Exportar", INK, white, 5.4)
    # Doble toque marcado encima de Exportar
    c.setStrokeColor(WARN)
    c.setLineWidth(1.1)
    c.circle(sx + sw * 0.74, bot_y + 26, 7.5, fill=0, stroke=1)
    txt(c, "2x toque = 2 FFmpeg", sx + sw / 2, bot_y + 7, 5.2, True, WARN, "center")

    arrow_between(c, x + 117, py + ph / 2)

    # Después: candado + progreso único
    sx, sy, sw, sh, top_y, bot_y = s25_phone(c, p2x, py, pw, ph)
    tag_state(c, p2x + (pw - 66) / 2, py + ph + 3, "DESPUÉS · S25", True)
    hy = app_header(c, sx, top_y, sw)
    story(c, sx + 14, bot_y + 44, sw - 28, hy - bot_y - 50, mode="bands")
    pill(c, sx + 6, bot_y + 27, (sw - 15) / 2, 12, "Preview", SOFT, MUTED, 5.2)
    pill(c, sx + 9 + (sw - 15) / 2, bot_y + 27, (sw - 15) / 2, 12, "Exportando...", HexColor("#b7b2aa"), white, 5.0)
    rrect(c, sx + 6, bot_y + 7, sw - 12, 15, 4, SOFT, LINE, 0.4)
    txt(c, "Renderizando video...   48%", sx + 10, bot_y + 15, 4.7, True, INK)
    rrect(c, sx + 10, bot_y + 10, sw - 20, 3.2, 1.6, LINE)
    rrect(c, sx + 10, bot_y + 10, (sw - 20) * 0.48, 3.2, 1.6, INK)

    nx = p2x + pw + 14
    nw = w - (nx - x) - 4
    txt(c, "Qué percibe el usuario en el S25", nx, y + h - 20, 9.0, True, INK)
    callout(c, nx, y + h - 62, nw, "1. Un toque bloquea ambos botones", "Preview y Exportar no responden hasta terminar.")
    callout(c, nx, y + h - 102, nw, "2. Una sola barra debajo", "Sin modales extra: solo el porcentaje del render real.")
    callout(c, nx, y + h - 142, nw, "3. Caché limpia al salir", "El collage_*.mp4 temporal se borra aunque falle.")


def draw_safe(c, x, y, w, h):
    pw, ph = 92, h - 24
    py = y + 6
    p1x, p2x = x + 8, x + 134
    # Antes: título choca con el agujero de cámara del S25 y botones pisan la barra de gestos
    sx, sy, sw, sh, top_y, bot_y = s25_phone(c, p1x, py, pw, ph)
    tag_state(c, p1x + (pw - 66) / 2, py + ph + 3, "ANTES", False)
    # Título metido arriba en la barra de estado
    c.setFillColor(Color(0.72, 0.36, 0.29, alpha=0.18))
    c.rect(sx, top_y - 2, sw, 13, fill=1, stroke=0)
    txt(c, "Historys", sx + 18, top_y + 1.5, 6.8, True, WARN)
    story(c, sx + 14, sy + 20, sw - 28, sh - 38, mode="bands")
    # Botones pegados al borde inferior, pisando la píldora de gestos
    c.setFillColor(Color(0.72, 0.36, 0.29, alpha=0.22))
    c.rect(sx, sy, sw, 14, fill=1, stroke=0)
    pill(c, sx + 6, sy + 1.5, (sw - 15) / 2, 11, "Preview", PAPER, INK, 5.2, WARN)
    pill(c, sx + 9 + (sw - 15) / 2, sy + 1.5, (sw - 15) / 2, 11, "Exportar", INK, white, 5.2)

    arrow_between(c, x + 117, py + ph / 2)

    # Después: insets reales del S25
    sx, sy, sw, sh, top_y, bot_y = s25_phone(c, p2x, py, pw, ph)
    tag_state(c, p2x + (pw - 66) / 2, py + ph + 3, "DESPUÉS · S25", True)
    # Franjas de inset visibles
    c.setFillColor(HexColor("#dde7f2"))
    c.rect(sx, top_y, sw, sh - (top_y - sy), fill=1, stroke=0)
    c.rect(sx, sy, sw, bot_y - sy, fill=1, stroke=0)
    # Redibuja agujero y píldora encima de las franjas
    txt(c, "12:45", sx + 6, sy + sh - 8.2, 5.2, True, INK)
    txt(c, "5G  98%", sx + sw - 6, sy + sh - 8.2, 4.8, False, MUTED, "right")
    c.setFillColor(TRUE_BLACK)
    c.circle(sx + sw / 2, sy + sh - 5.6, 2.3, fill=1, stroke=0)
    c.setFillColor(HexColor("#5e6669"))
    c.roundRect(sx + sw * 0.33, sy + 2.6, sw * 0.34, 2.0, 1.0, fill=1, stroke=0)

    hy = app_header(c, sx, top_y - 1, sw)
    story(c, sx + 14, bot_y + 22, sw - 28, hy - bot_y - 27, mode="bands")
    pill(c, sx + 6, bot_y + 5, (sw - 15) / 2, 12, "Preview", PAPER, INK, 5.2, LINE)
    pill(c, sx + 9 + (sw - 15) / 2, bot_y + 5, (sw - 15) / 2, 12, "Exportar", INK, white, 5.2)

    nx = p2x + pw + 14
    nw = w - (nx - x) - 4
    txt(c, "Adaptado al Galaxy S25", nx, y + h - 20, 9.0, True, INK)
    callout(c, nx, y + h - 62, nw, "Agujero de cámara superior", "El título y los botones i / R bajan bajo el recorte real.")
    callout(c, nx, y + h - 102, nw, "Barra de gestos de One UI", "Preview y Exportar quedan sobre el gesto de Inicio.")
    callout(c, nx, y + h - 142, nw, "También en Preview y Editor", "Los modales miden el área libre antes de encajar el 9:16.")


def draw_lienzo(c, x, y, w, h):
    pw, ph = 92, h - 24
    py = y + 6
    p1x, p2x = x + 8, x + 134
    # Antes: botones metidos dentro de cada slot
    sx, sy, sw, sh, top_y, bot_y = s25_phone(c, p1x, py, pw, ph)
    tag_state(c, p1x + (pw - 66) / 2, py + ph + 3, "ANTES", False)
    hy = app_header(c, sx, top_y, sw)
    story(c, sx + 10, bot_y + 8, sw - 20, hy - bot_y - 14, mode="bands", clutter=True)

    arrow_between(c, x + 117, py + ph / 2, "tocar")

    # Después: marco 9:16 limpio + barra contextual fuera
    sx, sy, sw, sh, top_y, bot_y = s25_phone(c, p2x, py, pw, ph)
    tag_state(c, p2x + (pw - 66) / 2, py + ph + 3, "DESPUÉS · S25", True)
    hy = app_header(c, sx, top_y, sw)
    st_x, st_y, st_w, st_h = sx + 13, bot_y + 39, sw - 26, hy - bot_y - 44
    story(c, st_x, st_y, st_w, st_h, mode="bands", clutter=False, empty_third=True)
    # Anillo de selección en el hueco central (vídeo)
    slot_h = (st_h - 2.6 * 2 - 2.4 * 2) / 3
    mid_y = st_y + 2.6 + slot_h + 2.4
    c.setStrokeColor(PAPER)
    c.setLineWidth(1.2)
    c.rect(st_x + 2.6, mid_y, st_w - 5.2, slot_h, fill=0, stroke=1)
    # Barra 2x2 debajo del marco
    txt(c, "Hueco 2 · Vídeo · Audio", sx + 8, bot_y + 30, 4.8, True, INK)
    labels = [("Cargar", True), ("Ajustar", False), ("Audio", False), ("Quitar", False)]
    bw = (sw - 18) / 2
    for i, (lab, on) in enumerate(labels):
        col, row = i % 2, i // 2
        pill(
            c,
            sx + 7 + col * (bw + 4),
            bot_y + 17 - row * 11,
            bw,
            9.5,
            lab,
            INK if on else SOFT,
            white if on else INK,
            4.8,
        )

    nx = p2x + pw + 14
    nw = w - (nx - x) - 4
    txt(c, "El marco es solo la historia", nx, y + h - 20, 9.0, True, INK)
    callout(c, nx, y + h - 62, nw, "Sin barras dentro del 9:16", "La foto no se encoge para dejar sitio a Cargar o Quitar.")
    callout(c, nx, y + h - 102, nw, "Hueco vacío = negro real", "Dice «Toca para cargar» sobre el negro que saldrá en el MP4.")
    callout(c, nx, y + h - 142, nw, "Acciones debajo al tocar", "Rejilla 2×2 cómoda para el pulgar; Audio solo en vídeos.")


def draw_encuadre(c, x, y, w, h):
    pw, ph = 92, h - 24
    py = y + 6
    p1x, p2x = x + 8, x + 134
    # Antes: editor con recorte que luego no coincide
    sx, sy, sw, sh, top_y, bot_y = s25_phone(c, p1x, py, pw, ph, screen=BLACK, dark_status=True)
    tag_state(c, p1x + (pw - 66) / 2, py + ph + 3, "ANTES", False)
    txt(c, "Ajustar foto", sx + 7, top_y - 11, 6.2, True, white)
    # Caja cuadrada aunque el slot sea una banda horizontal
    ed_w, ed_h = sw - 16, sw - 16
    ed_x, ed_y = sx + 8, bot_y + 34
    rrect(c, ed_x, ed_y, ed_w, ed_h, 5, HexColor("#090c0d"), WARN, 0.8)
    c.setFillColor(PHOTO)
    c.rect(ed_x + 8, ed_y + 10, ed_w - 16, ed_h - 20, fill=1, stroke=0)
    c.setFillColor(HexColor("#9e8f7c"))
    c.circle(ed_x + ed_w * 0.62, ed_y + ed_h * 0.56, 9, fill=1, stroke=0)
    txt(c, "±220 px fijos", sx + sw / 2, bot_y + 20, 5.2, True, WARN, "center")
    txt(c, "En el MP4 sale otro corte", sx + sw / 2, bot_y + 10, 4.8, False, HexColor("#d7d2ca"), "center")

    arrow_between(c, x + 117, py + ph / 2)

    # Después: editor en S25 con la proporción real del slot
    sx, sy, sw, sh, top_y, bot_y = s25_phone(c, p2x, py, pw, ph, screen=BLACK, dark_status=True)
    tag_state(c, p2x + (pw - 66) / 2, py + ph + 3, "EDITOR · S25", True)
    txt(c, "Ajustar vídeo", sx + 7, top_y - 10, 6.2, True, white)
    txt(c, "Arrastra para mover. Pinza o +/-.", sx + 7, top_y - 18, 4.5, False, HexColor("#b8c0c3"))
    # Ventana con proporción real de banda horizontal (1032 x 608 ~ 1.7:1)
    slot_w = sw - 14
    slot_h = slot_w / 1.68
    slot_x = sx + 7
    slot_y = bot_y + 48
    # Imagen más grande que el hueco, indicando el sobrante
    c.setStrokeColor(HexColor("#465255"))
    c.setLineWidth(0.6)
    c.rect(slot_x - 3, slot_y - 5, slot_w + 6, slot_h + 10, fill=0, stroke=1)
    c.saveState()
    p = c.beginPath()
    p.rect(slot_x, slot_y, slot_w, slot_h)
    c.clipPath(p, stroke=0)
    c.setFillColor(VIDEO)
    c.rect(slot_x - 8, slot_y - 6, slot_w + 16, slot_h + 12, fill=1, stroke=0)
    c.setFillColor(HexColor("#7f95b0"))
    c.circle(slot_x + slot_w * 0.58, slot_y + slot_h * 0.54, 10, fill=1, stroke=0)
    c.restoreState()
    c.setStrokeColor(BLUE)
    c.setLineWidth(1.0)
    c.rect(slot_x, slot_y, slot_w, slot_h, fill=0, stroke=1)
    # Controles de zoom y acciones
    pill(c, sx + 8, bot_y + 25, 14, 11, "-", HexColor("#2f3638"), white, 6.5)
    txt(c, "Zoom 140%", sx + sw / 2, bot_y + 28, 5.2, True, HexColor("#d9d4cc"), "center")
    pill(c, sx + sw - 22, bot_y + 25, 14, 11, "+", HexColor("#2f3638"), white, 6.5)
    bw = (sw - 18) / 3
    for i, lab in enumerate(("Reset", "Cancelar", "Guardar")):
        on = lab == "Guardar"
        pill(c, sx + 6 + i * (bw + 3), bot_y + 8, bw, 11, lab, PAPER if on else HexColor("#2a3133"), INK if on else HexColor("#d7d2ca"), 4.7)

    nx = p2x + pw + 14
    nw = w - (nx - x) - 4
    txt(c, "Ese mismo corte en los 3 sitios", nx, y + h - 20, 9.0, True, INK)
    callout(c, nx, y + h - 62, nw, "Proporción real del hueco", "Banda horizontal o columna vertical, igual que el slot elegido.")
    callout(c, nx, y + h - 102, nw, "Desplazamiento −1..1", "Fracción del sobrante real, idéntica en el S25 y a 1080×1920.")
    callout(c, nx, y + h - 142, nw, "Miniatura, preview y MP4", "Al pulsar Guardar, la miniatura del vídeo ya enseña el recorte.")


def draw_rotacion(c, x, y, w, h):
    pw, ph = 92, h - 24
    py = y + 6
    p1x, p2x = x + 8, x + 134
    # Antes: vídeo grabado en vertical con el S25 sale tumbado en el slot
    sx, sy, sw, sh, top_y, bot_y = s25_phone(c, p1x, py, pw, ph)
    tag_state(c, p1x + (pw - 66) / 2, py + ph + 3, "ANTES", False)
    hy = app_header(c, sx, top_y, sw)
    st_x, st_y, st_w, st_h = sx + 12, bot_y + 14, sw - 24, hy - bot_y - 20
    c.setFillColor(TRUE_BLACK)
    c.rect(st_x, st_y, st_w, st_h, fill=1, stroke=0)
    # Slot superior con vídeo tumbado (franja estrecha horizontal con barras negras)
    top_slot_h = (st_h - 7) * 0.62
    top_slot_y = st_y + st_h - top_slot_h - 2.5
    c.setFillColor(VIDEO)
    c.rect(st_x + 3, top_slot_y + top_slot_h * 0.32, st_w - 6, top_slot_h * 0.36, fill=1, stroke=0)
    txt(c, "90° ignorado", st_x + st_w / 2, top_slot_y + top_slot_h * 0.46, 5.2, True, WARN, "center")
    c.setFillColor(PHOTO)
    c.rect(st_x + 3, st_y + 2.5, st_w - 6, st_h - top_slot_h - 7.5, fill=1, stroke=0)

    arrow_between(c, x + 117, py + ph / 2, "ffprobe")

    # Después: vídeo de pie + pastilla Corregido
    sx, sy, sw, sh, top_y, bot_y = s25_phone(c, p2x, py, pw, ph)
    tag_state(c, p2x + (pw - 66) / 2, py + ph + 3, "DESPUÉS · S25", True)
    hy = app_header(c, sx, top_y, sw)
    st_x, st_y, st_w, st_h = sx + 12, bot_y + 14, sw - 24, hy - bot_y - 20
    c.setFillColor(TRUE_BLACK)
    c.rect(st_x, st_y, st_w, st_h, fill=1, stroke=0)
    top_slot_h = (st_h - 7) * 0.62
    top_slot_y = st_y + st_h - top_slot_h - 2.5
    c.setFillColor(VIDEO)
    c.rect(st_x + 3, top_slot_y, st_w - 6, top_slot_h, fill=1, stroke=0)
    play(c, st_x + st_w / 2, top_slot_y + top_slot_h / 2, 11, INK)
    pill(c, st_x + 5, top_slot_y + top_slot_h - 11, 34, 8.5, "Corregido", BLACK, white, 4.3)
    pill(c, st_x + st_w - 28, top_slot_y + top_slot_h - 11, 23, 8.5, "VIDEO", BLACK, white, 4.3)
    c.setFillColor(PHOTO)
    c.rect(st_x + 3, st_y + 2.5, st_w - 6, st_h - top_slot_h - 7.5, fill=1, stroke=0)

    nx = p2x + pw + 14
    nw = w - (nx - x) - 4
    txt(c, "Cámara vertical del S25", nx, y + h - 20, 9.0, True, INK)
    callout(c, nx, y + h - 62, nw, "Metadato de rotación", "El S25 guarda 1920×1080 con giro de 90°. Se lee con ffprobe.")
    callout(c, nx, y + h - 102, nw, "transpose antes de escalar", "FFmpeg pone el vídeo de pie antes de aplicar zoom y recorte.")
    callout(c, nx, y + h - 142, nw, "Pastilla «Corregido»", "Solo sale cuando hubo giro. Las fotos no pasan por este filtro.")


def draw_audio(c, x, y, w, h):
    pw, ph = 92, h - 24
    py = y + 6
    p1x, p2x = x + 8, x + 134
    # Antes: botón Audio solo cambia de color y solo suena el primer vídeo
    sx, sy, sw, sh, top_y, bot_y = s25_phone(c, p1x, py, pw, ph)
    tag_state(c, p1x + (pw - 66) / 2, py + ph + 3, "ANTES", False)
    hy = app_header(c, sx, top_y, sw)
    story(c, sx + 13, bot_y + 36, sw - 26, hy - bot_y - 42, mode="twoone")
    txt(c, "2 pistas AAC separadas", sx + sw / 2, bot_y + 22, 5.1, True, WARN, "center")
    txt(c, "El vídeo 2 no se oye", sx + sw / 2, bot_y + 11, 4.9, False, MUTED, "center")

    arrow_between(c, x + 117, py + ph / 2, "amix")

    # Después: barra con Audio/Silencio claro y aviso de mezcla
    sx, sy, sw, sh, top_y, bot_y = s25_phone(c, p2x, py, pw, ph)
    tag_state(c, p2x + (pw - 66) / 2, py + ph + 3, "DESPUÉS · S25", True)
    hy = app_header(c, sx, top_y, sw)
    story(c, sx + 13, bot_y + 46, sw - 26, hy - bot_y - 51, mode="twoone")
    txt(c, "Hueco 2 · Vídeo · Silencio", sx + 7, bot_y + 37, 4.7, True, INK)
    bw = (sw - 18) / 2
    pill(c, sx + 7, bot_y + 25, bw, 9.5, "Cargar", INK, white, 4.7)
    pill(c, sx + 11 + bw, bot_y + 25, bw, 9.5, "Ajustar", SOFT, INK, 4.7)
    pill(c, sx + 7, bot_y + 14, bw, 9.5, "Silencio", HexColor("#dde7f2"), INK, 4.7, BLUE)
    pill(c, sx + 11 + bw, bot_y + 14, bw, 9.5, "Quitar", SOFT, INK, 4.7)
    txt(c, "Se mezclarán en una pista", sx + 7, bot_y + 6, 4.8, True, INK)

    nx = p2x + pw + 14
    nw = w - (nx - x) - 4
    txt(c, "Audio claro antes de exportar", nx, y + h - 20, 9.0, True, INK)
    callout(c, nx, y + h - 62, nw, "Texto «Audio» o «Silencio»", "El botón y el título del hueco dicen el estado con palabras.")
    callout(c, nx, y + h - 102, nw, "«Se mezclarán en una pista»", "Aparece bajo la barra cuando hay 2 o más vídeos con sonido.")
    callout(c, nx, y + h - 142, nw, "Clip sin audio no rompe nada", "Si un vídeo no trae pista de audio, se omite de la mezcla.")


def draw_calidad(c, x, y, w, h):
    pw, ph = 92, h - 24
    py = y + 6
    p1x, p2x = x + 8, x + 134
    # Antes: sin selector de calidad y caída silenciosa a mpeg4
    sx, sy, sw, sh, top_y, bot_y = s25_phone(c, p1x, py, pw, ph)
    tag_state(c, p1x + (pw - 66) / 2, py + ph + 3, "ANTES", False)
    hy = app_header(c, sx, top_y, sw)
    story(c, sx + 14, bot_y + 42, sw - 28, hy - bot_y - 48, mode="bands")
    # Solo fila de duración
    dw = (sw - 21) / 4
    for i, sec in enumerate(("5s", "10s", "15s", "30s")):
        on = sec == "10s"
        pill(c, sx + 6 + i * (dw + 3), bot_y + 26, dw, 10, sec, INK if on else SOFT, white if on else INK, 4.6)
    txt(c, "Bitrate fijo · mpeg4 oculto", sx + sw / 2, bot_y + 11, 4.9, True, WARN, "center")

    arrow_between(c, x + 117, py + ph / 2)

    # Después: fila Baja / Media / Alta debajo de duración
    sx, sy, sw, sh, top_y, bot_y = s25_phone(c, p2x, py, pw, ph)
    tag_state(c, p2x + (pw - 66) / 2, py + ph + 3, "DESPUÉS · S25", True)
    hy = app_header(c, sx, top_y, sw)
    story(c, sx + 14, bot_y + 52, sw - 28, hy - bot_y - 57, mode="bands")
    dw = (sw - 21) / 4
    for i, sec in enumerate(("5s", "10s", "15s", "30s")):
        on = sec == "10s"
        pill(c, sx + 6 + i * (dw + 3), bot_y + 37, dw, 9.5, sec, INK if on else SOFT, white if on else INK, 4.5)
    qw = (sw - 18) / 3
    for i, qlab in enumerate(("Baja", "Media", "Alta")):
        on = qlab == "Media"
        pill(c, sx + 6 + i * (qw + 3), bot_y + 24, qw, 10, qlab, INK if on else SOFT, white if on else INK, 4.8)
    pill(c, sx + 6, bot_y + 7, (sw - 15) / 2, 12, "Preview", PAPER, INK, 5.2, LINE)
    pill(c, sx + 9 + (sw - 15) / 2, bot_y + 7, (sw - 15) / 2, 12, "Exportar", INK, white, 5.2)

    nx = p2x + pw + 14
    nw = w - (nx - x) - 4
    txt(c, "H.264 en el Snapdragon del S25", nx, y + h - 20, 9.0, True, INK)
    callout(c, nx, y + h - 62, nw, "Baja · Media · Alta", "Media viene marcada (15 Mbps, igual que antes). Alta sube a 28 Mbps.")
    callout(c, nx, y + h - 102, nw, "h264_mediacodec → libx264 → mpeg4", "En el S25 codifica por hardware. libx264 entra antes de mpeg4.")
    callout(c, nx, y + h - 142, nw, "Aviso honesto de códec", "ffprobe revisa el MP4; si no es H.264, la hoja final lo avisa.")


def draw_preview(c, x, y, w, h):
    pw, ph = 92, h - 24
    py = y + 6
    p1x, p2x = x + 8, x + 134
    # Antes: preview con margen de 6 px, esquinas redondas y cartel "Sin contenido"
    sx, sy, sw, sh, top_y, bot_y = s25_phone(c, p1x, py, pw, ph, screen=BLACK, dark_status=True)
    tag_state(c, p1x + (pw - 66) / 2, py + ph + 3, "ANTES", False)
    txt(c, "Preview", sx + 7, top_y - 10, 5.6, True, white)
    st_x, st_y, st_w, st_h = sx + 11, bot_y + 18, sw - 22, top_y - bot_y - 32
    rrect(c, st_x, st_y, st_w, st_h, 7, TRUE_BLACK, WARN, 0.7)
    sh_slot = (st_h - 14) / 3
    rrect(c, st_x + 4, st_y + st_h - sh_slot - 4, st_w - 8, sh_slot, 4, PHOTO)
    rrect(c, st_x + 4, st_y + sh_slot + 6, st_w - 8, sh_slot, 4, VIDEO)
    rrect(c, st_x + 4, st_y + 4, st_w - 8, sh_slot, 4, HexColor("#1c2325"))
    txt(c, "Sin contenido", st_x + st_w / 2, st_y + 4 + sh_slot / 2 - 2, 4.5, True, WARN, "center")

    arrow_between(c, x + 117, py + ph / 2, "rejilla")

    # Después: preview 9:16 idéntico al MP4
    sx, sy, sw, sh, top_y, bot_y = s25_phone(c, p2x, py, pw, ph, screen=BLACK, dark_status=True)
    tag_state(c, p2x + (pw - 66) / 2, py + ph + 3, "PREVIEW · S25", True)
    txt(c, "Preview en reproducción", sx + 7, top_y - 10, 5.2, True, white)
    pill(c, sx + sw - 23, top_y - 13, 16, 8.5, "8s", HexColor("#283032"), white, 4.6)
    st_x, st_y, st_w, st_h = sx + 11, bot_y + 18, sw - 22, top_y - bot_y - 32
    story(c, st_x, st_y, st_w, st_h, mode="bands", borders=True, empty_third=False)
    # Tercer hueco negro limpio, igual que en el MP4
    pad = 2.6
    gap = 2.4
    sh_slot = (st_h - pad * 2 - gap * 2) / 3
    c.setFillColor(TRUE_BLACK)
    c.rect(st_x + pad, st_y + pad, st_w - pad * 2, sh_slot, fill=1, stroke=0)
    pill(c, sx + 8, bot_y + 4, sw - 16, 10.5, "Cerrar preview", HexColor("#20282a"), white, 4.8, HexColor("#596466"))

    nx = p2x + pw + 14
    nw = w - (nx - x) - 4
    txt(c, "El preview es el fotograma del MP4", nx, y + h - 20, 9.0, True, INK)
    callout(c, nx, y + h - 62, nw, "Una sola geometría", "CollageLayout escala los rectángulos de getSlotBoundsMap.")
    callout(c, nx, y + h - 102, nw, "Cortes rectos y huecos negros", "Sin bordes redondeados falsos ni textos ajenos al vídeo.")
    callout(c, nx, y + h - 142, nw, "Respeta Silencio y duración", "Cuenta atrás arriba y cada vídeo suena o calla según su botón.")


def draw_layouts(c, x, y, w, h):
    pw, ph = 92, h - 24
    py = y + 6
    p1x, p2x = x + 8, x + 134
    # Antes: menú desplegable de texto que tapa la pantalla
    sx, sy, sw, sh, top_y, bot_y = s25_phone(c, p1x, py, pw, ph)
    tag_state(c, p1x + (pw - 66) / 2, py + ph + 3, "ANTES", False)
    hy = app_header(c, sx, top_y, sw)
    rrect(c, sx + 6, hy - 16, sw - 12, 12, 4, PAPER, LINE, 0.5)
    txt(c, "2 verticales + 1 horiz.  ▼", sx + 10, hy - 12, 4.7, True, INK)
    # Desplegable abierto
    rrect(c, sx + 6, hy - 54, sw - 12, 36, 4, PAPER, WARN, 0.6)
    txt(c, "3 slots horizontales", sx + sw / 2, hy - 27, 4.6, False, INK, "center")
    rrect(c, sx + 6, hy - 42, sw - 12, 12, 0, INK)
    txt(c, "2 verticales + 1 horizontal", sx + sw / 2, hy - 38, 4.5, True, white, "center")
    txt(c, "1 horizontal + 2 verticales", sx + sw / 2, hy - 50, 4.6, False, INK, "center")
    story(c, sx + 16, bot_y + 8, sw - 32, hy - bot_y - 66, mode="twoone")

    arrow_between(c, x + 117, py + ph / 2)

    # Después: 3 tarjetas visuales con miniatura 9:16 + chips de bordes aparte
    sx, sy, sw, sh, top_y, bot_y = s25_phone(c, p2x, py, pw, ph)
    tag_state(c, p2x + (pw - 66) / 2, py + ph + 3, "DESPUÉS · S25", True)
    hy = app_header(c, sx, top_y, sw)
    cw = (sw - 18) / 3
    ch = 36
    cy = hy - ch - 4
    cards = [("3 bandas", "bands", False), ("2+1", "twoone", True), ("1+2", "onetwo", False)]
    for i, (lab, mode, on) in enumerate(cards):
        cx = sx + 6 + i * (cw + 3)
        rrect(c, cx, cy, cw, ch, 5, INK if on else PAPER, INK if on else LINE, 0.6)
        story(c, cx + (cw - 14) / 2, cy + 10, 14, 23, mode=mode)
        txt(c, lab, cx + cw / 2, cy + 3, 4.3, True, white if on else INK, "center")
    # Chips de bordes debajo
    pill(c, sx + 6, cy - 12, 36, 9, "Con bordes", INK, white, 4.4)
    pill(c, sx + 45, cy - 12, 34, 9, "Sin bordes", SOFT, INK, 4.4)
    story(c, sx + 15, bot_y + 8, sw - 30, cy - bot_y - 24, mode="twoone")

    nx = p2x + pw + 14
    nw = w - (nx - x) - 4
    txt(c, "Se elige viendo la forma", nx, y + h - 20, 9.0, True, INK)
    callout(c, nx, y + h - 62, nw, "3 bandas · 2+1 · 1+2", "Tres miniaturas dibujadas con la misma rejilla que el lienzo.")
    callout(c, nx, y + h - 102, nw, "Los medios no se pierden", "Al cambiar de forma, el contenido sigue en el hueco 1, 2 y 3.")
    callout(c, nx, y + h - 142, nw, "Bordes sigue separado", "Con bordes / Sin bordes cambia el margen de miniaturas y marco.")


def draw_listo(c, x, y, w, h):
    pw, ph = 92, h - 24
    py = y + 6
    p1x, p2x = x + 8, x + 134
    # Antes: al terminar vacía todos los huecos automáticamente
    sx, sy, sw, sh, top_y, bot_y = s25_phone(c, p1x, py, pw, ph)
    tag_state(c, p1x + (pw - 66) / 2, py + ph + 3, "ANTES", False)
    hy = app_header(c, sx, top_y, sw)
    # Lienzo ya vacío detrás
    c.setFillColor(TRUE_BLACK)
    c.rect(sx + 13, bot_y + 12, sw - 26, hy - bot_y - 18, fill=1, stroke=0)
    c.setFillColor(Color(0.1, 0.12, 0.13, alpha=0.48))
    c.rect(sx, sy, sw, sh, fill=1, stroke=0)
    rrect(c, sx + 7, py + ph * 0.30, sw - 14, 58, 7, PAPER, WARN, 0.7)
    txt(c, "Exportación completada", sx + sw / 2, py + ph * 0.30 + 44, 5.2, True, INK, "center")
    txt(c, "El lienzo se vació solo", sx + sw / 2, py + ph * 0.30 + 30, 5.0, True, WARN, "center")
    pill(c, sx + 16, py + ph * 0.30 + 8, sw - 32, 11, "Genial", INK, white, 5.0)

    arrow_between(c, x + 117, py + ph / 2)

    # Después: hoja Listo con miniatura, Ver galería, Nuevo collage y Seguir editando
    sx, sy, sw, sh, top_y, bot_y = s25_phone(c, p2x, py, pw, ph)
    tag_state(c, p2x + (pw - 66) / 2, py + ph + 3, "DESPUÉS · S25", True)
    hy = app_header(c, sx, top_y, sw)
    # El collage sigue cargado detrás
    story(c, sx + 13, bot_y + 12, sw - 26, hy - bot_y - 18, mode="bands")
    c.setFillColor(Color(0.1, 0.12, 0.13, alpha=0.42))
    c.rect(sx, sy, sw, sh, fill=1, stroke=0)
    card_y = py + 16
    card_h = ph - 34
    rrect(c, sx + 6, card_y, sw - 12, card_h, 8, PAPER, LINE, 0.6)
    story(c, sx + (sw - 20) / 2, card_y + card_h - 40, 20, 34, mode="bands")
    txt(c, "Listo", sx + 12, card_y + card_h - 50, 6.0, True, INK)
    txt(c, "Guardado en álbum Historys.", sx + 12, card_y + card_h - 58, 4.5, False, MUTED)
    pill(c, sx + 10, card_y + 27, sw - 20, 9.5, "Ver galería", INK, white, 4.7)
    pill(c, sx + 10, card_y + 15.5, sw - 20, 9.5, "Nuevo collage", SOFT, INK, 4.7, LINE)
    pill(c, sx + 10, card_y + 4, sw - 20, 9.5, "Seguir editando", SOFT, INK, 4.7, LINE)

    nx = p2x + pw + 14
    nw = w - (nx - x) - 4
    txt(c, "El trabajo no se borra solo", nx, y + h - 20, 9.0, True, INK)
    callout(c, nx, y + h - 62, nw, "Hoja «Listo» con miniatura", "El collage sigue debajo por si quieres cambiar un hueco.")
    callout(c, nx, y + h - 102, nw, "«Nuevo collage» pide permiso", "Pregunta antes de vaciar fotos y vídeos; conserva la forma.")
    callout(c, nx, y + h - 142, nw, "Guía de 3 líneas el primer día", "«Elige la forma. Toca un hueco. Exporta.» Solo la 1.ª vez.")


DRAW = {
    "bloqueo": draw_bloqueo,
    "safe": draw_safe,
    "lienzo": draw_lienzo,
    "encuadre": draw_encuadre,
    "rotacion": draw_rotacion,
    "audio": draw_audio,
    "calidad": draw_calidad,
    "preview": draw_preview,
    "layouts": draw_layouts,
    "listo": draw_listo,
}


PHASES = [
    {
        "n": "01",
        "title": "La exportación no se lanza dos veces",
        "art": "bloqueo",
        "art_h": 176,
        "depends": "Ninguna. Es la primera.",
        "problem": "Exportar sigue pulsable mientras FFmpeg trabaja. Un segundo toque abre otra sesión encima. El MP4 temporal se queda en la caché. <b>package.json</b>, <b>app.json</b> y el README dicen 1.0.6, pero el último commit es v1.0.8. El README dice que el fondo negro es un PNG porque no hay libavfilter; el código ya no escribe ese archivo y usa el filtro <b>color=</b>.",
        "fix": "Un candado de verdad (referencia inmediata más botón deshabilitado) para que solo exista una exportación. Borrar el temporal cuando la galería ya copió el archivo, y también si la exportación falla. Dejar la versión en 1.0.9, con versionCode 109. Corregir el README: no se usa el demuxer lavfi; el negro sale del filtro <b>color=</b> dentro de filter_complex.",
        "ux": "En el S25 el botón pasa a «Exportando…» y Preview también queda bloqueado. La tarjeta inferior con el porcentaje es la única señal de espera.",
        "done": "Dos toques seguidos no lanzan dos FFmpeg. La caché no acumula collage_*.mp4. Los tres sitios de la versión coinciden.",
    },
    {
        "n": "02",
        "title": "La interfaz no queda bajo las barras del S25",
        "art": "safe",
        "art_h": 176,
        "depends": "La fase 01, para no mezclar el candado de exportar con el marco de la pantalla.",
        "problem": "Android 15 en el Galaxy S25 dibuja edge-to-edge y el SafeAreaView de React Native no aplica insets. El margen superior era un paddingTop fijo de 42 px. El encabezado se acercaba al agujero de la cámara frontal y Preview / Exportar quedaban pegados a la barra de gestos de One UI.",
        "fix": "Usar react-native-safe-area-context en la pantalla principal, en el preview y en el editor, cada modal con su SafeAreaProvider. Quitar el margen fijo.",
        "ux": "El título Historys y los botones i / R quedan bajo la barra de estado del S25. Preview, Exportar, Cerrar preview y Guardar quedan por encima del gesto de Inicio.",
        "done": "En el Samsung S25 con navegación por gestos, ningún control queda debajo de la cámara ni de la barra inferior.",
    },
    {
        "n": "03",
        "title": "Un solo lienzo: el marco 9:16 limpio",
        "art": "lienzo",
        "art_h": 176,
        "depends": "La fase 02. El marco nuevo necesita el margen real del teléfono.",
        "problem": "Cargar, Ajustar, Audio y Quitar vivían dentro del marco 9:16. La foto se encogía para dejar sitio a los botones, y esa rejilla no era la del preview ni la que arma FFmpeg.",
        "fix": "El marco solo pinta foto, vídeo o negro. Las acciones pasan a una barra exterior en rejilla 2×2 que aparece al tocar un hueco.",
        "ux": "Tocas un hueco en el S25: se marca con un borde claro y debajo aparecen Cargar, Ajustar, Audio y Quitar, solo las que aplican. Un hueco vacío es negro y dice «Toca para cargar».",
        "done": "Dentro del 9:16 no hay botones. Lo que se ve en el marco es solo imagen, vídeo o negro.",
    },
    {
        "n": "04",
        "title": "El encuadre que guardas es el que sale",
        "art": "encuadre",
        "art_h": 176,
        "depends": "La fase 03. El editor trabaja sobre un slot que ya no lleva botones dentro.",
        "problem": "En pantalla el desplazamiento era un translate de ±220 px sobre una vista pequeña. FFmpeg convertía ese número en otra cosa a 1080×1920. El zoom tampoco coincidía, la miniatura del vídeo ignoraba el ajuste y el editor siempre decía «Ajustar foto».",
        "fix": "Una sola función (placedMediaRect): escala y desplazamiento normalizados entre −1 y 1 sobre el sobrante real del hueco. La usan el editor, la miniatura, el preview y el crop de FFmpeg.",
        "ux": "El editor abre una ventana con la proporción exacta del hueco elegido (banda horizontal o columna vertical). El título dice «Ajustar foto» o «Ajustar vídeo». Al guardar, la miniatura ya muestra ese recorte.",
        "done": "El mismo ajuste se ve igual en el editor, en el marco principal, en el preview y en el MP4.",
    },
    {
        "n": "05",
        "title": "Los vídeos verticales del S25 salen derechos",
        "art": "rotacion",
        "art_h": 176,
        "depends": "La fase 04. El filtro de rotación entra en la misma cadena de escala y recorte.",
        "problem": "La cámara del S25 graba muchos vídeos verticales como 1920×1080 en píxeles con rotación de 90° en los metadatos. Sin compensar ese giro antes del scale/crop, el vídeo salía tumbado o deformado. Las fotos ya vienen orientadas y no deben girarse.",
        "fix": "Leer la rotación del stream de vídeo con ffprobe (display matrix / tag rotate) y aplicar transpose o hflip,vflip antes de escalar. Las fotos no pasan por ese filtro.",
        "ux": "El usuario no tiene que tocar nada. Si FFmpeg tuvo que enderezar el clip, el hueco muestra una pastilla discreta «Corregido».",
        "done": "Un vídeo vertical de la cámara del S25 sale vertical en el MP4. Una foto no se gira.",
    },
    {
        "n": "06",
        "title": "Una sola pista de audio",
        "art": "audio",
        "art_h": 176,
        "depends": "La fase 05. Se toca el mismo comando, con la cadena de vídeo ya estable.",
        "problem": "Cada vídeo con sonido se mapeaba por separado y el MP4 quedaba con varias pistas. La galería de Samsung e Instagram reproducen la primera y el resto no se oye. Además, un clip sin pista de audio podía romper el comando.",
        "fix": "Comprobar con ffprobe qué vídeos tienen pista de audio y no están silenciados, pasarlos por aformat + apad + atrim y mezclarlos con amix en una única salida AAC.",
        "ux": "En la barra del hueco el botón dice claramente «Audio» o «Silencio» (también en el encabezado del hueco). Cuando hay dos o más vídeos con sonido, debajo aparece «Se mezclarán en una pista».",
        "done": "Dos vídeos con sonido se oyen a la vez en la galería del S25. Uno en Silencio no entra en la mezcla.",
    },
    {
        "n": "07",
        "title": "H.264 para el S25 y calidad Baja / Media / Alta",
        "art": "calidad",
        "art_h": 176,
        "depends": "La fase 06. El encoder es el último paso del mismo comando.",
        "problem": "Si h264_mediacodec fallaba, el código caía directo a mpeg4, que Instagram o WhatsApp pueden rechazar, y el diálogo final lo presentaba como un vídeo normal. Tampoco había forma de elegir el peso del archivo.",
        "fix": "Cadena de encoders: h264_mediacodec, luego libx264 si el binario lo incluye, y mpeg4 solo como último recurso. Al terminar, ffprobe revisa el códec real del MP4.",
        "ux": "Debajo de los segundos hay tres pastillas: Baja, Media y Alta. Media viene marcada con los 15 Mbps actuales, así que no cambia nada si no se toca. Si el archivo no quedó en H.264, el aviso final lo dice expresamente.",
        "done": "En el S25 el MP4 sale en H.264. Si en otro entorno cae a mpeg4, la app avisa con el nombre del códec.",
    },
    {
        "n": "08",
        "title": "El preview es el resultado",
        "art": "preview",
        "art_h": 176,
        "depends": "La fase 04 y la 07, para comparar contra un MP4 H.264.",
        "problem": "La interfaz usaba flexbox con hueco de 6 px, bordes redondeados y un cartel «Sin contenido». El vídeo usa 24 px sobre 1080×1920 y huecos negros rectos. Se parecía, pero no coincidía.",
        "fix": "CollageLayout coloca cada hueco escalando directamente los rectángulos de getSlotBoundsMap(layout, hasBlackBorders) sobre el contenedor 9:16.",
        "ux": "El preview a pantalla completa en el S25 enseña exactamente los mismos cortes, márgenes y huecos negros que el MP4, con cuenta atrás y respetando el silencio de cada vídeo.",
        "done": "Una captura del preview en el S25 y un fotograma del MP4 coinciden en cortes, bordes y huecos negros.",
    },
    {
        "n": "09",
        "title": "El estilo se elige viendo la forma",
        "art": "layouts",
        "art_h": 176,
        "depends": "La fase 03 y la 08. Las miniaturas usan la misma rejilla limpia.",
        "problem": "El estilo era un menú desplegable con nombres largos («2 verticales + 1 horizontal») que empujaba la pantalla al abrirse y no dejaba ver qué hueco cambiaba.",
        "fix": "Reemplazar el desplegable por tres tarjetas visuales con miniatura 9:16 dibujada con getSlotBoundsMap: «3 bandas», «2+1» y «1+2». Bordes sigue como pastilla aparte.",
        "ux": "Un toque cambia la forma sin abrir menús. Las fotos y vídeos siguen en slot-1, slot-2 y slot-3, y la miniatura reacciona también a «Con bordes / Sin bordes».",
        "done": "Se cambia de forma viendo el dibujo 9:16, sin desplegable de texto y sin perder los medios cargados.",
    },
    {
        "n": "10",
        "title": "El trabajo no se borra solo",
        "art": "listo",
        "art_h": 176,
        "depends": "La fase 08. La hoja «Listo» enseña la miniatura del resultado real.",
        "problem": "Cuando la exportación salía bien, resetCollage() vaciaba los tres huecos antes de mostrar el aviso. Corregir un zoom o sacar otra duración obligaba a elegir todo otra vez. Faltaba bundleIdentifier en iOS y una guía breve el primer día.",
        "fix": "Quitar el vaciado automático al exportar. Añadir la hoja «Listo» con miniatura, «Ver galería», «Nuevo collage» (con confirmación) y «Seguir editando». Guardar la marca de primera apertura y añadir ios.bundleIdentifier.",
        "ux": "Al terminar en el S25 ves la hoja «Listo» con la miniatura de tu historia. Si cierras o tocas «Seguir editando», tu collage sigue intacto. «Nuevo collage» pregunta antes de borrar. La primera vez aparecen tres líneas arriba: Elige la forma / Toca un hueco / Exporta.",
        "done": "Exportar no borra el collage. Vaciar pide confirmación. La guía de 3 líneas sale solo la primera vez.",
    },
]


def header_footer(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(MUTED)
    canvas.setFont("Segoe", 8)
    canvas.drawString(LEFT, 12 * mm, "Historys  ·  Plan UX en 10 fases (Samsung Galaxy S25)")
    canvas.drawRightString(PAGE_W - RIGHT, 12 * mm, f"{doc.page}")
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.4)
    canvas.line(LEFT, 16 * mm, PAGE_W - RIGHT, 16 * mm)
    canvas.restoreState()


class CoverMark(Flowable):
    def __init__(self):
        super().__init__()
        self.width = 64
        self.height = 116

    def draw(self):
        c = self.canv
        sx, sy, sw, sh, top_y, bot_y = s25_phone(c, 0, 0, self.width, self.height, show_bars=False)
        story(c, sx + 5, sy + 9, sw - 10, sh - 18, mode="bands")


def one_ui_squircle(c, x, y, s, fill, stroke=None):
    rrect(c, x, y, s, s, s * 0.26, fill, stroke, 0.7 if stroke else 0)


def icon_current(c, x, y, s):
    """Esquema del icono actual: varios marcos de colores y líneas diagonales que a 48 dp hacen ruido."""
    one_ui_squircle(c, x, y, s, HexColor("#e9e5df"), LINE)
    c.saveState()
    p = c.beginPath()
    p.roundRect(x, y, s, s, s * 0.26)
    c.clipPath(p, stroke=0)
    c.setStrokeColor(HexColor("#c4beb4"))
    c.setLineWidth(1)
    for k in range(-2, 5):
        c.line(x + k * s * 0.22, y, x + k * s * 0.22 + s * 0.5, y + s)
    c.restoreState()
    boxes = [
        (0.18, 0.46, 0.30, 0.34, HexColor("#6fa882")),
        (0.46, 0.48, 0.32, 0.32, HexColor("#d9925a")),
        (0.22, 0.16, 0.32, 0.28, HexColor("#7a9ccc")),
        (0.48, 0.18, 0.28, 0.26, HexColor("#41484b")),
    ]
    for bx, by, bw, bh, col in boxes:
        rrect(c, x + s * bx, y + s * by, s * bw, s * bh, s * 0.05, col, white, 0.6)
    c.setFillColor(BLUE)
    c.circle(x + s * 0.74, y + s * 0.24, s * 0.10, fill=1, stroke=0)
    play(c, x + s * 0.75, y + s * 0.24, s * 0.10, white)


def icon_story(c, x, y, s):
    """Propuesta 1: el marco 9:16 real de Historys con 3 bandas y play central."""
    one_ui_squircle(c, x, y, s, BEIGE, LINE)
    fw, fh = s * 0.42, s * 0.72
    fx, fy = x + (s - fw) / 2, y + (s - fh) / 2
    rrect(c, fx, fy, fw, fh, max(2.5, s * 0.05), TRUE_BLACK)
    pad = max(1.6, s * 0.032)
    gap = max(1.2, s * 0.024)
    inner_h = fh - pad * 2
    sh = (inner_h - gap * 2) / 3
    colors = [PHOTO, VIDEO, PHOTO_B]
    for i, col in enumerate(colors):
        sy = fy + pad + (2 - i) * (sh + gap)
        c.setFillColor(col)
        c.rect(fx + pad, sy, fw - pad * 2, sh, fill=1, stroke=0)
        if i == 1:
            play(c, fx + fw / 2, sy + sh / 2, max(4.5, s * 0.085), INK)


def icon_h(c, x, y, s):
    """Propuesta 2: una H construida con la rejilla 2+1 sobre fondo tinta y sello play azul."""
    one_ui_squircle(c, x, y, s, INK)
    bar_w = s * 0.15
    left = x + s * 0.23
    bottom = y + s * 0.21
    height = s * 0.58
    r = max(1.8, s * 0.03)
    c.setFillColor(BEIGE)
    c.roundRect(left, bottom, bar_w, height, r, fill=1, stroke=0)
    c.roundRect(left + s * 0.39, bottom, bar_w, height, r, fill=1, stroke=0)
    c.roundRect(left, y + s * 0.43, s * 0.54, s * 0.14, r, fill=1, stroke=0)
    cx = left + s * 0.39 + bar_w / 2
    cy = bottom + height * 0.74
    c.setFillColor(BLUE)
    c.circle(cx, cy, s * 0.085, fill=1, stroke=0)
    play(c, cx + s * 0.008, cy, max(4, s * 0.075), white)


def icon_deck(c, x, y, s):
    """Propuesta 3: mazo limpio de dos historias + carta frontal con rejilla 2+1 y play."""
    one_ui_squircle(c, x, y, s, BEIGE, LINE)
    cw, ch = s * 0.42, s * 0.60
    base_x = x + (s - cw) / 2
    base_y = y + (s - ch) / 2
    rrect(c, base_x - s * 0.09, base_y + s * 0.08, cw, ch, max(2.2, s * 0.05), BLUE)
    rrect(c, base_x, base_y + s * 0.02, cw, ch, max(2.2, s * 0.05), PHOTO)
    fx, fy = base_x + s * 0.09, base_y - s * 0.06
    rrect(c, fx, fy, cw, ch, max(2.2, s * 0.05), INK)
    play(c, fx + cw / 2, fy + ch / 2, max(5, s * 0.11), white)


class IconProposals(Flowable):
    def __init__(self):
        super().__init__()
        self.width = CONTENT_W
        self.height = 228

    def draw(self):
        c = self.canv
        rrect(c, 0, 0, self.width, self.height, 10, BEIGE, LINE, 0.6)
        cols = [
            ("Actual", "4 colores + diagonales", icon_current, False),
            ("Cambio 1 · Marco 9:16", "La historia de 3 bandas", icon_story, True),
            ("Cambio 2 · H + rejilla", "Monograma sobre tinta", icon_h, True),
            ("Cambio 3 · Mazo limpio", "3 capas sin ruido", icon_deck, True),
        ]
        col_w = (self.width - 26) / 4
        for i, (title, sub, fn, rec) in enumerate(cols):
            cx = 10 + i * (col_w + 2)
            rrect(c, cx, 10, col_w - 2, self.height - 20, 8, PAPER, INK if i == 1 else LINE, 1.1 if i == 1 else 0.5)
            txt(c, title, cx + (col_w - 2) / 2, self.height - 24, 7.6, True, INK, "center")
            txt(c, sub, cx + (col_w - 2) / 2, self.height - 34, 6.2, False, MUTED, "center")

            # 1) Muestra grande (icono adaptable One UI con zona segura circular)
            big = 66
            bx = cx + (col_w - 2 - big) / 2
            by = self.height - 110
            fn(c, bx, by, big)
            if rec:
                c.setStrokeColor(BLUE)
                c.setLineWidth(0.5)
                c.setDash(2, 2)
                c.circle(bx + big / 2, by + big / 2, big * 0.33, fill=0, stroke=1)
                c.setDash()
            txt(c, "Icono One UI + zona segura", cx + (col_w - 2) / 2, by - 9, 5.5, False, MUTED, "center")

            # 2) Ejemplo en el cajón del Samsung S25 (fondo oscuro, 28 pt)
            drawer_y = 54
            rrect(c, cx + 8, drawer_y, col_w - 18, 42, 6, BLACK)
            sm = 22
            sx = cx + (col_w - 2 - sm) / 2
            fn(c, sx, drawer_y + 15, sm)
            txt(c, "Historys", cx + (col_w - 2) / 2, drawer_y + 5, 5.6, False, white, "center")

            # 3) Ejemplo a 28 px en el encabezado de la app
            hdr_y = 18
            rrect(c, cx + 8, hdr_y, col_w - 18, 26, 5, BEIGE, LINE, 0.4)
            fn(c, cx + 14, hdr_y + 5, 16)
            txt(c, "Historys", cx + 34, hdr_y + 10, 6.5, True, INK)
            c.setFillColor(INK)
            c.circle(cx + col_w - 20, hdr_y + 13, 4.2, fill=1, stroke=0)
            txt(c, "R", cx + col_w - 20, hdr_y + 11, 4.8, True, white, "center")


def phase_block(phase):
    bits = [
        P(f"Fase {phase['n']}", "kicker"),
        P(phase["title"], "h1"),
        Wire(phase["art"], phase["art_h"]),
        Spacer(1, 4),
        P("Problema", "label"),
        P(phase["problem"]),
        P("Arreglo", "label"),
        P(phase["fix"]),
        P("Mejora de UX en el Samsung S25", "label"),
        P(phase["ux"]),
        P("Depende de", "label"),
        P(phase["depends"], "small"),
        P("Queda hecha cuando", "label"),
        P(phase["done"], "done"),
    ]
    return KeepTogether(bits)


def build():
    out = r"c:\Users\yberbeci\Documents\Apps\historys\docs\plan-10-fases.pdf"
    doc = BaseDocTemplate(
        out,
        pagesize=A4,
        title="Historys — Plan UX de 10 fases (Samsung S25)",
        author="Historys",
        leftMargin=LEFT,
        rightMargin=RIGHT,
        topMargin=18 * mm,
        bottomMargin=20 * mm,
    )
    frame = Frame(LEFT, 20 * mm, CONTENT_W, PAGE_H - 38 * mm, id="main", showBoundary=0)
    doc.addPageTemplates([PageTemplate(id="body", frames=[frame], onPage=header_footer)])

    story_flow = []
    story_flow.append(P("DOCUMENTO DE MEJORA · SAMSUNG GALAXY S25", "kicker"))
    story_flow.append(Spacer(1, 4))
    title_block = [
        P("Diez fases para Historys", "cover_title"),
        P(
            "Revisión de las 10 fases con esquemas Antes / Después sobre un Samsung Galaxy S25 (cámara perforada central y barra de gestos de One UI), más 3 propuestas para el icono.",
            "cover_sub",
        ),
    ]
    cover = Table(
        [[title_block, CoverMark()]],
        colWidths=[CONTENT_W - 72, 72],
    )
    cover.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                ("ALIGN", (1, 0), (1, 0), "RIGHT"),
            ]
        )
    )
    story_flow.append(cover)
    story_flow.append(Spacer(1, 6 * mm))
    story_flow.append(P("Qué muestran las pantallas de este documento", "h2"))
    story_flow.append(
        P(
            "Cada fase enseña a la izquierda el fallo original («ANTES») y a la derecha cómo queda la pantalla en un <b>Samsung Galaxy S25</b> («DESPUÉS»), con el agujero central de la cámara, la barra de gestos inferior de One UI y tres notas al lado para leer de un vistazo qué gana quien usa la app."
        )
    )
    story_flow.append(Spacer(1, 3 * mm))
    story_flow.append(P("Cómo se prueba en el teléfono", "h2"))
    story_flow.append(
        P(
            "Las 10 fases ya están implementadas en el código (v1.0.9). Se prueban juntas en el S25 conectado por USB con un build nativo desde Android Studio o con <b>npm run android</b>, siguiendo la lista de <b>docs/CHECKS.md</b>. Expo Go no incluye FFmpeg nativo."
        )
    )
    story_flow.append(Spacer(1, 5 * mm))
    story_flow.append(P("Resumen de las diez fases", "h2"))

    header = [
        P("#", "cell_b"),
        P("Fase", "cell_b"),
        P("Mejora de UX que se ve en el S25", "cell_b"),
    ]
    rows = [header]
    summaries = [
        "Exportar pasa a «Exportando…», bloquea Preview y limpia el MP4 temporal al terminar.",
        "Título e iconos bajan bajo la cámara del S25; Preview y Exportar suben sobre la barra de gestos.",
        "El marco 9:16 queda sin botones dentro; al tocar un hueco sale debajo una barra 2×2.",
        "El editor abre la proporción real del hueco y ese mismo recorte sale en miniatura, preview y MP4.",
        "Un vídeo vertical de la cámara del S25 se endereza solo y muestra la pastilla «Corregido».",
        "El botón dice «Audio» o «Silencio» con texto y avisa «Se mezclarán en una pista».",
        "Pastillas Baja, Media (15 Mbps) y Alta; H.264 con aviso honesto si cae a otro códec.",
        "El preview 9:16 usa la misma rejilla de 1080×1920 que FFmpeg, sin bordes ni textos falsos.",
        "Tres miniaturas visuales (3 bandas, 2+1, 1+2) en lugar del desplegable de texto.",
        "Hoja «Listo» con miniatura, «Ver galería», «Nuevo collage» con confirmación y guía inicial de 3 líneas.",
    ]
    for phase, summary in zip(PHASES, summaries):
        rows.append(
            [
                P(phase["n"], "cell_b"),
                P(phase["title"], "cell"),
                P(summary, "cell"),
            ]
        )
    table = Table(rows, colWidths=[12 * mm, 64 * mm, CONTENT_W - 76 * mm])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), SOFT),
                ("BACKGROUND", (0, 1), (-1, -1), PAPER),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 4.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4.5),
                ("GRID", (0, 0), (-1, -1), 0.3, LINE),
                ("FONTNAME", (0, 0), (-1, 0), "Segoe-Bold"),
            ]
        )
    )
    story_flow.append(table)
    story_flow.append(Spacer(1, 5 * mm))
    story_flow.append(P("Qué quedó fuera de este ciclo", "h2"))
    story_flow.append(
        P(
            "Recorte de inicio y fin por vídeo, plantillas guardadas y envío directo a Instagram, TikTok o WhatsApp. Se dejaron fuera para fijar primero encuadre, rotación, audio y códec."
        )
    )

    for phase in PHASES:
        story_flow.append(CondPageBreak(235 * mm))
        story_flow.append(Spacer(1, 1 * mm))
        story_flow.append(phase_block(phase))

    story_flow.append(CondPageBreak(235 * mm))
    story_flow.append(Spacer(1, 2 * mm))
    story_flow.append(P("Icono de la app", "kicker"))
    story_flow.append(P("Tres propuestas de cambio, con ejemplo en One UI y en la cabecera", "h1"))
    story_flow.append(
        P(
            "El icono actual junta cuatro marcos de colores distintos (verde, naranja, azul y gris) sobre rayas diagonales. En el cajón de aplicaciones de un Samsung S25 (recorte squircle de One UI) y a 28 px al lado del título «Historys», tantas piezas pequeñas pierden contraste y no usan la paleta real de la app. Abajo se compara el icono actual con tres cambios posibles en tres contextos: icono adaptable con círculo de zona segura (66%), cajón oscuro de One UI y barra superior de la app."
        )
    )
    story_flow.append(Spacer(1, 3 * mm))
    story_flow.append(IconProposals())
    story_flow.append(Spacer(1, 2 * mm))
    story_flow.append(P("Cambio 1 · Marco 9:16 (recomendado)", "h2"))
    story_flow.append(
        P(
            "Sustituye los cuatro cuadros sueltos por el marco negro 9:16 que de verdad produce la app: tres bandas horizontales (foto, vídeo con play, foto) sobre fondo beige #f1efeb. Enseña el producto de un vistazo y sigue siendo nítido a 28 px en la cabecera."
        )
    )
    story_flow.append(P("Cambio 2 · Monograma H con la rejilla 2+1", "h2"))
    story_flow.append(
        P(
            "Invierte el contraste: fondo tinta #2f3638 y una H beige cuyos bloques recuerdan las columnas y la banda del collage, con un punto azul #7a9ccc y el triángulo de play. Es el que más destaca en el cajón del S25 cuando el usuario lleva fondo claro o decenas de iconos de cámara parecidos."
        )
    )
    story_flow.append(P("Cambio 3 · Mazo limpio de 3 capas", "h2"))
    story_flow.append(
        P(
            "Mantiene la idea original de «varias piezas que se juntan», pero quita las rayas diagonales y reduce los colores a los tres de la interfaz: una carta azul, una beige y una frontal en tinta con el play blanco."
        )
    )
    story_flow.append(Spacer(1, 2 * mm))
    story_flow.append(
        P(
            "Cómo se aplica cualquiera de los tres: exportar `assets/icon.png` (1024×1024) y `assets/adaptive-icon.png` con el motivo dentro del 66% central y `backgroundColor` `#f1efeb` (Cambios 1 y 3) o `#2f3638` (Cambio 2) en `app.json`.",
            "small",
        )
    )

    doc.build(story_flow)


if __name__ == "__main__":
    build()
