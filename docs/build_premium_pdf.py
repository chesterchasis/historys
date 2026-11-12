"""Genera docs/propuesta-premium-5-fases.pdf: cinco fases para que Historys transmita calidad superior.

Premium aquí significa calidad percibida y calidad real del resultado, no un modelo de pago.
Reutiliza el móvil Samsung S25 y las pantallas de build_ux_pdf.py y build_plan_pdf.py.
"""

import math
import os
import sys

from reportlab.lib.colors import Color, HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    Flowable,
    Frame,
    PageBreak,
    PageTemplate,
    Preformatted,
    Spacer,
    Table,
    TableStyle,
)

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from build_ux_pdf import (  # noqa: E402
    FULL,
    Wire,
    cells,
    new_main,
    scene,
    table,
    warn_note,
)
from build_plan_pdf import (  # noqa: E402
    BEIGE,
    BLUE,
    CONTENT_W,
    INK,
    LEFT,
    LINE,
    MUTED,
    PAGE_H,
    PAGE_W,
    PAPER,
    RIGHT,
    SOFT,
    TRUE_BLACK,
    WARN,
    P,
    S,
    STYLES,
    rrect,
    txt,
)

GOOD = HexColor("#dde7f2")
CHIP = HexColor("#f2efea")
OK_GREEN = HexColor("#5f8f6b")

STYLES["bullet"] = S("bullet", fontSize=9.3, leading=12.4, leftIndent=11, firstLineIndent=-11, spaceAfter=1)
STYLES["code"] = ParagraphStyle(
    "code",
    fontName="Courier",
    fontSize=7.6,
    leading=10.0,
    textColor=INK,
    backColor=HexColor("#ece8e1"),
    borderPadding=(5, 6, 5, 6),
    leftIndent=6,
    rightIndent=6,
    spaceBefore=4,
    spaceAfter=4,
)


def bullets(items):
    return [P("•  " + item, "bullet") for item in items]


# ---------------------------------------------------------------------------
# Utilidades de dibujo
# ---------------------------------------------------------------------------


class Figure(Flowable):
    def __init__(self, draw, height):
        super().__init__()
        self.draw_fn = draw
        self.width, self.height = CONTENT_W, height

    def draw(self):
        c = self.canv
        rrect(c, 0, 0, self.width, self.height, 10, BEIGE, LINE, 0.6)
        self.draw_fn(c, self.width, self.height)


def chip(c, x, y, w, h, label, fill=CHIP, fg=INK, size=6.8, stroke=LINE):
    rrect(c, x, y, w, h, h / 2, fill, stroke, 0.5)
    txt(c, label, x + w / 2, y + h * 0.3, size, True, fg, "center")


def thumb(c, x, y, w, h, rects, color=HexColor("#e7e2da"), bg=TRUE_BLACK):
    """Miniatura con huecos en fracciones (x, y, ancho, alto) medidas desde arriba."""
    c.setFillColor(bg)
    c.rect(x, y, w, h, fill=1, stroke=0)
    if bg == white:
        c.setStrokeColor(LINE)
        c.setLineWidth(0.5)
        c.rect(x, y, w, h, fill=0, stroke=1)
    pad = 2.2
    for fx, fy, fw, fh in rects:
        rx = x + pad + fx * (w - pad * 2)
        rw = fw * (w - pad * 2)
        ry = y + h - pad - (fy + fh) * (h - pad * 2)
        rh = fh * (h - pad * 2)
        gap = 1.1
        c.setFillColor(color)
        c.rect(rx + gap / 2, ry + gap / 2, rw - gap, rh - gap, fill=1, stroke=0)


BANDS = [(0, 0, 1, 1 / 3), (0, 1 / 3, 1, 1 / 3), (0, 2 / 3, 1, 1 / 3)]


def arrow(c, x1, y, x2):
    c.setStrokeColor(BLUE)
    c.setFillColor(BLUE)
    c.setLineWidth(1.1)
    c.line(x1, y, x2 - 4, y)
    p = c.beginPath()
    p.moveTo(x2 - 4, y + 3.4)
    p.lineTo(x2, y)
    p.lineTo(x2 - 4, y - 3.4)
    c.drawPath(p, fill=1, stroke=0)


def flow_box(c, x, y, w, h, title, sub, accent=None):
    rrect(c, x, y, w, h, 7, PAPER, accent or LINE, 1.0 if accent else 0.6)
    txt(c, title, x + w / 2, y + h - 15, 7.8, True, INK, "center")
    txt(c, sub, x + w / 2, y + 9, 6.5, False, MUTED, "center")


# ---------------------------------------------------------------------------
# Pantallas del móvil (fase 1 y fase 5)
# ---------------------------------------------------------------------------


def sliders_icon(s, cx, cy, size, color=INK):
    c = s.c
    c.saveState()
    c.setStrokeColor(color)
    c.setFillColor(color)
    c.setLineWidth(max(0.35, 1.6 * s.k))
    half = size / 2
    for i, knob in enumerate((-0.35, 0.4, -0.05)):
        yy = cy + (i - 1) * size * 0.34
        c.line(s.X(cx - half), s.Y(yy), s.X(cx + half), s.Y(yy))
        c.setFillColor(PAPER)
        c.circle(s.X(cx + knob * size), s.Y(yy), size * 0.14 * s.k, fill=1, stroke=1)
    c.restoreState()


def round_canvas(s, canvas, radius):
    """Pinta las esquinas del color de fondo para simular el marco redondeado."""
    cx, cy, cw, ch = canvas
    c = s.c
    kappa = 0.5523
    r = radius * s.k
    corners = [
        (s.X(cx), s.Y(cy), 1, -1),
        (s.X(cx + cw), s.Y(cy), -1, -1),
        (s.X(cx), s.Y(cy + ch), 1, 1),
        (s.X(cx + cw), s.Y(cy + ch), -1, 1),
    ]
    c.setFillColor(BEIGE)
    for px, py, dx, dy in corners:
        p = c.beginPath()
        p.moveTo(px, py)
        p.lineTo(px + dx * r, py)
        p.curveTo(px + dx * r - dx * kappa * r, py, px, py + dy * r - dy * kappa * r, px, py + dy * r)
        p.close()
        c.drawPath(p, fill=1, stroke=0)


def p1_before(s):
    new_main(s)
    c = s.c
    c.saveState()
    c.setStrokeColor(WARN)
    c.setLineWidth(1.0)
    c.circle(s.X(s.W - 16 - 18 - 46), s.Y(25), 24 * s.k, fill=0, stroke=1)
    c.circle(s.X(s.W - 16 - 18), s.Y(25), 24 * s.k, fill=0, stroke=1)
    c.restoreState()
    warn_note(s, 56, "Marco recto · dos botones sueltos")


def p1_after(s):
    info = new_main(s)
    W = s.W
    s.box(W - 120, 2, 110, 46, 0, BEIGE)
    s.box(W - 16 - 38, 6, 38, 38, 19, PAPER, LINE, 0.5)
    sliders_icon(s, W - 16 - 19, 25, 20)
    round_canvas(s, info["canvas"], 26)
    mx, my, mw = W - 16 - 232, 52, 232
    s.box(mx + 2, my + 3, mw, 206, 14, Color(0, 0, 0, alpha=0.12))
    s.box(mx, my, mw, 206, 14, PAPER, LINE, 0.5)
    s.t("Apariencia", mx + 16, my + 28, 12, True, MUTED)
    segw = (mw - 32) / 3
    s.box(mx + 16, my + 38, mw - 32, 34, 17, SOFT)
    for i, lab in enumerate(("Claro", "Oscuro", "Auto")):
        on = lab == "Auto"
        if on:
            s.box(mx + 18 + i * segw, my + 40, segw - 4, 30, 15, INK)
        s.t(lab, mx + 16 + i * segw + segw / 2, my + 60, 12.5, True, white if on else INK, "center")
    rows = (("Guía rápida", INK), ("Nuevo collage…", WARN), ("Acerca de · v1.1.0", MUTED))
    for i, (lab, col) in enumerate(rows):
        yy = my + 86 + i * 40
        s.box(mx + 14, yy, mw - 28, 1, 0, LINE)
        s.t(lab, mx + 16, yy + 26, 14, True, col)


def low_res_chip(s, rect):
    rx, ry, rw, rh = rect
    s.pill(rx + rw - 118, ry + rh - 34, 108, 22, "Baja resolución", Color(0.72, 0.36, 0.29, alpha=0.92), white, 10.5)


def p5_before(s):
    info = new_main(s)
    low_res_chip(s, info["rects"][0])


def p5_after(s):
    new_main(s)
    W, V = s.W, s.H
    s.dim()
    y0 = V - 372
    s.box(0, y0, W, 410, 24, PAPER, LINE, 0.5)
    s.box(W / 2 - 22, y0 + 10, 44, 5, 2.5, LINE)
    s.t("Revisión antes de guardar", 20, y0 + 44, 17, True)
    rows = [
        ("ok", "Vídeo HDR convertido a SDR", "El color se parece al original"),
        ("warn", "Foto 1 muy ampliada", "Nitidez al 54 %: reduce el zoom"),
        ("ok", "Espacio libre suficiente", "El archivo ocupará ≈ 19 MB"),
    ]
    for i, (kind, title, sub) in enumerate(rows):
        yy = y0 + 64 + i * 58
        good = kind == "ok"
        s.box(20, yy, W - 40, 50, 14, GOOD if good else HexColor("#efe4e0"), None)
        s.c.saveState()
        s.c.setFillColor(OK_GREEN if good else WARN)
        s.c.circle(s.X(44), s.Y(yy + 25), 12 * s.k, fill=1, stroke=0)
        s.c.restoreState()
        if good:
            s.glyph("check", 44, yy + 25, 13, white)
        else:
            s.t("!", 44, yy + 31, 17, True, white, "center")
        s.t(title, 66, yy + 22, 13.5, True, INK)
        s.t(sub, 66, yy + 40, 11.5, False, MUTED)
    by = y0 + 64 + 3 * 58 + 6
    s.box(20, by, W - 40, 48, 24, INK)
    s.t("Guardar de todos modos", W / 2, by + 30, 14.5, True, white, "center")
    s.pill(20, by + 58, W - 40, 40, "Reducir zoom", CHIP, INK, 13, LINE)


# ---------------------------------------------------------------------------
# Figuras de página completa
# ---------------------------------------------------------------------------


def fig_cover(c, w, h):
    steps = [
        ("1", "Identidad", "Cuidada a la vista"),
        ("2", "Creatividad", "Lo justo, bien hecho"),
        ("3", "Color fiel", "Colores como grabó"),
        ("4", "Audio", "Suena y fluye bien"),
        ("5", "Asistente", "Te avisa antes"),
    ]
    gap = 16
    bw = (w - 28 - gap * 4) / 5
    for i, (n, name, tag) in enumerate(steps):
        x = 14 + i * (bw + gap)
        rrect(c, x, 30, bw, 70, 8, PAPER, LINE, 0.6)
        c.setFillColor(INK)
        c.circle(x + 15, 84, 8, fill=1, stroke=0)
        txt(c, n, x + 15, 81.2, 8.5, True, white, "center")
        txt(c, name, x + 28, 81.6, 8.2, True, INK)
        txt(c, tag, x + 9, 54, 6.8, False, MUTED)
        if i < 4:
            arrow(c, x + bw + 2, 65, x + bw + gap - 1)
    txt(c, "Pilares:  se ve cuidada  ·  el resultado es fiel  ·  la app cuida los detalles por ti", w / 2, 12, 7.6, True, MUTED, "center")


def fig_motion(c, w, h):
    top = h - 14
    txt(c, "Tamaño del lienzo al abrir un panel", 14, top - 8, 8.8, True, INK)
    ox, oy, aw, ah = 34, 34, 190, 92
    c.setStrokeColor(LINE)
    c.setLineWidth(0.6)
    c.line(ox, oy, ox + aw, oy)
    c.line(ox, oy, ox, oy + ah)
    for t, lab in ((0, "0"), (0.5, "150"), (1, "300 ms")):
        txt(c, lab, ox + t * aw, oy - 10, 6.4, False, MUTED, "center")
    c.setStrokeColor(WARN)
    c.setLineWidth(1.6)
    jump = ox + aw * 0.1
    p = c.beginPath()
    p.moveTo(ox, oy)
    p.lineTo(jump, oy)
    p.lineTo(jump, oy + ah * 0.85)
    p.lineTo(ox + aw, oy + ah * 0.85)
    c.drawPath(p, fill=0, stroke=1)
    c.setStrokeColor(INK)
    q = c.beginPath()
    for i in range(61):
        t = i / 60.0
        y = 1 - math.exp(-6.2 * t) * math.cos(9 * t)
        px, py = ox + t * aw, oy + ah * 0.85 * y
        if i == 0:
            q.moveTo(px, py)
        else:
            q.lineTo(px, py)
    c.drawPath(q, fill=0, stroke=1)
    txt(c, "Hoy: salto", ox + aw * 0.14, oy + ah * 0.55, 7.2, True, WARN)
    txt(c, "Propuesta: muelle suave", ox + aw * 0.42, oy + ah * 0.36, 7.2, True, INK)

    fx = ox + aw + 36
    txt(c, "Cuatro instantes de la propuesta", fx, top - 8, 8.8, True, INK)
    frames = [(1.0, 0.0, "0 ms"), (0.9, 0.35, "70 ms"), (0.82, 0.72, "140 ms"), (0.78, 0.9, "220 ms")]
    fw_, fh_ = 52, 100
    step = (w - fx - 14 - fw_) / 3
    for i, (scale, panel, label) in enumerate(frames):
        x = fx + i * step
        y = 32
        rrect(c, x, y, fw_, fh_, 8, TRUE_BLACK, LINE, 0.8)
        rrect(c, x + 2.4, y + 2.4, fw_ - 4.8, fh_ - 4.8, 6, BEIGE)
        cw_, ch_ = 28 * scale, 50 * scale
        rrect(c, x + (fw_ - cw_) / 2, y + fh_ - 12 - ch_ - (1 - scale) * 6, cw_, ch_, 4 * scale, TRUE_BLACK)
        ph = 8 + 26 * panel
        rrect(c, x + 5, y + 5, fw_ - 10, ph, 4, PAPER, LINE, 0.5)
        txt(c, label, x + fw_ / 2, y - 9, 6.6, False, MUTED, "center")
    txt(c, "El lienzo no cambia de tamaño real: se escala con una transformación nativa.", 14, 14, 6.8, False, MUTED)


def fig_creative(c, w, h):
    top = h - 14
    txt(c, "Fondo", 14, top - 8, 8.8, True, INK)
    for i, (name, bg) in enumerate((("Negro", TRUE_BLACK), ("Blanco", white))):
        x = 14 + i * 64
        thumb(c, x, top - 112, 48, 85, BANDS, HexColor("#cfe0f3") if bg == white else HexColor("#e7e2da"), bg)
        txt(c, name, x + 24, top - 124, 6.8, True, INK, "center")

    fx = 160
    txt(c, "Formato", fx, top - 8, 8.8, True, INK)
    formats = [("9:16", "historias", 40, 71), ("4:5", "feed", 52, 65), ("1:1", "cuadrado", 62, 62)]
    for i, (name, sub, fw_, fh_) in enumerate(formats):
        x = fx + i * 78
        y = top - 27 - fh_
        thumb(c, x, y, fw_, fh_, BANDS, HexColor("#e7e2da"))
        txt(c, name, x + fw_ / 2, top - 124, 6.8, True, INK, "center")
        txt(c, sub, x + fw_ / 2, top - 133, 6.2, False, MUTED, "center")

    sx = 410
    txt(c, "Hoy no cambia", sx, top - 8, 8.8, True, INK)
    for i, line in enumerate(("Los 3 diseños", "Márgenes de 24 px", "Sin texto")):
        txt(c, line, sx, top - 26 - i * 12, 7.2, False, MUTED)
    txt(c, "(descartados)", sx, top - 66, 6.8, True, WARN)

    vy = 26
    txt(c, "Recorte fácil de vídeo", 14, vy + 56, 8.8, True, INK)
    txt(c, "Desliza una ventana de 10 s (la duración de la historia) sobre el clip de 25 s", w - 14, vy + 56, 7, True, INK, "right")
    tx0, tx1 = 14, w - 14
    n = 10
    tw = (tx1 - tx0) / n
    palette = [HexColor("#b7c4d6"), HexColor("#c8d3c0"), HexColor("#e2c9b5"), HexColor("#d7cfc3")]
    for i in range(n):
        scene(c, tx0 + i * tw, vy + 8, tw - 1, 34, palette[i % 4])
    a = tx0 + (tx1 - tx0) * 12 / 25
    b = tx0 + (tx1 - tx0) * 22 / 25
    c.setFillColor(Color(0.08, 0.1, 0.1, alpha=0.55))
    c.rect(tx0, vy + 8, a - tx0, 34, fill=1, stroke=0)
    c.rect(b, vy + 8, tx1 - b, 34, fill=1, stroke=0)
    c.setStrokeColor(white)
    c.setLineWidth(1.8)
    c.rect(a, vy + 8, b - a, 34, fill=0, stroke=1)
    for sec in (0, 12, 22, 25):
        xx = tx0 + (tx1 - tx0) * sec / 25
        txt(c, f"0:{sec:02d}", xx, vy - 4, 6.4, False, MUTED, "center")


def fig_color(c, w, h):
    top = h - 14
    txt(c, "Vídeo: de HDR a un MP4 con el color de siempre", 14, top - 8, 8.8, True, INK)
    steps = [
        ("Clip HDR", "HEVC 10 bits · HLG", WARN),
        ("Tone mapping", "HLG → SDR", BLUE),
        ("SDR 8 bits", "bt709 · yuv420p", None),
        ("MP4 etiquetado", "bt709 · rango tv", INK),
    ]
    gap = 22
    bw = (w - 28 - gap * 3) / 4
    for i, (title, sub, accent) in enumerate(steps):
        x = 14 + i * (bw + gap)
        flow_box(c, x, top - 62, bw, 40, title, sub, accent)
        if i < 3:
            arrow(c, x + bw + 3, top - 42, x + bw + gap - 2)

    mid = top - 100
    txt(c, "Ilustración del efecto", 14, mid + 14, 8, True, INK)
    for i, (name, base, good) in enumerate((("Hoy: plano y blanquecino", HexColor("#b4b9bd"), False), ("Propuesta: contraste y color", HexColor("#5f93d1"), True))):
        x = 14 + i * 118
        scene(c, x, mid - 56, 108, 62, base)
        txt(c, name, x + 54, mid - 68, 6.8, good, INK if good else WARN, "center")

    px = 262
    txt(c, "Solo fotos: una foto, no un vídeo", px, mid + 14, 8, True, INK)
    items = [("Fotos", "sin vídeos"), ("Mismo lienzo", "2160 × 3840"), ("JPG", "calidad máxima")]
    bw2 = (w - px - 14 - 2 * 18) / 3
    for i, (title, sub) in enumerate(items):
        x = px + i * (bw2 + 18)
        flow_box(c, x, mid - 52, bw2, 40, title, sub, INK if i == 2 else None)
        if i < 2:
            arrow(c, x + bw2 + 2, mid - 32, x + bw2 + 16)
    txt(c, "En la hoja de exportación desaparecen la duración y la calidad de vídeo.", px, mid - 68, 6.6, False, MUTED)

    bx = 14
    by = 14
    chips = ["Detectar HDR al cargar", "Etiquetar el color de salida", "Comprobar que FFmpeg trae zscale", "Probar con clips de referencia"]
    cw = (w - 28 - 3 * 8) / 4
    for i, label in enumerate(chips):
        chip(c, bx + i * (cw + 8), by, cw, 16, label, PAPER, INK, 6.2)


def waveform(c, x, y, w, h, n, gain, fade=0, seed=0.0, color=INK):
    bw = w / n
    c.setFillColor(color)
    for i in range(n):
        amp = abs(math.sin(i * 0.71 + seed) * 0.6 + math.sin(i * 1.93 + seed) * 0.4)
        env = 1.0
        if fade:
            env = min(1.0, i / fade, (n - 1 - i) / fade)
        bar = max(1.2, amp * gain * env * h)
        c.rect(x + i * bw + 0.4, y + (h - bar) / 2, bw - 0.9, bar, fill=1, stroke=0)


def fig_audio(c, w, h):
    top = h - 14
    txt(c, "Audio de dos clips mezclados (10 s)", 14, top - 8, 8.8, True, INK)
    ww, wh = 226, 34
    txt(c, "Hoy", 14, top - 36, 7.4, True, WARN)
    waveform(c, 46, top - 52, ww, wh, 64, 0.5, 0, 0.0, HexColor("#c9958b"))
    c.setStrokeColor(WARN)
    c.setLineWidth(1.2)
    c.line(46 + ww, top - 56, 46 + ww, top - 14)
    txt(c, "corte seco", 46 + ww - 2, top - 64, 6.4, True, WARN, "right")
    txt(c, "volumen bajo", 50, top - 64, 6.4, False, MUTED)
    txt(c, "Propuesta", 14, top - 92, 7.4, True, INK)
    waveform(c, 46, top - 108, ww, wh, 64, 0.88, 6, 0.0, INK)
    txt(c, "fundido de 0,4 s", 50, top - 120, 6.4, True, INK)
    txt(c, "nivel parejo", 46 + ww - 2, top - 120, 6.4, False, MUTED, "right")

    fx = 46 + ww + 30
    fw_ = w - fx - 14
    txt(c, "Fluidez en 0,3 s de vídeo", fx, top - 8, 8.8, True, INK)
    for row, (label, count, color) in enumerate((("Hoy · 30 fps", 9, WARN), ("Cámara y opción «Fluido» · 60 fps", 18, INK))):
        yy = top - 46 - row * 46
        txt(c, label, fx, yy + 22, 7, True, color)
        c.setStrokeColor(LINE)
        c.setLineWidth(0.6)
        c.line(fx, yy + 6, fx + fw_, yy + 6)
        for i in range(count + 1):
            xx = fx + fw_ * i / count
            c.setStrokeColor(color)
            c.setLineWidth(1.2)
            c.line(xx, yy + 1, xx, yy + 11)

    ly = 34
    txt(c, "Bucle de un clip corto dentro de la historia", 14, ly + 52, 8.8, True, INK)
    bar_w = w - 28
    seg = bar_w / 3
    for row, (label, soft) in enumerate((("Hoy", False), ("Propuesta", True))):
        yy = ly + 26 - row * 26
        txt(c, label, 14, yy + 6, 7, True, WARN if not soft else INK)
        for i in range(3):
            x = 60 + i * (bar_w - 46) / 3
            sw = (bar_w - 46) / 3 - 1
            rrect(c, x, yy, sw, 16, 3, HexColor("#b7c4d6"), LINE, 0.4)
            if i > 0:
                if soft:
                    c.setFillColor(Color(1, 1, 1, alpha=0.6))
                    c.rect(x - 8, yy, 16, 16, fill=1, stroke=0)
                else:
                    c.setStrokeColor(WARN)
                    c.setLineWidth(1.2)
                    c.line(x - 0.5, yy - 3, x - 0.5, yy + 19)
    txt(c, "salto", 60 + (bar_w - 46) / 3 + 4, ly + 32, 6.2, True, WARN)
    txt(c, "fundido cruzado", 60 + (bar_w - 46) / 3 + 4, ly + 6, 6.2, True, INK)


# ---------------------------------------------------------------------------
# Contenido
# ---------------------------------------------------------------------------

PHASES = [
    {
        "n": 1,
        "title": "Identidad y detalle: que se vea y se sienta cuidada",
        "figure": Wire(
            p1_before,
            p1_after,
            "Lo que más llama la atención",
            [
                ("Marco redondeado", "Solo en pantalla; el archivo sale rectangular."),
                ("Un solo botón Ajustes", "Apariencia, guía y nuevo collage juntos."),
                ("Modo oscuro", "Automático o a mano, desde Ajustes."),
                ("Cierre sin desvío", "Guarda y confirma, sin «Ver en galería»."),
            ],
            labels=("HOY", "PROPUESTA"),
            goods=(False, True),
            height=310,
        ),
        "figure2": Figure(fig_motion, 168),
        "today": [
            "El recuadro negro de las fotos tiene esquinas rectas, mientras que tarjetas, botones, hojas y chips son redondeados. En la pantalla principal es lo que más desentona.",
            "Arriba hay dos botones sueltos («?» y «···») que reparten funciones sin orden claro, y no existe un sitio para cambiar de claro a oscuro. <b>app.json</b> fija <b>userInterfaceStyle: light</b>.",
            "Al abrir «Duración» o «Diseño», el lienzo se encoge de golpe (se recalcula su tamaño) y los controles se recolocan bruscamente. No hay una transición continua.",
            "Tras guardar, «Ver en galería» abre una pantalla genérica del sistema que no enseña dónde quedó el archivo.",
            "Fuente del sistema, paleta beige y tinta sin color de marca, splash blanco con el icono por defecto.",
        ],
        "changes": [
            "<b>Lienzo con esquinas redondeadas</b> en pantalla (unos 20 dp). El archivo exportado sigue siendo rectangular y completo. Con bordes, la esquina de las fotos exteriores se recorta unos píxeles solo en pantalla.",
            "<b>Un único botón «Ajustes»</b> (icono de deslizadores) que reúne: Apariencia (Claro, Oscuro o Automático), Guía rápida, Nuevo collage… y Acerca de. Sustituye a «?» y «···».",
            "<b>Modo oscuro</b> automático por defecto, con elección manual desde Ajustes. La preferencia se recuerda.",
            "<b>Movimiento natural</b>: el lienzo no cambia de tamaño real, se escala con una transformación nativa y un muelle; el panel sube desde abajo mientras la barra se desvanece. 220 a 280 ms, sin saltos.",
            "<b>Cierre limpio</b>: se quita «Ver en galería». Al terminar, un aviso confirma «Guardada en tu galería» y ofrece «Seguir editando» y «Empezar otra historia».",
            "<b>Tokens de diseño</b>, tipografía propia, color de marca, icono y splash de marca.",
        ],
        "example": "Redondear el marco es una línea. Y para el movimiento, en lugar de recalcular el tamaño del lienzo en cada fotograma, se anima una transformación (la gestiona la GPU) con un muelle:",
        "code": (
            "canvasFrame: { borderRadius: 20, overflow: 'hidden', backgroundColor: '#000' }\n"
            "\n"
            "Animated.spring(open, { toValue: 1, damping: 20, stiffness: 180, mass: 1,\n"
            "                        useNativeDriver: true }).start();\n"
            "const scale = open.interpolate({ inputRange: [0, 1], outputRange: [1, freeH / fullH] });\n"
            "<Animated.View style={{ transform: [{ translateY: lift }, { scale }] }}>"
        ),
        "effort": "Medio. Riesgo bajo: casi todo es presentación y no toca la exportación.",
        "success": "Ninguna esquina recta desentona, abrir un panel se percibe como un solo movimiento continuo y todos los ajustes de apariencia están en un solo botón.",
    },
    {
        "n": 2,
        "title": "Creatividad: solo lo que merece la pena",
        "figure": Figure(fig_creative, 250),
        "today": [
            "El fondo es siempre negro (márgenes, huecos vacíos y salida) y el formato es solo 9:16.",
            "Un vídeo largo se usa siempre desde el segundo 0: no se puede elegir el trozo.",
        ],
        "changes": [
            "<b>Fondo blanco o negro</b>: un interruptor en el panel Diseño, junto a Bordes. Afecta a los márgenes, a los huecos vacíos y al archivo exportado.",
            "<b>Más formatos</b>: 9:16 para historias, 4:5 para el feed y 1:1 cuadrado. Las medidas pasan de 1080 × 1920 fijos a un formato elegible.",
            "<b>Recorte fácil de vídeo</b>: como la historia dura un tiempo fijo, basta con deslizar una ventana de esa duración sobre la tira del clip. Sin dos asas ni minutos que calcular. Aparece dentro del editor de encuadre.",
            "<b>Decidido que no entra</b>: más diseños, texto y márgenes ajustables.",
        ],
        "example": "Con el formato 4:5 (1080 × 1350) y bordes de 24 px, las tres bandas salen de la misma fórmula que ya usa <b>getSlotBoundsMap</b>: ancho útil 1032, alto útil 1302 y (1302 − 48) / 3 = 418 de alto por hueco:",
        "code": (
            "FORMATS = { story: [1080, 1920], feed: [1080, 1350], square: [1080, 1080] }\n"
            "slot-1: x=24  y=24   w=1032 h=418\n"
            "slot-2: x=24  y=466  w=1032 h=418      (24 + 418 + 24 de separación)\n"
            "slot-3: x=24  y=908  w=1032 h=418      (termina en 1326 = 1350 - 24)"
        ),
        "example2": "El fondo blanco y el recorte son una línea más en el comando de FFmpeg. Un clip de 25 s en una historia de 10 s, usando del segundo 12 al 22:",
        "code2": (
            "color=c=white:s=1080x1350:d=10:r=30,format=yuv420p[base0]\n"
            "-ss 12 -t 10 -noautorotate -stream_loop -1 -i clip.mp4"
        ),
        "effort": "Medio. Riesgo medio: los formatos tocan la geometría en varios sitios (lienzo, miniaturas, preview y exportación) y hay que revisarlos a la vez.",
        "success": "El mismo collage sale bien en los tres formatos y con ambos fondos, y el preview sigue coincidiendo con el archivo.",
    },
    {
        "n": 3,
        "title": "Color fiel: que el vídeo salga como se grabó",
        "figure": Figure(fig_color, 232),
        "today": [
            "En tu log, el clip es <b>HEVC de 10 bits, bt2020 y transferencia arib-std-b67</b>: vídeo HDR HLG, que es como graba el S25.",
            "La exportación lo pasa a 8 bits <b>sin convertir el color</b> y sin etiquetar la salida. Los reproductores lo tratan como SDR normal (bt709) y la imagen sale plana, blanquecina y con los tonos apagados. Es justo lo que describes.",
            "Un collage solo de fotos termina como <b>MP4 de 10 s</b> con imagen fija. El respaldo en imagen existe, pero sale de un lienzo pequeño (220 dp) y pierde nitidez.",
        ],
        "changes": [
            "<b>Detectar HDR al cargar</b> con ffprobe (<b>color_transfer</b> arib-std-b67 o smpte2084, 10 bits). Es la misma sonda que ya lee la rotación.",
            "<b>Convertir solo los clips HDR a SDR</b> con tone mapping antes de escalar y componer. Los clips SDR no se tocan.",
            "<b>Comprobar que el binario de FFmpeg trae zscale y tonemap</b>, como ya se hace con libx264. Si no los trae, hay que cambiar a una variante de FFmpegKit que incluya la librería zimg (implica recompilar).",
            "<b>Etiquetar la salida</b> (bt709, rango tv) para que todos los reproductores muestren lo mismo.",
            "<b>Fotos solas = foto</b>: JPG de calidad máxima a 2160 × 3840 con la misma geometría. La hoja dice «Foto · 2160 × 3840 · JPG» y oculta duración y calidad de vídeo. Con vídeos, todo sigue igual.",
        ],
        "example": "La cadena de tone mapping, solo para clips HDR, y las etiquetas de salida para todos:",
        "code": (
            "[0:v]zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,\n"
            "  tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p,...\n"
            "-colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv"
        ),
        "example2": "Y para fotos solas, el mismo grafo con un único fotograma y al doble de tamaño (bordes y huecos también ×2):",
        "code2": "-frames:v 1 -q:v 2 collage.jpg        (lienzo 2160 × 3840, bordes de 48 px)",
        "effort": "Medio a alto. Riesgo medio: depende de que el binario traiga zscale, y el tone mapping es una curva a juzgar a ojo (hable, mobius o reinhard).",
        "success": "Un clip HDR del S25 exportado se ve en la galería con el mismo contraste y color que el original, y un collage de fotos termina como JPG de 2160 × 3840 sin mencionar vídeo.",
    },
    {
        "n": 4,
        "title": "Audio y fluidez al nivel de la imagen",
        "figure": Figure(fig_audio, 240),
        "today": [
            "El audio de varios clips se mezcla con <b>amix</b> a volumen fijo: la mezcla suena más baja que los originales y termina en seco al llegar a la duración.",
            "El S25 graba a 60 fps (tu log: 59,88), pero la exportación fuerza <b>30 fps</b> y pierde la suavidad de la cámara.",
            "Un clip más corto que la historia se repite con un salto visible al reiniciar.",
        ],
        "changes": [
            "<b>Nivel de audio parejo</b>: normalizar la mezcla para que no suene más baja que el original ni sature.",
            "<b>Fundidos de 0,4 s</b> al principio y al final, en audio y en imagen, para entrar y salir sin cortes.",
            "<b>Opción de fluidez</b> en la hoja de exportación: Estándar (30 fps) o Fluido (60 fps), que conserva la suavidad de la cámara. Pesa más y tarda más, pero aquí la rapidez no es la prioridad.",
            "<b>Velocidad constante</b>: clips de velocidad variable o cámara lenta se convierten a fotogramas regulares al entrar, para evitar tirones.",
            "<b>Bucle limpio</b>: cuando un clip se repite, el final se mezcla con el principio (fundido cruzado de 0,3 s) en lugar de saltar.",
        ],
        "example": "Con una historia de 10 s, el fundido final empieza en 9,6 s. La mezcla se normaliza y se suaviza al final, y la opción Fluido es solo cambiar la velocidad de fotogramas:",
        "code": (
            "[a0][a1]amix=inputs=2:duration=longest:dropout_transition=0,\n"
            "  loudnorm=I=-16:TP=-1.5:LRA=11,afade=t=in:d=0.4,afade=t=out:st=9.6:d=0.4[aout]\n"
            "-r 60          (opción «Fluido»; «Estándar» sigue en -r 30)"
        ),
        "effort": "Medio. Riesgo bajo a medio: el nivel de audio se afina de oído, y 60 fps duplica trabajo y tamaño del archivo.",
        "success": "Dos clips con sonido se oyen al volumen de los originales, sin cortes secos al empezar ni al terminar, y un clip de 60 fps se ve igual de fluido en el collage.",
    },
    {
        "n": 5,
        "title": "Un asistente que cuida la calidad por ti",
        "figure": Wire(
            p5_before,
            p5_after,
            "Avisar antes de que salga mal",
            [
                ("Medidor de nitidez", "Pastilla «Baja resolución» sobre el hueco."),
                ("Revisión al guardar", "Tres comprobaciones, en palabras claras."),
                ("Arreglo en un toque", "«Reducir zoom» lleva al máximo nítido."),
                ("Resumen final", "Resolución, códec y sonido tras guardar."),
            ],
            labels=("EN EL HUECO", "AL EXPORTAR"),
            goods=(False, True),
            height=310,
        ),
        "today": [
            "La app deja hacer cosas que empeoran el resultado sin avisar: ampliar mucho una foto pequeña, un vídeo HDR sin convertir o quedarse sin espacio a mitad del render.",
            "Coloca cada medio <b>entero dentro del hueco</b> y el zoom lo amplía de 1× a 4×. A partir de cierto zoom la imagen se amplía por encima de sus píxeles reales y sale borrosa, pero nada lo indica.",
            "Al terminar solo dice «Listo»: no cuenta qué se guardó ni con qué calidad.",
        ],
        "changes": [
            "<b>Medidor de nitidez</b> por hueco: compara los píxeles del medio con los que ocupa en la salida. Si baja del 60 %, aparece la pastilla «Baja resolución» y el editor avisa al subir el zoom.",
            "<b>Revisión antes de guardar</b> en la hoja de exportación: vídeo HDR convertido, fotos muy ampliadas y espacio libre suficiente.",
            "<b>Espacio libre</b> comprobado antes de renderizar, con un aviso claro y no un fallo a medias.",
            "<b>Arreglo en un toque</b>: «Reducir zoom» lleva el zoom al máximo que sigue nítido.",
            "<b>Resumen al terminar</b>: «1080 × 1920 · H.264 · 15 Mbps · sonido normalizado». Enseña el cuidado que hay detrás.",
        ],
        "example": "Una foto de 1672 × 941 px en un hueco de banda de 1032 × 608 px. Con zoom 3× se amplía 1,85 veces y la nitidez baja al 54 %, por debajo del 60 %, así que la app avisa:",
        "code": (
            "const fit = Math.min(slotW / mediaW, slotH / mediaH);   // min(0.617, 0.646) = 0.617\n"
            "const shown = fit * zoom;                                 // 0.617 x 3 = 1.85\n"
            "const sharpness = Math.min(1, 1 / shown);                 // 0.54  ->  «Baja resolución»"
        ),
        "effort": "Medio. Riesgo bajo: es información calculada con los mismos datos que ya usa el editor, sin tocar la exportación.",
        "success": "Nadie exporta por sorpresa una foto borrosa, y quien guarda sabe exactamente qué calidad tiene lo que obtiene.",
    },
]


def example_box(phase):
    parts = [P("Ejemplo", "label"), P(phase["example"])]
    if "code" in phase:
        parts.append(Preformatted(phase["code"], STYLES["code"]))
    if "example2" in phase:
        parts.append(P(phase["example2"]))
        parts.append(Preformatted(phase["code2"], STYLES["code"]))
    box = Table([[parts]], colWidths=[CONTENT_W])
    box.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), PAPER),
                ("LINEBEFORE", (0, 0), (0, -1), 2.2, BLUE),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    return box


def closing_table(phase):
    half = (CONTENT_W - 6) / 2
    t = Table(
        [
            [P("Esfuerzo y riesgo", "label"), P("Sabremos que funciona cuando", "label")],
            [P(phase["effort"], "small"), P(phase["success"], "small")],
        ],
        colWidths=[half, half],
    )
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), SOFT),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, 0), 3),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 0),
                ("TOPPADDING", (0, 1), (-1, 1), 1),
                ("BOTTOMPADDING", (0, 1), (-1, 1), 6),
                ("LINEAFTER", (0, 0), (0, -1), 0.6, white),
            ]
        )
    )
    return t


def phase_flow(phase):
    out = [
        P(f"Fase {phase['n']} de 5", "kicker"),
        P(phase["title"], "h1"),
        phase["figure"],
    ]
    if "figure2" in phase:
        out.append(Spacer(1, 4))
        out.append(phase["figure2"])
    out.append(Spacer(1, 3))
    out.append(P("Dónde estamos hoy", "label"))
    out.extend(bullets(phase["today"]))
    out.append(P("Qué cambia", "label"))
    out.extend(bullets(phase["changes"]))
    out.append(Spacer(1, 3))
    out.append(example_box(phase))
    out.append(Spacer(1, 4))
    out.append(closing_table(phase))
    return out


def header_footer(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(MUTED)
    canvas.setFont("Segoe", 8)
    canvas.drawString(LEFT, 12 * mm, "Historys  ·  Camino a una app de calidad superior en 5 fases")
    canvas.drawRightString(PAGE_W - RIGHT, 12 * mm, f"{doc.page}")
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.4)
    canvas.line(LEFT, 16 * mm, PAGE_W - RIGHT, 16 * mm)
    canvas.restoreState()


def build():
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "propuesta-premium-5-fases.pdf")
    doc = BaseDocTemplate(
        out,
        pagesize=A4,
        title="Historys — Camino a una app de calidad superior",
        author="Historys",
        leftMargin=LEFT,
        rightMargin=RIGHT,
        topMargin=18 * mm,
        bottomMargin=20 * mm,
    )
    frame = Frame(LEFT, 20 * mm, CONTENT_W, PAGE_H - 38 * mm, id="main", showBoundary=0)
    doc.addPageTemplates([PageTemplate(id="body", frames=[frame], onPage=header_footer)])

    f = []
    f.append(P("CALIDAD PERCIBIDA · APP PREMIUM", "kicker"))
    f.append(P("Historys: que quien la use piense «esto es calidad superior»", "cover_title"))
    f.append(
        P(
            "Cinco fases para que la app se vea, se oiga y se sienta como un producto de primera, y para que el vídeo y la foto "
            "que salen se parezcan a lo que grabaste. «Premium» aquí no es un precio: es el cuidado en cada detalle. "
            "Cada fase parte de lo que hay hoy en el código y en tu log de exportación, e incluye un ejemplo concreto.",
            "cover_sub",
        )
    )
    f.append(Spacer(1, 5 * mm))
    f.append(Figure(fig_cover, 118))
    f.append(Spacer(1, 4 * mm))
    f.append(P("Qué significa «premium» aquí", "h2"))
    for item in (
        "<b>Se ve cuidada.</b> Formas coherentes, movimiento natural, identidad propia y ni un solo desvío innecesario.",
        "<b>El resultado es fiel.</b> El vídeo conserva el color y la fluidez con que se grabó, y las fotos salen como fotos.",
        "<b>La app cuida los detalles por ti.</b> Avisa antes de que algo salga mal y cuenta qué calidad tiene lo que guarda.",
    ):
        f.extend(bullets([item]))
    f.append(Spacer(1, 3 * mm))
    f.append(P("Diagnóstico: dónde está hoy", "h2"))
    diag = [
        ["Aspecto", "Hoy", "Qué lo haría de calidad superior", "Fase"],
        ["Lienzo", "Recuadro negro de esquinas rectas en una app de formas redondeadas", "Marco redondeado en pantalla; el archivo sigue rectangular", "1"],
        ["Botones superiores", "«?» y «···» sueltos; no hay modo oscuro", "Un solo botón Ajustes con apariencia incluida", "1"],
        ["Movimiento", "El lienzo se encoge de golpe al abrir un panel", "Transformación con muelle y panel que sube suave", "1"],
        ["Final", "«Ver en galería» abre una pantalla del sistema sin pistas", "Guardar y confirmar, sin desvío", "1"],
        ["Fondo y formato", "Solo fondo negro y 9:16; el clip siempre desde el inicio", "Fondo blanco o negro, 4:5 y 1:1, recorte fácil", "2"],
        ["Color de vídeo", "El HDR (HLG) sale plano, blanquecino y apagado", "Tone mapping a SDR y color etiquetado", "3"],
        ["Fotos solas", "Salen como un MP4 de 10 s", "JPG de 2160 × 3840", "3"],
        ["Audio", "Mezcla baja y final cortado en seco", "Nivel parejo y fundidos", "4"],
        ["Fluidez", "La cámara graba a 60 fps y se exporta a 30", "Opción de 60 fps", "4"],
        ["Calidad asistida", "No avisa si una foto se amplía demasiado", "Medidor y revisión antes de guardar", "5"],
    ]
    f.append(table([cells(r, True) for r in diag], [28 * mm, 62 * mm, CONTENT_W - 102 * mm, 12 * mm]))

    f.append(PageBreak())
    f.append(P("RESUMEN", "kicker"))
    f.append(P("Las cinco fases de un vistazo", "h1"))
    roadmap = [
        ["Fase", "Objetivo", "Esfuerzo", "Lo que se nota"],
        ["1 · Identidad", "Marco redondeado, Ajustes, modo oscuro, movimiento y cierre limpio", "Medio", "«Se ve cuidada»"],
        ["2 · Creatividad", "Fondo blanco o negro, 4:5 y 1:1, recorte fácil", "Medio", "«Puedo hacer más, sin complicarme»"],
        ["3 · Color fiel", "HDR a SDR, color etiquetado, fotos solas como JPG", "Medio a alto", "«Sale como lo grabé»"],
        ["4 · Audio", "Nivel parejo, fundidos, 60 fps, bucle limpio", "Medio", "«Suena y fluye bien»"],
        ["5 · Asistente", "Medidor de nitidez, revisión al guardar, resumen final", "Medio", "«La app me cuida»"],
    ]
    f.append(table([cells(r, True) for r in roadmap], [30 * mm, 78 * mm, 22 * mm, CONTENT_W - 130 * mm]))
    f.append(Spacer(1, 4 * mm))
    f.append(P("Orden recomendado", "h2"))
    f.append(
        P(
            "Empezar por la fase <b>3</b>: el color apagado es un fallo real del resultado y lo primero que notará cualquiera que "
            "compare el vídeo con el original. Después la <b>1</b>, que cambia cómo se percibe la app desde el primer minuto. "
            "La <b>2</b>, la <b>4</b> y la <b>5</b> se pueden ir sumando en cualquier orden; la 5 se apoya en la 3 porque "
            "revisa la conversión de color."
        )
    )
    f.append(Spacer(1, 3 * mm))
    f.append(P("Lo que no se toca", "h2"))
    f.extend(
        bullets(
            [
                "El preview, el editor y el archivo siguen usando la misma geometría. Es la promesa central de la app.",
                "Aunque el marco en pantalla sea redondeado, el archivo exportado sigue siendo rectangular y completo.",
                "Exportar sigue a un toque de distancia.",
            ]
        )
    )
    f.append(Spacer(1, 3 * mm))
    f.append(P("Lo que se ha descartado", "h2"))
    f.extend(
        bullets(
            [
                "Más diseños de collage, texto y márgenes ajustables.",
                "Buscar atajos para que la exportación sea más rápida: la prioridad es la calidad del resultado.",
                "Borradores, plantillas, compartir directo, cobro y suscripciones.",
            ]
        )
    )

    for phase in PHASES:
        f.append(PageBreak())
        f.extend(phase_flow(phase))

    f.append(PageBreak())
    f.append(P("DECISIONES", "kicker"))
    f.append(P("Lo que hay que decidir antes de empezar", "h1"))
    f.append(
        P(
            "Estas decisiones cambian el alcance de las fases. La primera y la segunda condicionan la fase 3, que es la que más se nota."
        )
    )
    f.append(Spacer(1, 3 * mm))
    decisions = [
        ["Decisión", "Opciones", "Mi recomendación"],
        ["HDR del vídeo", "Convertir a SDR o conservarlo como HDR (HEVC de 10 bits)", "Convertir a SDR: se mezcla con fotos SDR y es lo más compatible. Dejar el HDR para más adelante"],
        ["Binario de FFmpeg", "Comprobar si trae zscale; si no, cambiar de variante", "Comprobarlo primero. Cambiar de variante obliga a recompilar la app"],
        ["Fotos solas", "JPG, PNG o ambos", "JPG de calidad máxima a 2160 × 3840: nítido y ligero"],
        ["Fluidez", "Solo 30 fps o ofrecer también 60", "Ofrecer 60 fps como opción, desactivada por defecto"],
        ["Apariencia", "Claro, oscuro o automático", "Automático por defecto, con elección manual en Ajustes"],
        ["Marca", "Color de marca, icono y splash", "Elegir una de las tres propuestas de icono antes de la fase 1"],
    ]
    f.append(table([cells(r, True) for r in decisions], [32 * mm, 62 * mm, CONTENT_W - 94 * mm]))
    f.append(Spacer(1, 5 * mm))
    f.append(P("Riesgos a vigilar", "h2"))
    f.extend(
        bullets(
            [
                "<b>El tone mapping es subjetivo.</b> Hay varias curvas (hable, mobius, reinhard) y habrá que elegir la que más se parezca a la galería comparando fotogramas.",
                "<b>El binario de FFmpeg.</b> Si no trae zscale, la fase 3 depende de cambiar el paquete nativo y recompilar.",
                "<b>El HDR en pantallas HDR.</b> En la pantalla del S25 el original se ve aún más brillante; en SDR el objetivo es acercarse lo más posible, no igualarlo.",
                "<b>Esquinas redondeadas y bordes.</b> En pantalla se recortan unos píxeles de las fotos exteriores. Hay que decidir el radio con calma para que no moleste.",
                "<b>60 fps.</b> Duplica el trabajo y el tamaño del archivo; por eso es una opción y no el valor por defecto.",
            ]
        )
    )

    doc.build(f)
    return out


if __name__ == "__main__":
    print(build())
