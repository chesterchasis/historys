"""Genera docs/propuesta-ux-10-fases.pdf: nueva distribución de la pantalla de Historys en 10 fases.

Reutiliza las primitivas de dibujo del Samsung Galaxy S25 de build_plan_pdf.py. Las pantallas se dibujan en dp
(360 dp de ancho) y se escalan al teléfono, así que las proporciones entre zonas son las reales de appStyles.ts.
"""

import os
import sys
from contextlib import contextmanager

from reportlab.lib.colors import Color, HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.utils import simpleSplit
from reportlab.platypus import (
    BaseDocTemplate,
    Flowable,
    Frame,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Spacer,
    Table,
    TableStyle,
)

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from build_plan_pdf import (  # noqa: E402
    BEIGE,
    BLACK,
    BLUE,
    CONTENT_W,
    EMPTY,
    INK,
    LEFT,
    LINE,
    MUTED,
    PAGE_H,
    PAGE_W,
    PAPER,
    PHOTO,
    RIGHT,
    SOFT,
    TRUE_BLACK,
    VIDEO,
    WARN,
    P,
    S,
    STYLES,
    arrow_between,
    play,
    rrect,
    s25_phone,
    tag_state,
    txt,
)

CHIP = HexColor("#f2efea")
GHOST = HexColor("#e9e5df")
GOOD = HexColor("#dde7f2")
WARN_SOFT = HexColor("#efe4e0")
EMPTY_FG = HexColor("#c8c2b8")
DIM = Color(0.10, 0.12, 0.13, alpha=0.48)
BADGE = Color(0.08, 0.10, 0.10, alpha=0.74)

FILL = {
    "photo": PHOTO,
    "photo2": HexColor("#c8d3c0"),
    "photo3": HexColor("#e2c9b5"),
    "video": VIDEO,
}
FULL = ("photo", "video", "photo2")

STYLES["zone"] = S("zone", fontSize=9.4, leading=12.6)
STYLES["problem"] = S("problem", fontSize=9.4, leading=12.8, spaceAfter=4)


def shade(col, f):
    return Color(min(1, col.red * f), min(1, col.green * f), min(1, col.blue * f))


class Scr:
    """Pantalla en dp: x hacia la derecha, y hacia abajo desde el borde superior del área segura."""

    MIN_FONT = 3.4

    def __init__(self, c, ox, oy, k, w_dp, h_dp):
        self.c, self.ox, self.oy, self.k = c, ox, oy, k
        self.W, self.H = w_dp, h_dp

    def X(self, x):
        return self.ox + x * self.k

    def Y(self, y):
        return self.oy - y * self.k

    def box(self, x, y, w, h, r=0, fill=PAPER, stroke=None, sw=0.5):
        rr = min(r, w / 2, h / 2) * self.k
        rrect(self.c, self.X(x), self.Y(y + h), w * self.k, h * self.k, rr, fill, stroke, sw)

    def t(self, s, x, y, size=12, bold=False, color=INK, align="left"):
        txt(self.c, s, self.X(x), self.Y(y), max(size * self.k, self.MIN_FONT), bold, color, align)

    def pill(self, x, y, w, h, s, fill=INK, fg=white, size=12, stroke=None):
        self.box(x, y, w, h, h / 2, fill, stroke, 0.5)
        fs = max(size * self.k, self.MIN_FONT) / self.k
        self.t(s, x + w / 2, y + h / 2 + fs * 0.34, size, True, fg, "center")

    def dim(self):
        self.c.setFillColor(DIM)
        self.c.rect(self.X(-4), self.Y(self.H + 4), (self.W + 8) * self.k, (self.H + 8) * self.k, fill=1, stroke=0)

    def glyph(self, name, x, y, size, color=INK):
        glyph(self.c, name, self.X(x), self.Y(y), size * self.k, color)


@contextmanager
def screen(c, x, y, w, h, label=None, good=True, dark=False):
    sx, sy, sw, sh, top_y, bot_y = s25_phone(c, x, y, w, h, screen=BLACK if dark else BEIGE, dark_status=dark)
    if label:
        tag_state(c, x + (w - 66) / 2, y + h + 3, label, good)
    k = sw / 360.0
    s = Scr(c, sx, top_y, k, 360.0, (top_y - bot_y) / k)
    c.saveState()
    p = c.beginPath()
    p.rect(sx, bot_y, sw, top_y - bot_y)
    c.clipPath(p, stroke=0, fill=0)
    try:
        yield s
    finally:
        c.restoreState()


# ---------------------------------------------------------------------------
# Glifos vectoriales (Segoe UI no trae ⋯ ✓ ▶)
# ---------------------------------------------------------------------------


def glyph(c, name, cx, cy, u, color):
    c.saveState()
    c.setStrokeColor(color)
    c.setFillColor(color)
    c.setLineWidth(max(0.35, u * 0.11))
    c.setLineCap(1)
    c.setLineJoin(1)
    h = u / 2
    if name == "grid":
        c.roundRect(cx - h, cy - h, u, u, u * 0.12, fill=0, stroke=1)
        c.line(cx - h, cy - h + u * 0.36, cx + h, cy - h + u * 0.36)
        c.line(cx, cy - h + u * 0.36, cx, cy + h)
    elif name == "clock":
        c.circle(cx, cy, h, fill=0, stroke=1)
        c.line(cx, cy, cx, cy + h * 0.62)
        c.line(cx, cy, cx + h * 0.46, cy - h * 0.2)
    elif name == "plus":
        c.circle(cx, cy, h, fill=0, stroke=1)
        c.line(cx - h * 0.5, cy, cx + h * 0.5, cy)
        c.line(cx, cy - h * 0.5, cx, cy + h * 0.5)
    elif name == "play":
        c.circle(cx, cy, h, fill=0, stroke=1)
        play(c, cx + u * 0.05, cy, u * 0.52, color)
    elif name == "image":
        c.roundRect(cx - h, cy - h * 0.78, u, u * 0.78, u * 0.1, fill=0, stroke=1)
        p = c.beginPath()
        p.moveTo(cx - h * 0.8, cy - h * 0.6)
        p.lineTo(cx - h * 0.2, cy + h * 0.05)
        p.lineTo(cx + h * 0.15, cy - h * 0.3)
        p.lineTo(cx + h * 0.4, cy - h * 0.05)
        p.lineTo(cx + h * 0.8, cy - h * 0.6)
        c.drawPath(p, fill=0, stroke=1)
        c.circle(cx + h * 0.45, cy + h * 0.35, u * 0.07, fill=1, stroke=0)
    elif name == "crop":
        c.line(cx - h * 0.55, cy + h, cx - h * 0.55, cy - h * 0.55)
        c.line(cx - h * 0.55, cy - h * 0.55, cx + h, cy - h * 0.55)
        c.line(cx - h, cy + h * 0.55, cx + h * 0.55, cy + h * 0.55)
        c.line(cx + h * 0.55, cy + h * 0.55, cx + h * 0.55, cy - h)
    elif name in ("sound", "mute"):
        p = c.beginPath()
        p.moveTo(cx - h, cy - h * 0.32)
        p.lineTo(cx - h * 0.45, cy - h * 0.32)
        p.lineTo(cx + h * 0.05, cy - h * 0.8)
        p.lineTo(cx + h * 0.05, cy + h * 0.8)
        p.lineTo(cx - h * 0.45, cy + h * 0.32)
        p.lineTo(cx - h, cy + h * 0.32)
        p.close()
        c.drawPath(p, fill=1, stroke=0)
        if name == "sound":
            c.arc(cx - h * 0.25, cy - h * 0.45, cx + h * 0.55, cy + h * 0.45, -50, 100)
            c.arc(cx - h * 0.35, cy - h * 0.85, cx + h * 0.95, cy + h * 0.85, -50, 100)
        else:
            c.line(cx + h * 0.35, cy - h * 0.35, cx + h * 0.95, cy + h * 0.35)
            c.line(cx + h * 0.35, cy + h * 0.35, cx + h * 0.95, cy - h * 0.35)
    elif name == "trash":
        c.rect(cx - h * 0.6, cy - h, u * 0.6, u * 0.72, fill=0, stroke=1)
        c.line(cx - h * 0.9, cy + h * 0.5, cx + h * 0.9, cy + h * 0.5)
        c.line(cx - h * 0.25, cy + h * 0.5, cx - h * 0.25, cy + h * 0.8)
        c.line(cx - h * 0.25, cy + h * 0.8, cx + h * 0.25, cy + h * 0.8)
        c.line(cx + h * 0.25, cy + h * 0.8, cx + h * 0.25, cy + h * 0.5)
    elif name == "check":
        p = c.beginPath()
        p.moveTo(cx - h * 0.7, cy)
        p.lineTo(cx - h * 0.15, cy - h * 0.55)
        p.lineTo(cx + h * 0.75, cy + h * 0.6)
        c.drawPath(p, fill=0, stroke=1)
    elif name == "share":
        c.line(cx - h * 0.75, cy + h * 0.1, cx - h * 0.75, cy - h)
        c.line(cx - h * 0.75, cy - h, cx + h * 0.75, cy - h)
        c.line(cx + h * 0.75, cy - h, cx + h * 0.75, cy + h * 0.1)
        c.line(cx, cy - h * 0.45, cx, cy + h)
        c.line(cx - h * 0.4, cy + h * 0.6, cx, cy + h)
        c.line(cx + h * 0.4, cy + h * 0.6, cx, cy + h)
    elif name == "dots":
        for dx in (-0.55, 0, 0.55):
            c.circle(cx + dx * h, cy, u * 0.09, fill=1, stroke=0)
    c.restoreState()


# ---------------------------------------------------------------------------
# Lienzo 9:16 con la misma geometría que getSlotBoundsMap
# ---------------------------------------------------------------------------


def slot_bounds(layout, borders):
    W, H = 1080, 1920
    pad = gap = 24 if borders else 0
    iw, ih = W - pad * 2, H - pad * 2
    if layout == "bands":
        h1 = (ih - gap * 2) // 3
        h3 = ih - h1 * 2 - gap * 2
        return [
            (pad, pad, iw, h1),
            (pad, pad + h1 + gap, iw, h1),
            (pad, pad + (h1 + gap) * 2, iw, h3),
        ]
    if layout == "twoone":
        th = int((ih - gap) * 2 / 3)
        bh = ih - th - gap
        lw = (iw - gap) // 2
        rw = iw - lw - gap
        return [(pad, pad, lw, th), (pad + lw + gap, pad, rw, th), (pad, pad + th + gap, iw, bh)]
    th = (ih - gap) // 3
    bh = ih - th - gap
    lw = (iw - gap) // 2
    rw = iw - lw - gap
    return [(pad, pad, iw, th), (pad, pad + th + gap, lw, bh), (pad + lw + gap, pad + th + gap, rw, bh)]


def scene(c, x, y, w, h, base, alpha=1.0):
    c.saveState()
    p = c.beginPath()
    p.rect(x, y, w, h)
    c.clipPath(p, stroke=0, fill=0)
    c.setFillAlpha(alpha)
    c.setFillColor(base)
    c.rect(x, y, w, h, fill=1, stroke=0)
    c.setFillColor(shade(base, 1.12))
    c.circle(x + w * 0.74, y + h * 0.7, min(w, h) * 0.13, fill=1, stroke=0)
    c.setFillColor(shade(base, 0.8))
    q = c.beginPath()
    q.moveTo(x, y)
    q.lineTo(x, y + h * 0.36)
    q.lineTo(x + w * 0.32, y + h * 0.62)
    q.lineTo(x + w * 0.56, y + h * 0.36)
    q.lineTo(x + w * 0.78, y + h * 0.52)
    q.lineTo(x + w, y + h * 0.3)
    q.lineTo(x + w, y)
    q.close()
    c.drawPath(q, fill=1, stroke=0)
    c.restoreState()


def collage(s, x, y, w, h, layout="bands", borders=True, fills=FULL, selected=None, muted=(), empty="plus",
            badges="new", ring=BLUE, hidden=()):
    c = s.c
    s.box(x, y, w, h, 0, TRUE_BLACK)
    fx, fy = w / 1080.0, h / 1920.0
    rects = []
    for i, (bx, by, bw, bh) in enumerate(slot_bounds(layout, borders)):
        rx, ry, rw, rh = x + bx * fx, y + by * fy, bw * fx, bh * fy
        rects.append((rx, ry, rw, rh))
        kind = fills[i] if i < len(fills) else "empty"
        px, py, pw, ph = s.X(rx), s.Y(ry + rh), rw * s.k, rh * s.k
        if i in hidden:
            c.setFillColor(EMPTY)
            c.rect(px, py, pw, ph, fill=1, stroke=0)
            c.saveState()
            c.setStrokeColor(EMPTY_FG)
            c.setLineWidth(0.5)
            c.setDash(1.5, 1.5)
            c.rect(px + 1, py + 1, pw - 2, ph - 2, fill=0, stroke=1)
            c.restoreState()
            continue
        if kind in ("thumb", "thumb_on"):
            c.setFillColor(HexColor("#f4f1eb") if kind == "thumb_on" else HexColor("#e7e2da"))
            c.rect(px, py, pw, ph, fill=1, stroke=0)
        elif kind == "empty":
            c.setFillColor(EMPTY)
            c.rect(px, py, pw, ph, fill=1, stroke=0)
            if empty == "plus":
                r = max(10, min(22, min(rw, rh) * 0.16))
                cy = ry + rh / 2 - (8 if rh > 90 else 0)
                s.glyph("plus", rx + rw / 2, cy, r * 2, EMPTY_FG)
                if rh > 90:
                    s.t("Añadir", rx + rw / 2, cy + r + 16, 12, True, EMPTY_FG, "center")
            elif empty == "text":
                s.t("Toca para cargar", rx + rw / 2, ry + rh / 2 + 4, 12, True, EMPTY_FG, "center")
        else:
            scene(c, px, py, pw, ph, FILL[kind])
            if kind == "video":
                r = min(rw, rh) * 0.14
                c.setFillColor(Color(1, 1, 1, alpha=0.75))
                c.circle(s.X(rx + rw / 2), s.Y(ry + rh / 2), r * s.k, fill=1, stroke=0)
                play(c, s.X(rx + rw / 2) + r * s.k * 0.12, s.Y(ry + rh / 2), r * s.k * 1.05, INK)
                if badges == "new":
                    bx_ = rx + rw - 8 - 50
                    s.box(bx_, ry + 8, 50, 22, 11, BADGE)
                    play(c, s.X(bx_ + 12), s.Y(ry + 19), 9 * s.k, white)
                    s.t("0:12", bx_ + 32, ry + 23.5, 11, True, white, "center")
                    if i in muted:
                        s.box(bx_ - 28, ry + 8, 22, 22, 11, BADGE)
                        s.glyph("mute", bx_ - 17, ry + 19, 12, white)
                elif badges == "old":
                    s.pill(rx + rw - 10 - 52, ry + 10, 52, 22, "VIDEO", BADGE, white, 10)
    if selected is not None:
        rx, ry, rw, rh = rects[selected]
        lw = max(0.8, 3 * s.k)
        c.setStrokeColor(ring)
        c.setLineWidth(lw)
        c.rect(s.X(rx) + lw / 2, s.Y(ry + rh) + lw / 2, rw * s.k - lw, rh * s.k - lw, fill=0, stroke=1)
    return rects


def fit_canvas(s, top, bottom, margin=40):
    ch = bottom - top
    cw = ch * 9 / 16
    if cw > s.W - margin:
        cw = s.W - margin
        ch = cw * 16 / 9
    return (s.W - cw) / 2, top + (bottom - top - ch) / 2, cw, ch


# ---------------------------------------------------------------------------
# Pantalla actual (v1.0.9), medida a partir de appStyles.ts
# ---------------------------------------------------------------------------


def old_layout(selected=None):
    L = {"header": 8, "design": 58, "borders": 277, "slots": 366}
    L["canvas"] = L["slots"] + 37
    bar_h = 16 if selected is None else 112
    slots_h = 37 + 530 + 10 + bar_h + 12
    L["bar"] = L["canvas"] + 530 + 10
    L["duration"] = L["slots"] + slots_h + 12
    L["quality"] = L["duration"] + 62 + 12
    L["actions"] = L["quality"] + 62 + 12
    L["progress"] = L["actions"] + 52 + 12
    L["end"] = L["actions"] + 52 + 16
    return L


def old_ui(s, scroll=0, selected=None, fills=FULL, layout="bands", exporting=False):
    o = -scroll
    L = old_layout(selected)
    s.box(18, o + 10, 34, 34, 8, INK)
    s.t("Historys", 62, o + 36, 26, True, HexColor("#1f2527"))
    s.box(258, o + 8, 38, 38, 19, PAPER, LINE, 0.4)
    s.t("i", 277, o + 33, 17, True, INK, "center")
    s.box(304, o + 8, 38, 38, 19, INK)
    s.t("R", 323, o + 33, 15, True, white, "center")

    y = o + L["design"]
    s.box(18, y, 324, 207, 20, PAPER, LINE, 0.4)
    s.t("Estilo del collage", 30, y + 25, 13, True)
    cw = (300 - 16) / 3
    for i, (lab, mode) in enumerate((("3 bandas", "bands"), ("2+1", "twoone"), ("1+2", "onetwo"))):
        cx, cy = 30 + i * (cw + 8), y + 37
        on = mode == layout
        s.box(cx, cy, cw, 158, 16, INK if on else CHIP, INK if on else LINE, 0.4)
        collage(s, cx + (cw - 64) / 2, cy + 10, 64, 114, mode, True, ("thumb_on" if on else "thumb",) * 3, badges=None)
        s.t(lab, cx + cw / 2, cy + 146, 12, True, white if on else INK, "center")

    y = o + L["borders"]
    s.box(18, y, 324, 77, 20, PAPER, LINE, 0.4)
    s.t("Bordes del collage", 30, y + 25, 13, True)
    s.pill(30, y + 37, 96, 28, "Con bordes", INK, white, 12)
    s.pill(134, y + 37, 92, 28, "Sin bordes", CHIP, INK, 12, LINE)

    y = o + L["slots"]
    bar_h = 16 if selected is None else 112
    s.box(18, y, 324, 37 + 530 + 10 + bar_h + 12, 20, PAPER, LINE, 0.4)
    s.t("Slots multimedia", 30, y + 25, 13, True)
    collage(s, 31, o + L["canvas"], 298, 530, layout, True, fills, selected, empty="text", badges="old", ring=PAPER)
    by = o + L["bar"]
    if selected is None:
        s.t("Toca un hueco para cargarlo o ajustarlo.", 31, by + 12, 12, True, MUTED)
    else:
        s.t(f"Hueco {selected + 1} · Foto", 31, by + 12, 12, True)
        bw = (298 - 8) / 2
        for j, lab in enumerate(("Cargar", "Ajustar", "Quitar")):
            col, row = j % 2, j // 2
            s.pill(31 + col * (bw + 8), by + 24 + row * 48, bw, 40, lab, INK if j == 0 else GHOST,
                   white if j == 0 else INK, 12, None if j == 0 else HexColor("#b5ada3"))

    for key, labels, on in (("duration", ("5s", "10s", "15s", "30s"), "10s"), ("quality", ("Baja", "Media", "Alta"), "Media")):
        y = o + L[key]
        s.box(18, y, 324, 62, 20, PAPER, LINE, 0.4)
        n = len(labels)
        dw = (300 - 8 * (n - 1)) / n
        for i, lab in enumerate(labels):
            sel = lab == on
            s.pill(30 + i * (dw + 8), y + 12, dw, 38, lab, INK if sel else CHIP, white if sel else INK, 13, None if sel else LINE)

    y = o + L["actions"]
    s.box(18, y, 156, 52, 26, HexColor("#f1eeea"), HexColor("#b9b2a8"), 0.5)
    s.t("Preview", 96, y + 31, 14, True, INK, "center")
    s.box(186, y, 156, 52, 26, HexColor("#8f9496") if exporting else INK)
    s.t("Exportando..." if exporting else "Exportar", 264, y + 31, 14, True, white, "center")
    if exporting:
        y = o + L["progress"]
        s.box(18, y, 324, 56, 16, HexColor("#e5e1da"), HexColor("#cac4bb"), 0.5)
        s.t("Renderizando video...", 30, y + 20, 11, True)
        s.t("48%", 330, y + 20, 11, True, INK, "right")
        s.box(30, y + 32, 300, 8, 4, HexColor("#cbc6be"))
        s.box(30, y + 32, 144, 8, 4, INK)
    return L


def warn_note(s, y, text):
    s.box(12, y, s.W - 24, 28, 14, WARN_SOFT, WARN, 0.6)
    s.t(text, s.W / 2, y + 18.5, 13, True, WARN, "center")


def old_editor(s):
    W, V = s.W, s.H
    s.t("Ajustar foto", 14, 30, 17, True, HexColor("#ece9e2"))
    s.t("Arrastra para mover. Pinza o +/- para zoom.", 14, 52, 12, False, HexColor("#b8c0c3"))
    act_y = V - 8 - 42
    zoom_y = act_y - 12 - 42
    cw = W - 28
    ch = cw * 608 / 1032
    cy = 64 + (zoom_y - 12 - 64 - ch) / 2
    s.box(14, cy, cw, ch, 16, HexColor("#060909"), HexColor("#3f494c"), 0.6)
    scene(s.c, s.X(16), s.Y(cy + ch - 2), (cw - 4) * s.k, (ch - 4) * s.k, PHOTO)
    s.box(14, zoom_y, 42, 42, 21, INK)
    s.t("-", 35, zoom_y + 28, 22, True, white, "center")
    s.t("Zoom 140%", W / 2, zoom_y + 26, 12, True, HexColor("#d9d4cc"), "center")
    s.box(W - 56, zoom_y, 42, 42, 21, INK)
    s.t("+", W - 35, zoom_y + 29, 22, True, white, "center")
    bw = (W - 28 - 20) / 3
    for i, lab in enumerate(("Reset", "Cancelar", "Guardar")):
        prim = lab == "Guardar"
        s.pill(14 + i * (bw + 10), act_y, bw, 42, lab, HexColor("#f0ebe3") if prim else HexColor("#2a3133"),
               INK if prim else HexColor("#d7d2ca"), 12, None if prim else HexColor("#556063"))


def old_library_dialog(s):
    s.dim()
    W, V = s.W, s.H
    y = V / 2 - 90
    s.box(24, y, W - 48, 172, 20, PAPER, LINE, 0.5)
    s.t("Acceder a librería", 42, y + 36, 16, True)
    s.t("¿Quieres permitir acceso a la librería", 42, y + 62, 13, False, MUTED)
    s.t("para cargar foto o video?", 42, y + 80, 13, False, MUTED)
    bw = (W - 48 - 36 - 10) / 2
    s.pill(42, y + 110, bw, 40, "Cancelar", GHOST, INK, 12, HexColor("#b5ada3"))
    s.pill(52 + bw, y + 110, bw, 40, "Continuar", INK, white, 12)


# ---------------------------------------------------------------------------
# Pantalla propuesta
# ---------------------------------------------------------------------------

GLOBAL_DOCK = (("grid", "Diseño"), ("clock", "10 s"), ("plus", "Añadir"), ("play", "Vista previa"))


def topbar(s):
    s.box(16, 11, 28, 28, 7, INK)
    for i in range(3):
        s.box(21, 15 + i * 7, 18, 5, 0, PAPER)
    s.t("Historys", 54, 32, 19, True, HexColor("#1f2527"))
    s.box(s.W - 16 - 36 - 10 - 36, 7, 36, 36, 18, PAPER, LINE, 0.5)
    s.t("?", s.W - 16 - 36 - 10 - 18, 31, 17, True, INK, "center")
    s.box(s.W - 16 - 36, 7, 36, 36, 18, PAPER, LINE, 0.5)
    s.glyph("dots", s.W - 16 - 18, 25, 18, INK)


def dock(s, y, items, h=64, highlight=None, emph_last=False, active=None):
    W = s.W
    s.box(12, y, W - 24, h, 20, PAPER, LINE, 0.5)
    n = len(items)
    iw = (W - 24) / n
    for i, (g, lab) in enumerate(items):
        cx = 12 + iw * (i + 0.5)
        emph = emph_last and i == n - 1
        if emph:
            s.box(cx - 16, y + 8, 32, 32, 16, INK)
        if active == i:
            s.box(cx - iw / 2 + 4, y + 4, iw - 8, h - 8, 14, GOOD)
        s.glyph(g, cx, y + 24, 17, white if emph else INK)
        s.t(lab, cx, y + h - 9, 11, True, INK, "center")
        if highlight == i:
            s.c.saveState()
            s.c.setStrokeColor(BLUE)
            s.c.setLineWidth(1.1)
            s.c.circle(s.X(cx), s.Y(y + h / 2), 34 * s.k, fill=0, stroke=1)
            s.c.restoreState()


def cta(s, y, text="Exportar", fill=INK):
    s.box(16, y, s.W - 32, 50, 25, fill)
    s.t(text, s.W / 2, y + 30.5, 15, True, white, "center")


def design_panel(s, y, h, layout, borders):
    W = s.W
    s.box(12, y, W - 24, h, 20, PAPER, LINE, 0.5)
    s.t("Diseño", 28, y + 28, 14, True)
    s.pill(W - 28 - 70, y + 10, 70, 28, "Listo", INK, white, 12)
    cw = (W - 24 - 32 - 16) / 3
    for i, (lab, mode) in enumerate((("3 bandas", "bands"), ("2+1", "twoone"), ("1+2", "onetwo"))):
        cx, cy = 28 + i * (cw + 8), y + 48
        on = mode == layout
        s.box(cx, cy, cw, 112, 14, INK if on else CHIP, INK if on else LINE, 0.4)
        collage(s, cx + (cw - 44) / 2, cy + 10, 44, 78, mode, borders, ("thumb_on" if on else "thumb",) * 3, badges=None)
        s.t(lab, cx + cw / 2, cy + 104, 11, True, white if on else INK, "center")
    ry = y + 174
    s.t("Bordes", 28, ry + 17, 13, True)
    s.t("Margen negro entre huecos", 82, ry + 17, 11, False, MUTED)
    tx = W - 28 - 46
    s.box(tx, ry, 46, 26, 13, INK if borders else LINE)
    s.c.setFillColor(white)
    s.c.circle(s.X(tx + (33 if borders else 13)), s.Y(ry + 13), 10 * s.k, fill=1, stroke=0)


def duration_panel(s, y, h, value="10 s"):
    W = s.W
    s.box(12, y, W - 24, h, 20, PAPER, LINE, 0.5)
    s.t("Duración", 28, y + 28, 14, True)
    s.pill(W - 28 - 70, y + 10, 70, 28, "Listo", INK, white, 12)
    labels = ("5 s", "10 s", "15 s", "30 s")
    dw = (W - 56 - 24) / 4
    for i, lab in enumerate(labels):
        on = lab == value
        s.pill(28 + i * (dw + 8), y + 50, dw, 36, lab, INK if on else CHIP, white if on else INK, 13, None if on else LINE)
    s.t("Vale para la vista previa y para el vídeo final.", 28, y + 110, 11, False, MUTED)


def new_main(s, layout="bands", borders=True, fills=FULL, selected=None, mode="global", panel=None, muted=(),
             empty="plus", caption=None, highlight=None, hidden=(), slot_kind="video"):
    W, V = s.W, s.H
    topbar(s)
    cta_y = V - 12 - 50
    bottom = cta_y - 10
    ph = {"diseno": 214, "duracion": 128}.get(panel, 64)
    dock_y = bottom - ph
    cap_h = 20 if mode == "slot" else 0
    cx, cy, cw, ch = fit_canvas(s, 56, dock_y - 10 - cap_h)
    rects = collage(s, cx, cy, cw, ch, layout, borders, fills, selected, muted, empty, hidden=hidden)
    if panel == "diseno":
        design_panel(s, dock_y, ph, layout, borders)
    elif panel == "duracion":
        duration_panel(s, dock_y, ph)
    elif mode == "slot":
        if caption:
            s.t(caption, W / 2, dock_y - 8, 12, True, MUTED, "center")
        items = [("image", "Cambiar"), ("crop", "Ajustar")]
        if slot_kind == "video":
            items.append(("mute" if selected in muted else "sound", "Sonido"))
        items += [("trash", "Quitar"), ("check", "Listo")]
        dock(s, dock_y, items, emph_last=True)
    else:
        dock(s, dock_y, GLOBAL_DOCK, highlight=highlight)
    cta(s, cta_y)
    return {"canvas": (cx, cy, cw, ch), "rects": rects, "dock_y": dock_y, "cta_y": cta_y}


def tap(s, x, y):
    c = s.c
    c.saveState()
    c.setFillColor(Color(0.48, 0.61, 0.8, alpha=0.35))
    c.circle(s.X(x), s.Y(y), 22 * s.k, fill=1, stroke=0)
    c.setFillColor(Color(0.48, 0.61, 0.8, alpha=0.9))
    c.circle(s.X(x), s.Y(y), 9 * s.k, fill=1, stroke=0)
    c.restoreState()


def menu_open(s):
    W = s.W
    x, y, w = W - 16 - 210, 48, 210
    s.box(x + 2, y + 3, w, 150, 14, Color(0, 0, 0, alpha=0.12))
    s.box(x, y, w, 150, 14, PAPER, LINE, 0.5)
    rows = (("Nuevo collage…", WARN), ("Guía rápida", INK), ("Acerca de · v1.0.9", MUTED))
    for i, (lab, col) in enumerate(rows):
        ry = y + 10 + i * 46
        s.t(lab, x + 18, ry + 28, 14, True, col)
        if i < 2:
            s.box(x + 14, ry + 44, w - 28, 1, 0, LINE)


def picker_sheet(s):
    W, V = s.W, s.H
    s.dim()
    y0 = V * 0.26
    s.box(0, y0, W, V - y0 + 30, 24, HexColor("#fbfaf8"))
    s.box(W / 2 - 22, y0 + 10, 44, 5, 2.5, LINE)
    s.t("Elige hasta 3", 20, y0 + 44, 16, True)
    s.t("Fotos y vídeos · se colocan en orden", 20, y0 + 64, 12, False, MUTED)
    cols, gap = 3, 6
    tw = (W - 40 - gap * (cols - 1)) / cols
    palette = ["photo", "video", "photo2", "photo3", "photo", "photo2", "video", "photo3", "photo", "photo2", "photo3", "photo"]
    picks = {1: 1, 3: 2, 6: 3}
    for i, kind in enumerate(palette):
        r, cidx = divmod(i, cols)
        tx, ty = 20 + cidx * (tw + gap), y0 + 80 + r * (tw + gap)
        if ty + tw > V - 76:
            break
        scene(s.c, s.X(tx), s.Y(ty + tw), tw * s.k, tw * s.k, FILL[kind])
        if kind == "video":
            s.t("0:12", tx + tw - 8, ty + tw - 8, 10, True, white, "right")
        if i in picks:
            s.c.saveState()
            s.c.setStrokeColor(BLUE)
            s.c.setLineWidth(max(0.8, 3 * s.k))
            s.c.rect(s.X(tx), s.Y(ty + tw), tw * s.k, tw * s.k, fill=0, stroke=1)
            s.c.restoreState()
            s.box(tx + tw - 30, ty + 6, 24, 24, 12, BLUE)
            s.t(str(picks[i]), tx + tw - 18, ty + 23, 13, True, white, "center")
        else:
            s.c.saveState()
            s.c.setStrokeColor(white)
            s.c.setLineWidth(0.5)
            s.c.circle(s.X(tx + tw - 18), s.Y(ty + 18), 11 * s.k, fill=0, stroke=1)
            s.c.restoreState()
    s.pill(20, V - 64, W - 40, 48, "Añadir (3)", INK, white, 15)


def coach(s, layout_info):
    W = s.W
    dock_y = layout_info["dock_y"]
    ax = 12 + (W - 24) * (2.5 / 4)
    bx, by, bw, bh = ax - 170, dock_y - 92, 240, 76
    s.box(bx, by, bw, bh, 16, INK)
    p = s.c.beginPath()
    p.moveTo(s.X(ax - 10), s.Y(by + bh))
    p.lineTo(s.X(ax + 10), s.Y(by + bh))
    p.lineTo(s.X(ax), s.Y(by + bh + 12))
    p.close()
    s.c.setFillColor(INK)
    s.c.drawPath(p, fill=1, stroke=0)
    s.t("Empieza aquí", bx + 16, by + 26, 14, True, white)
    s.t("Elige hasta 3 fotos o vídeos.", bx + 16, by + 46, 12, False, HexColor("#d9d4cc"))
    s.t("1 de 3", bx + bw - 14, by + 66, 10, True, HexColor("#a8b0b3"), "right")


def export_sheet(s, progress=None):
    W, V = s.W, s.H
    s.dim()
    y0 = V - 404
    s.box(0, y0, W, 440, 24, PAPER, LINE, 0.5)
    s.box(W / 2 - 22, y0 + 10, 44, 5, 2.5, LINE)
    s.t("Guardar historia", 20, y0 + 44, 17, True)
    collage(s, 20, y0 + 60, 60, 107, "bands", True, FULL, badges=None)
    s.t("3 huecos · 10 s", 96, y0 + 82, 14, True)
    s.t("Sonido: 2 vídeos mezclados", 96, y0 + 104, 12, False, MUTED)
    s.t("1080 × 1920 · MP4", 96, y0 + 124, 12, False, MUTED)
    s.t("Álbum Historys", 96, y0 + 144, 12, False, MUTED)
    s.t("Calidad", 20, y0 + 194, 13, True)
    s.box(20, y0 + 204, W - 40, 66, 16, SOFT)
    sw = (W - 40 - 12) / 3
    for i, (name, size) in enumerate((("Ligera", "≈ 8 MB"), ("Normal", "≈ 19 MB"), ("Máxima", "≈ 35 MB"))):
        sx = 26 + i * (sw + 0)
        on = name == "Normal"
        if on:
            s.box(sx, y0 + 210, sw, 54, 12, INK)
        s.t(name, sx + sw / 2, y0 + 234, 13, True, white if on else INK, "center")
        s.t(size, sx + sw / 2, y0 + 253, 11, False, HexColor("#d9d4cc") if on else MUTED, "center")
    if progress is None:
        cta_y = y0 + 288
        s.box(20, cta_y, W - 40, 50, 25, INK)
        s.t("Guardar en galería", W / 2, cta_y + 31, 15, True, white, "center")
        s.t("Vista previa", W / 2, y0 + 370, 13, True, MUTED, "center")
    else:
        s.t("Renderizando vídeo…", 20, y0 + 306, 13, True)
        s.t(f"{progress}%", W - 20, y0 + 306, 13, True, INK, "right")
        s.box(20, y0 + 316, W - 40, 10, 5, LINE)
        s.box(20, y0 + 316, (W - 40) * progress / 100, 10, 5, INK)
        s.pill(20, y0 + 340, W - 40, 44, "Cancelar", GHOST, INK, 13, LINE)


def done_sheet(s):
    W, V = s.W, s.H
    s.dim()
    y0 = V - 466
    s.box(0, y0, W, 500, 24, PAPER, LINE, 0.5)
    s.box(W / 2 - 22, y0 + 10, 44, 5, 2.5, LINE)
    collage(s, W / 2 - 46, y0 + 26, 92, 163, "bands", True, FULL, badges=None)
    s.t("Guardada en tu galería", W / 2, y0 + 218, 17, True, INK, "center")
    s.t("Álbum Historys · 1080 × 1920", W / 2, y0 + 238, 12, False, MUTED, "center")
    s.box(20, y0 + 254, W - 40, 50, 25, INK)
    s.glyph("share", W / 2 - 54, y0 + 279, 16, white)
    s.t("Compartir", W / 2 + 10, y0 + 284.5, 15, True, white, "center")
    s.pill(20, y0 + 312, W - 40, 44, "Ver en galería", CHIP, INK, 13, LINE)
    s.pill(20, y0 + 364, W - 40, 44, "Seguir editando", CHIP, INK, 13, LINE)
    s.t("Empezar otra historia", W / 2, y0 + 436, 13, True, MUTED, "center")


def new_editor(s):
    W, V = s.W, s.H
    c = s.c
    s.t("Cancelar", 16, 32, 14, True, HexColor("#d7d2ca"))
    s.t("Ajustar foto", W / 2, 32, 15, True, HexColor("#ece9e2"), "center")
    s.pill(W - 16 - 78, 10, 78, 32, "Hecho", PAPER, INK, 13)
    cw = W - 56
    ch = cw * 608 / 1032
    cx, cy = 28, V * 0.40 - ch / 2
    ox, oy, ow, oh = cx - 30, cy - 46, cw + 60, ch + 120
    scene(c, s.X(ox), s.Y(oy + oh), ow * s.k, oh * s.k, PHOTO, alpha=0.32)
    c.saveState()
    p = c.beginPath()
    p.rect(s.X(cx), s.Y(cy + ch), cw * s.k, ch * s.k)
    c.clipPath(p, stroke=0, fill=0)
    scene(c, s.X(ox), s.Y(oy + oh), ow * s.k, oh * s.k, PHOTO)
    c.setStrokeColor(Color(1, 1, 1, alpha=0.55))
    c.setLineWidth(0.4)
    for f in (1 / 3, 2 / 3):
        c.line(s.X(cx + cw * f), s.Y(cy), s.X(cx + cw * f), s.Y(cy + ch))
        c.line(s.X(cx), s.Y(cy + ch * f), s.X(cx + cw), s.Y(cy + ch * f))
    c.restoreState()
    c.setStrokeColor(white)
    c.setLineWidth(0.9)
    c.rect(s.X(cx), s.Y(cy + ch), cw * s.k, ch * s.k, fill=0, stroke=1)
    s.t("Arrastra para mover · pellizca para zoom", W / 2, oy + oh + 26, 12, False, HexColor("#b8c0c3"), "center")
    sy = V - 132
    s.t("Zoom 180%", W / 2, sy - 14, 12, True, HexColor("#d9d4cc"), "center")
    s.t("1×", 18, sy + 5, 12, True, HexColor("#b8c0c3"))
    s.t("4×", W - 18, sy + 5, 12, True, HexColor("#b8c0c3"), "right")
    tx0, tx1 = 46, W - 46
    s.box(tx0, sy - 2, tx1 - tx0, 4, 2, HexColor("#3a4446"))
    kx = tx0 + (tx1 - tx0) * (0.8 / 3)
    s.box(tx0, sy - 2, kx - tx0, 4, 2, PAPER)
    c.setFillColor(PAPER)
    c.circle(s.X(kx), s.Y(sy), 11 * s.k, fill=1, stroke=0)
    s.t("Restablecer", W / 2, V - 66, 13, True, HexColor("#b8c0c3"), "center")
    s.t("Doble toque: alterna 1× y 2×", W / 2, V - 32, 11, False, HexColor("#7f898c"), "center")


def drag_state(s):
    info = new_main(s, fills=FULL, hidden=(0,))
    rects = info["rects"]
    rx, ry, rw, rh = rects[0]
    tx, ty, tw, th = rects[2]
    c = s.c
    c.setFillColor(GOOD)
    c.rect(s.X(tx), s.Y(ty + th), tw * s.k, th * s.k, fill=1, stroke=0)
    scene(c, s.X(tx), s.Y(ty + th), tw * s.k, th * s.k, FILL["photo2"], alpha=0.45)
    lw = max(0.9, 3.5 * s.k)
    c.saveState()
    c.setStrokeColor(BLUE)
    c.setLineWidth(lw)
    c.rect(s.X(tx) + lw / 2, s.Y(ty + th) + lw / 2, tw * s.k - lw, th * s.k - lw, fill=0, stroke=1)
    c.restoreState()
    gw, gh = rw * 0.62, rh * 0.62
    gx, gy = tx + tw * 0.5 - gw * 0.15, ty - gh * 0.45
    s.box(gx + 5, gy + 7, gw, gh, 4, Color(0, 0, 0, alpha=0.35))
    scene(c, s.X(gx), s.Y(gy + gh), gw * s.k, gh * s.k, FILL["photo"])
    c.setStrokeColor(white)
    c.setLineWidth(0.9)
    c.rect(s.X(gx), s.Y(gy + gh), gw * s.k, gh * s.k, fill=0, stroke=1)
    tap(s, gx + gw * 0.5, gy + gh * 0.55)
    dy = info["dock_y"]
    s.box(12, dy, s.W - 24, 64, 20, BEIGE)
    s.box(12, dy, s.W - 24, 64, 20, GOOD, BLUE, 0.6)
    s.t("Suelta sobre otro hueco", s.W / 2, dy + 28, 13, True, INK, "center")
    s.t("para intercambiarlos", s.W / 2, dy + 46, 12, False, MUTED, "center")


# ---------------------------------------------------------------------------
# Flowables
# ---------------------------------------------------------------------------


NOTE_H = 52


def note(c, x, y, w, title, body):
    rrect(c, x, y, w, NOTE_H, 6, PAPER, LINE, 0.5)
    txt(c, title, x + 8, y + NOTE_H - 15, 7.8, True, INK)
    for i, line in enumerate(simpleSplit(body, "Segoe", 7.0, w - 16)[:3]):
        txt(c, line, x + 8, y + NOTE_H - 28 - i * 9, 7.0, False, MUTED)


class Wire(Flowable):
    PW = 126

    def __init__(self, left, right, headline, notes, labels=("ANTES", "PROPUESTA"), goods=(False, True),
                 darks=(False, False), arrow_label="", height=310):
        super().__init__()
        self.left, self.right = left, right
        self.headline, self.notes = headline, notes
        self.labels, self.goods, self.darks = labels, goods, darks
        self.arrow_label = arrow_label
        self.width, self.height = CONTENT_W, height

    def draw(self):
        c = self.canv
        rrect(c, 0, 0, self.width, self.height, 10, BEIGE, LINE, 0.6)
        x, y, w, h = 10, 10, self.width - 20, self.height - 20
        pw, ph = self.PW, h - 24
        py = y + 6
        p1x = x + 6
        p2x = p1x + pw + 34
        with screen(c, p1x, py, pw, ph, self.labels[0], self.goods[0], self.darks[0]) as s:
            self.left(s)
        arrow_between(c, p1x + pw + 15, py + ph / 2, self.arrow_label)
        with screen(c, p2x, py, pw, ph, self.labels[1], self.goods[1], self.darks[1]) as s:
            self.right(s)
        nx = p2x + pw + 14
        nw = w - (nx - x)
        txt(c, self.headline, nx, y + h - 16, 9.4, True, INK)
        for i, (t, b) in enumerate(self.notes):
            note(c, nx, y + h - 30 - NOTE_H - i * (NOTE_H + 8), nw, t, b)


class CoverFigure(Flowable):
    def __init__(self):
        super().__init__()
        self.width, self.height = CONTENT_W, 318

    def draw(self):
        c = self.canv
        rrect(c, 0, 0, self.width, self.height, 10, BEIGE, LINE, 0.6)
        pw, ph = 132, 272
        py = 22
        with screen(c, 22, py, pw, ph, "HOY · v1.0.9", False) as s:
            old_ui(s)
            warn_note(s, s.H - 38, "Exportar: 450 dp más abajo  ↓")
        arrow_between(c, 22 + pw + 20, py + ph / 2)
        p2x = 22 + pw + 40
        with screen(c, p2x, py, pw, ph, "PROPUESTA", True) as s:
            info = new_main(s, selected=None)
            ref = s
        zones = [
            ("1", "Barra superior", "Título, «?» de ayuda y menú «···».", ref.Y(25)),
            ("2", "Lienzo 9:16", "Siempre entero; usa todo el alto libre.",
             ref.Y(info["canvas"][1] + info["canvas"][3] / 2)),
            ("3", "Barra de herramientas", "Cambia según lo que tocas.", ref.Y(info["dock_y"] + 32)),
            ("4", "Exportar", "Fijo, en la zona del pulgar.", ref.Y(info["cta_y"] + 25)),
        ]
        lx = p2x + pw + 14
        tx = lx + 40
        for i, (n, title, body, zy) in enumerate(zones):
            ty = self.height - 58 - i * 66
            c.setStrokeColor(BLUE)
            c.setLineWidth(0.6)
            c.line(p2x + pw - 4, zy, lx + 6, zy)
            c.line(lx + 6, zy, lx + 18, ty + 4)
            c.setFillColor(BLUE)
            c.circle(lx + 24, ty + 4, 7, fill=1, stroke=0)
            txt(c, n, lx + 24, ty + 1.3, 8, True, white, "center")
            txt(c, title, tx, ty + 6, 9.5, True, INK)
            txt(c, body, tx, ty - 6, 7.4, False, MUTED)


class ScrollStrip(Flowable):
    K = 0.2
    VIEW = 680

    def __init__(self):
        super().__init__()
        self.L = old_layout()
        self.total = self.L["end"]
        self.width = 168
        self.height = self.total * self.K + 8

    def draw(self):
        c = self.canv
        k = self.K
        sx = 64
        top = self.height - 4
        s = Scr(c, sx, top, k, 360, self.total)
        rrect(c, sx, top - self.total * k, 360 * k, self.total * k, 4, BEIGE, LINE, 0.5)
        c.saveState()
        p = c.beginPath()
        p.rect(sx, top - self.total * k, 360 * k, self.total * k)
        c.clipPath(p, stroke=0, fill=0)
        old_ui(s)
        c.setFillColor(Color(0.976, 0.973, 0.965, alpha=0.62))
        c.rect(sx, top - self.total * k, 360 * k, (self.total - self.VIEW) * k, fill=1, stroke=0)
        c.restoreState()
        c.setStrokeColor(BLUE)
        c.setLineWidth(1.2)
        c.rect(sx - 1, top - self.VIEW * k, 360 * k + 2, self.VIEW * k, fill=0, stroke=1)
        txt(c, "Lo que se ve", 0, top - 12, 7.4, True, BLUE)
        txt(c, "al abrir", 0, top - 21, 7.4, True, BLUE)
        txt(c, "≈ 680 dp", 0, top - 30, 7.4, False, MUTED)
        fold = top - self.VIEW * k
        c.setDash(2, 2)
        c.setStrokeColor(WARN)
        c.line(0, fold, sx - 4, fold)
        c.setDash()
        txt(c, "Fuera de", 0, fold - 12, 7.4, True, WARN)
        txt(c, "pantalla", 0, fold - 21, 7.4, True, WARN)
        txt(c, f"≈ {self.total - self.VIEW} dp", 0, fold - 30, 7.4, False, MUTED)
        marks = [
            (1, 27), (2, 200), (3, self.L["canvas"] + 80), (4, self.L["canvas"] + 400),
            (5, self.L["bar"] + 8), (6, self.L["duration"] + 60), (7, self.L["actions"] + 26),
        ]
        mx = sx + 360 * k + 12
        for n, ydp in marks:
            yy = top - ydp * k
            c.setStrokeColor(WARN)
            c.setLineWidth(0.6)
            c.line(sx + 360 * k - 6, yy, mx - 6, yy)
            c.setFillColor(WARN)
            c.circle(mx, yy, 6, fill=1, stroke=0)
            txt(c, str(n), mx, yy - 2.6, 7.4, True, white, "center")


# ---------------------------------------------------------------------------
# Contenido
# ---------------------------------------------------------------------------


def f01_before(s):
    L = old_ui(s)
    warn_note(s, s.H - 38, f"Exportar: {int(L['actions'] - s.H)} dp más abajo  ↓")


def f01_after(s):
    new_main(s)


def f02_before(s):
    old_ui(s)
    s.c.saveState()
    s.c.setStrokeColor(WARN)
    s.c.setLineWidth(1.0)
    s.c.circle(s.X(323), s.Y(27), 26 * s.k, fill=0, stroke=1)
    s.c.restoreState()
    warn_note(s, 56, "R = vaciar todo, junto al título")


def f02_after(s):
    new_main(s)
    menu_open(s)


def f03_before(s):
    old_ui(s, selected=0, fills=("empty", "video", "photo2"))
    old_library_dialog(s)


def f03_after(s):
    info = new_main(s, fills=("empty", "empty", "empty"))
    rx, ry, rw, rh = info["rects"][0]
    tap(s, rx + rw * 0.66, ry + rh * 0.62)


def f04_before(s):
    old_ui(s, scroll=470, selected=0, fills=("photo", "empty", "empty"))
    warn_note(s, s.H - 38, "Repetir 3 veces: 12 toques")


def f04_after(s):
    new_main(s, fills=("empty", "empty", "empty"))
    picker_sheet(s)


def f05_before(s):
    old_ui(s, selected=0)
    warn_note(s, s.H - 38, "Acciones del hueco: fuera de vista  ↓")


def f05_after(s):
    new_main(s, selected=1, mode="slot", muted=(1,), caption="Hueco 2 · Vídeo · Silenciado")


def f06_before(s):
    L = old_ui(s)
    top, bot = L["design"] - 4, L["borders"] + 81
    s.box(10, top, s.W - 20, bot - top, 18, Color(0.72, 0.36, 0.29, alpha=0.12), WARN, 0.7)
    warn_note(s, bot + 8, f"Forma y bordes: {round((bot - top) / s.H * 100)} % de lo visible")


def f06_after(s):
    new_main(s, layout="twoone", panel="diseno")


def f07_before(s):
    old_ui(s, scroll=470, selected=0)
    warn_note(s, s.H - 38, "Para mover: cargar otra vez los dos")


def f07_after(s):
    drag_state(s)


def f08_before(s):
    old_editor(s)


def f08_after(s):
    new_editor(s)


def f09_before(s):
    L = old_layout()
    old_ui(s, scroll=L["end"] + 68 - s.H, exporting=True)
    warn_note(s, 8, "¿Duración? ¿Calidad? Filas sin nombre")


def f09_after(s):
    new_main(s)
    export_sheet(s)


def f10_left(s):
    info = new_main(s, fills=("empty", "empty", "empty"), highlight=2)
    coach(s, info)


def f10_right(s):
    new_main(s)
    done_sheet(s)


PHASES = [
    {
        "n": "01",
        "title": "Una sola pantalla que cabe entera",
        "draw": (f01_before, f01_after),
        "headline": "Todo a la vista, sin desplazar",
        "notes": [
            ("Cuatro zonas fijas", "Barra superior, lienzo, herramientas y Exportar."),
            ("El lienzo usa todo el alto libre", "Se calcula con fitFrame: nunca queda cortado."),
            ("Exportar siempre visible", "Abajo, en la zona del pulgar, sin desplazar."),
            ("Lo que se toca una vez, plegado", "Forma, bordes y duración bajan a la barra."),
        ],
        "what": "Desaparece el <b>ScrollView</b> de la pantalla principal. Queda dividida en cuatro zonas fijas: barra superior (48 dp), lienzo 9:16 (todo el alto que sobre), barra de herramientas (64 dp) y botón <b>Exportar</b> (50 dp). El tamaño del lienzo se calcula con la misma función <b>fitFrame</b> que ya usan el preview y el editor.",
        "why": "Hoy el contenido mide unos 1.200 dp y en un S25 se ven unos 680. El lienzo queda cortado y Exportar está unos 450 dp por debajo. Con zonas fijas, lo importante se ve siempre y el pulgar sabe dónde ir.",
        "how": "Partir <b>App.tsx</b> (1.350 líneas): un hook <b>useCollage</b> con el estado (huecos, forma, bordes, duración, calidad) y los componentes <b>TopBar</b>, <b>StoryCanvas</b>, <b>ToolDock</b> y <b>PrimaryAction</b>. La pantalla es un View con flex:1 y la zona central mide su alto con onLayout.",
        "done": "En el S25 y en un móvil pequeño (360 × 640 dp) se ven a la vez el lienzo entero, la barra de herramientas y Exportar, sin desplazar nada.",
    },
    {
        "n": "02",
        "title": "Arriba, solo ayuda y menú",
        "draw": (f02_before, f02_after),
        "headline": "Sin acciones peligrosas a mano",
        "notes": [
            ("Adiós a la R negra", "Vaciar ya no compite con Exportar en la cabecera."),
            ("«?» abre la guía rápida", "El contenido de la «i», con un símbolo que se entiende."),
            ("«···» agrupa lo poco frecuente", "Nuevo collage…, Guía rápida y versión."),
            ("Borrar sigue protegido", "«Nuevo collage…» pide confirmación antes de vaciar."),
        ],
        "what": "Se quita la «R». En la cabecera quedan el título, un botón «?» (guía rápida) y un botón de menú «···» con <b>Nuevo collage…</b>, <b>Guía rápida</b> y <b>Acerca de · v1.0.9</b>. «Nuevo collage…» sigue pidiendo confirmación.",
        "why": "Vaciar es la acción más destructiva de la app. Hoy tiene más peso visual que Exportar (círculo negro relleno) y se anuncia con una letra que no dice qué hace. Ahora queda un toque más lejos, a propósito, y con un nombre claro.",
        "how": "<b>TopBar</b> con dos botones redondos. El menú es un Modal transparente anclado arriba a la derecha. La confirmación reutiliza el <b>resetDialog</b> que ya existe.",
        "done": "No quedan letras sueltas haciendo de icono. Para vaciar el collage hay que abrir el menú y confirmar.",
    },
    {
        "n": "03",
        "title": "Tocar un hueco vacío abre la galería",
        "draw": (f03_before, f03_after),
        "headline": "De cuatro pasos a dos",
        "notes": [
            ("«+» en cada hueco vacío", "Se entiende sin leer que ahí va algo."),
            ("Un toque y se abre la galería", "Sin diálogo propio: Android pregunta solo la 1.ª vez."),
            ("Permiso denegado con salida", "El aviso trae «Abrir ajustes», no solo «Entendido»."),
            ("Hueco lleno = seleccionar", "Si ya tiene foto o vídeo, el toque lo selecciona (fase 05)."),
        ],
        "what": "Un hueco vacío muestra un «+» grande con la palabra «Añadir». Al tocarlo se abre directamente el selector del sistema, sin el diálogo propio «Acceder a librería». Si el permiso está denegado, el aviso incluye un botón <b>Abrir ajustes</b>.",
        "why": "Hoy, cargar una foto son cuatro pasos: tocar el hueco, bajar hasta la barra, pulsar «Cargar» y luego «Continuar» en un diálogo que repite lo que Android ya pregunta la primera vez. Ahora basta con tocar el hueco y elegir la foto.",
        "how": "En <b>renderSlot</b>, si el hueco está vacío, onPress llama directamente a <b>pickMediaForSlot(slot.id)</b>. El estado <b>libraryDialog</b> de tipo 'confirm' se elimina y, cuando el resultado es 'denied', el aviso usa <b>Linking.openSettings()</b>.",
        "done": "Con la app recién abierta, una foto queda colocada en un hueco con dos toques: el hueco y la foto.",
    },
    {
        "n": "04",
        "title": "Elegir varias fotos de una vez",
        "draw": (f04_before, f04_after),
        "headline": "Llenar el collage en un paso",
        "notes": [
            ("Tantas como huecos libres", "El límite de selección se ajusta solo: 3, 2 o 1."),
            ("Se colocan en orden", "La 1.ª elegida va al hueco 1, luego al 2 y al 3."),
            ("Fotos y vídeos mezclados", "Cada vídeo pasa por la misma sonda ffprobe."),
            ("De 12 toques a 5", "Llenar un collage de tres sin desplazar la pantalla."),
        ],
        "what": "<b>Añadir</b>, en la barra de herramientas, abre el selector con selección múltiple, limitada al número de huecos vacíos. Lo que se elige se reparte en orden: hueco 1, 2 y 3. Si no queda ningún hueco libre, Añadir se desactiva y explica el motivo.",
        "why": "Lo habitual es llenar los tres huecos. Hoy eso son 12 toques y varios desplazamientos; con selección múltiple son 5 (Añadir, tres elecciones y confirmar).",
        "how": "<b>launchImageLibraryAsync</b> con <b>allowsMultipleSelection: true</b> y <b>selectionLimit</b> igual al número de huecos vacíos. Sacar de pickMediaForSlot la lectura de tamaño, la miniatura y ffprobe a una función <b>buildSlotMedia(asset)</b>, y llamarla para cada elemento con Promise.all.",
        "done": "Con el lienzo vacío, elegir tres elementos los coloca en los tres huecos en el orden en que se marcaron.",
    },
    {
        "n": "05",
        "title": "La barra de abajo cambia según lo que tocas",
        "draw": (f05_before, f05_after),
        "headline": "Los controles, siempre en el mismo sitio",
        "notes": [
            ("Misma barra, otros botones", "La barra general se convierte en la del hueco."),
            ("Icono más palabra", "Cambiar · Ajustar · Sonido · Quitar · Listo."),
            ("El estado del sonido se ve", "Altavoz tachado en la barra y sobre el vídeo."),
            ("Salir es fácil", "«Listo» o tocar fuera del lienzo deselecciona."),
        ],
        "what": "Al tocar un hueco con contenido, la barra de herramientas se sustituye por la del hueco: <b>Cambiar</b>, <b>Ajustar</b>, <b>Sonido</b> (solo en vídeos), <b>Quitar</b> y <b>Listo</b>. Encima aparece una línea como «Hueco 2 · Vídeo · Silenciado». Las etiquetas «VIDEO» y «Corregido» del lienzo se cambian por una pastilla con la duración; «Corregido» pasa a ser un aviso breve al cargar.",
        "why": "Hoy la barra del hueco aparece debajo del lienzo, fuera de la pantalla si tocas el hueco de arriba, y el botón «Audio» enseña el estado en lugar de la acción. La nueva barra sale siempre en el mismo sitio, bajo el pulgar.",
        "how": "<b>ToolDock</b> recibe mode: 'global' o 'slot'. El botón Sonido muestra un altavoz o un altavoz tachado. En el lienzo, un vídeo silenciado lleva el mismo icono junto a su duración. El toque fuera del lienzo llama a setSelectedSlotId(null).",
        "done": "Con cualquier hueco seleccionado, sus acciones se ven sin desplazar, y el estado del sonido se lee igual en la barra que en el hueco.",
    },
    {
        "n": "06",
        "title": "Diseño y duración en paneles",
        "draw": (f06_before, f06_after),
        "headline": "Ajustes que no estorban",
        "notes": [
            ("Forma y bordes juntos", "Tres miniaturas y un interruptor en un mismo panel."),
            ("El lienzo se encoge, no se tapa", "Cada cambio se ve en directo sobre tu collage."),
            ("La duración enseña su valor", "El botón de la barra dice «10 s» junto al reloj."),
            ("La calidad sale de aquí", "Se elige al exportar (fase 09), cuando importa."),
        ],
        "what": "<b>Diseño</b> abre un panel con las tres formas y un interruptor <b>Bordes</b>. El botón del reloj abre otro panel con 5, 10, 15 y 30 s, y muestra el valor elegido («10 s»). El panel ocupa el sitio de la barra y el lienzo se hace más pequeño para seguir viéndose entero, así que cada cambio se ve en directo.",
        "why": "Hoy la forma y los bordes ocupan casi la mitad de lo que se ve al abrir, aunque se tocan una vez por collage, y empujan el lienzo hacia abajo. La duración y la calidad son filas de pastillas sin título.",
        "how": "Componentes <b>DesignPanel</b> y <b>DurationPanel</b>, reutilizando <b>LayoutThumb</b> tal cual. El alto del lienzo depende del alto del panel abierto, con el mismo onLayout de la fase 01.",
        "done": "Encima del lienzo no queda ningún ajuste, y cambiar la forma o los bordes se hace sin perder de vista el collage.",
    },
    {
        "n": "07",
        "title": "Ordenar arrastrando y ajustar con doble toque",
        "draw": (f07_before, f07_after),
        "headline": "Gestos que ya conoces",
        "notes": [
            ("Mantén pulsado y arrastra", "El hueco se levanta con sombra y una vibración corta."),
            ("Suelta para intercambiar", "El destino se marca en azul antes de soltar."),
            ("Se conserva todo", "Encuadre, zoom y sonido viajan con el contenido."),
            ("Doble toque = Ajustar", "Atajo directo al editor de encuadre."),
        ],
        "what": "Al mantener pulsado un hueco, este se «levanta»; si se suelta sobre otro, los dos intercambian contenido, encuadre y sonido. Un doble toque sobre un hueco abre directamente el editor de encuadre.",
        "why": "Hoy, para cambiar dos fotos de sitio hay que volver a cargar las dos (unos 8 toques) y se pierde el encuadre. Arrastrar es el gesto que la gente ya usa en la galería y en Instagram.",
        "how": "Añadir <b>react-native-gesture-handler</b> y <b>react-native-reanimated</b> (hoy no están en package.json; requieren recompilar el build nativo). LongPress más Pan en cada hueco, y el hueco destino se detecta con getSlotBoundsMap escalado al lienzo. Al soltar se intercambian slots[a] y slots[b]. Vibración corta con <b>expo-haptics</b>.",
        "done": "Arrastrar el hueco 1 sobre el 3 los intercambia y conserva el zoom, la posición y el sonido de cada uno.",
    },
    {
        "n": "08",
        "title": "Un editor de encuadre más claro",
        "draw": (f08_before, f08_after),
        "headline": "Se ve lo que se recorta",
        "notes": [
            ("Cancelar y Hecho arriba", "Patrón del sistema; nada destructivo junto a Guardar."),
            ("Lo recortado, en tenue", "Se ve qué queda fuera del hueco mientras mueves."),
            ("Deslizador de 1× a 4×", "Más preciso que −/+; la pinza sigue funcionando."),
            ("Cuadrícula de tercios", "Aparece solo mientras arrastras."),
        ],
        "what": "Arriba quedan <b>Cancelar</b> a la izquierda y <b>Hecho</b> a la derecha, como en el resto de apps de Android e iOS. El zoom pasa de los botones −/+ a un deslizador de 1× a 4×. La parte de la foto que queda fuera del hueco se ve en tenue, con una cuadrícula de tercios mientras arrastras. <b>Restablecer</b> pasa a ser un enlace de texto.",
        "why": "Hoy hay tres botones iguales abajo (Reset, Cancelar, Guardar) y el que deshace está pegado al que guarda. Ver lo que queda fuera ayuda a encuadrar sin ir probando a ciegas.",
        "how": "Se mantiene la lógica de <b>placedMediaRect</b> y <b>draftTransform</b>. Se añade <b>@react-native-community/slider</b> enlazado a scale y se dibuja el medio con opacidad 0,35 por fuera del recorte del hueco.",
        "done": "Hecho y Cancelar no están juntos, y mientras se ajusta se ve qué parte de la foto se pierde.",
    },
    {
        "n": "09",
        "title": "Vista previa y exportación en un solo recorrido",
        "draw": (f09_before, f09_after),
        "headline": "Todo el final, en un sitio",
        "notes": [
            ("Calidad en MB, sin jerga", "Ligera · Normal · Máxima, con el peso estimado."),
            ("Resumen antes de guardar", "Huecos, duración y «2 vídeos mezclados»."),
            ("El progreso, dentro de la hoja", "Con «Cancelar», sin buscarlo al final de la pantalla."),
            ("Vista previa en bucle", "Con su propio botón «Exportar»."),
        ],
        "what": "<b>Exportar</b> abre la hoja «Guardar historia», con una miniatura, un resumen (huecos, duración y sonido) y la calidad expresada en tamaño: Ligera ≈ 8 MB, Normal ≈ 19 MB y Máxima ≈ 35 MB (para 10 s). <b>Guardar en galería</b> lanza el render y la misma hoja muestra el progreso con un botón <b>Cancelar</b>. La vista previa se repite en bucle y tiene su propio botón Exportar.",
        "why": "Hoy la calidad son tres pastillas sin título en mitad de la pantalla y el progreso aparece al final, donde no se ve. Si todo lo del final está en un sitio, la calidad se elige cuando importa y el avance se ve sin buscarlo.",
        "how": "<b>ExportSheet</b> (Modal con animación desde abajo). Tamaño estimado = bitrate × duración / 8, con 6, 15 y 28 Mbps según <b>QUALITY_OPTIONS</b>. Cancelar llama a <b>FFmpegKit.cancel(sessionId)</b> y borra el temporal. El aviso «Se mezclarán en una pista» pasa al resumen como «Sonido: 2 vídeos mezclados».",
        "done": "Desde la pantalla principal, Exportar y luego Guardar en galería genera el MP4 con la calidad indicada, y se puede cancelar a mitad.",
    },
    {
        "n": "10",
        "title": "La primera vez y el final",
        "draw": (f10_left, f10_right),
        "labels": ("PRIMERA VEZ", "LISTA"),
        "goods": (True, True),
        "headline": "Aprender usando y compartir al acabar",
        "notes": [
            ("Guía en el momento justo", "Tres burbujas, una por paso, solo la primera vez."),
            ("Compartir, lo primero", "Instagram, WhatsApp o TikTok desde la hoja final."),
            ("Tu collage se queda", "«Seguir editando»; «Empezar otra» pide confirmación."),
            ("La ayuda sigue en «?»", "Para quien quiera releerla más tarde."),
        ],
        "what": "La primera vez, el lienzo vacío muestra los «+» y una burbuja señala Añadir: «Empieza aquí: elige hasta 3 fotos o vídeos». Las otras dos burbujas (Ajustar y Exportar) aparecen solo cuando toca. Al terminar, la hoja «Guardada en tu galería» pone <b>Compartir</b> como acción principal; debajo quedan <b>Ver en galería</b> y <b>Seguir editando</b>, y «Empezar otra historia» pasa a ser un enlace.",
        "why": "La guía actual es un texto largo dentro de la «i» que casi nadie abre. Enseñar cada cosa cuando hace falta funciona mejor. Y después de guardar, lo que la gente quiere es publicar.",
        "how": "Marca de primera apertura con <b>AsyncStorage</b> (o un archivo con expo-file-system). Componente <b>Coachmark</b> colocado con el onLayout del botón Añadir. Compartir con <b>expo-sharing</b> sobre el MP4 antes de borrar el temporal.",
        "done": "Una persona que nunca ha usado la app llena y exporta su primer collage sin abrir la ayuda, y desde la hoja final comparte con un toque.",
    },
]


def header_footer(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(MUTED)
    canvas.setFont("Segoe", 8)
    canvas.drawString(LEFT, 12 * mm, "Historys  ·  Propuesta de UX en 10 fases")
    canvas.drawRightString(PAGE_W - RIGHT, 12 * mm, f"{doc.page}")
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.4)
    canvas.line(LEFT, 16 * mm, PAGE_W - RIGHT, 16 * mm)
    canvas.restoreState()


def table(rows, widths, header=True):
    t = Table(rows, colWidths=widths, repeatRows=1 if header else 0)
    style = [
        ("BACKGROUND", (0, 0), (-1, -1), PAPER),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("GRID", (0, 0), (-1, -1), 0.3, LINE),
    ]
    if header:
        style.append(("BACKGROUND", (0, 0), (-1, 0), SOFT))
    t.setStyle(TableStyle(style))
    return t


def cells(row, bold_first=False):
    return [P(v, "cell_b" if (bold_first and i == 0) else "cell") for i, v in enumerate(row)]


def phase_block(ph):
    labels = ph.get("labels", ("ANTES", "PROPUESTA"))
    goods = ph.get("goods", (False, True))
    darks = (ph["n"] == "08", ph["n"] == "08")
    return KeepTogether([
        P(f"Fase {ph['n']}", "kicker"),
        P(ph["title"], "h1"),
        Wire(ph["draw"][0], ph["draw"][1], ph["headline"], ph["notes"], labels, goods, darks),
        Spacer(1, 4),
        P("Qué cambia", "label"),
        P(ph["what"]),
        P("Por qué es más fácil", "label"),
        P(ph["why"]),
        P("Cómo se construye", "label"),
        P(ph["how"], "small"),
        P("Queda lista cuando", "label"),
        P(ph["done"], "done"),
    ])


def build():
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "propuesta-ux-10-fases.pdf")
    doc = BaseDocTemplate(
        out,
        pagesize=A4,
        title="Historys — Propuesta de UX en 10 fases",
        author="Historys",
        leftMargin=LEFT,
        rightMargin=RIGHT,
        topMargin=18 * mm,
        bottomMargin=20 * mm,
    )
    frame = Frame(LEFT, 20 * mm, CONTENT_W, PAGE_H - 38 * mm, id="main", showBoundary=0)
    doc.addPageTemplates([PageTemplate(id="body", frames=[frame], onPage=header_footer)])

    f = []
    f.append(P("PROPUESTA DE UX · SAMSUNG GALAXY S25", "kicker"))
    f.append(P("Historys: nueva distribución en 10 fases", "cover_title"))
    f.append(P(
        "Análisis de cómo está repartida hoy la pantalla y una propuesta para que crear una historia se reduzca a "
        "elegir fotos, tocar y exportar. Los esquemas están dibujados a escala sobre un Galaxy S25 (360 × 780 dp) "
        "a partir de las medidas reales de <b>appStyles.ts</b>.",
        "cover_sub",
    ))
    f.append(Spacer(1, 5 * mm))
    f.append(CoverFigure())
    f.append(Spacer(1, 4 * mm))
    f.append(P("La idea en una frase", "h2"))
    f.append(P(
        "Todo lo importante en una sola pantalla que no se desplaza: arriba el collage, abajo una barra que cambia "
        "según lo que tocas y <b>Exportar</b> siempre en el mismo sitio. Lo que se toca una vez por collage (forma, "
        "bordes, duración, calidad) se pliega en paneles y en la hoja de exportación."
    ))
    f.append(P("Cuatro reglas que siguen todas las fases", "h2"))
    for rule in (
        "<b>Nada fuera de la vista.</b> Si una acción depende de lo que tocas, aparece en la zona del pulgar, no debajo del lienzo.",
        "<b>Un toque para lo frecuente.</b> Cargar, cambiar de sitio y ajustar cuestan uno o dos gestos; vaciar, tres.",
        "<b>Palabras en lugar de letras.</b> Cada botón lleva un icono y un texto; ningún control usa una letra suelta.",
        "<b>El lienzo es el resultado.</b> Lo que se ve en el centro es exactamente el MP4: sin botones dentro del 9:16.",
    ):
        f.append(P("•  " + rule, "zone"))
        f.append(Spacer(1, 2))

    f.append(PageBreak())
    f.append(P("DIAGNÓSTICO", "kicker"))
    f.append(P("Cómo está repartida hoy la pantalla", "h1"))
    f.append(P(
        "A la izquierda, la pantalla actual completa a escala. El recuadro azul es lo que cabe en un S25 al abrir la "
        "app; todo lo que queda por debajo exige desplazarse, y ahí es donde están las acciones del hueco, la duración, "
        "la calidad, la vista previa y Exportar.",
        "body",
    ))
    f.append(Spacer(1, 3 * mm))
    problems = [
        "<b>La R negra de la cabecera</b> vacía el collage. Tiene más peso visual que Exportar y una letra que no explica nada.",
        "<b>La forma y los bordes ocupan casi la mitad</b> de lo que se ve al abrir, aunque se tocan una vez por collage.",
        "<b>Cada carga pide un diálogo propio</b> («Acceder a librería») además del permiso del sistema.",
        "<b>El lienzo ocupa todo el ancho</b> (530 dp de alto) y no cabe entero con lo que tiene encima.",
        "<b>Las acciones del hueco aparecen debajo del lienzo</b>; si tocas el hueco de arriba, no las ves.",
        "<b>Duración y calidad no tienen título</b>: son dos filas de pastillas que no dicen qué controlan.",
        "<b>Preview, Exportar y el progreso</b> están al final, unos 450 dp por debajo de lo visible.",
        "<b>Todo va hueco a hueco</b>: no se pueden elegir varias fotos a la vez ni cambiar dos huecos de sitio.",
    ]
    plist = [P(f"<font color='#b85c4b'><b>{i + 1}</b></font>  {t}", "problem") for i, t in enumerate(problems)]
    diag = Table([[ScrollStrip(), plist]], colWidths=[176, CONTENT_W - 176])
    diag.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (1, 0), (1, 0), 8),
    ]))
    f.append(diag)
    f.append(Spacer(1, 5 * mm))
    f.append(P("Lo que cuesta cada tarea, hoy y con la propuesta", "h2"))
    taps = [
        ["Tarea", "Hoy", "Propuesta", "Fase"],
        ["Llenar los 3 huecos", "12 toques y 2–3 desplazamientos", "5 toques", "04"],
        ["Cargar una foto en un hueco vacío", "4 toques y 1 desplazamiento", "2 toques", "03"],
        ["Ajustar el encuadre de un hueco", "3 toques, desplazamiento y gestos", "Doble toque, gestos y «Hecho»", "07 · 08"],
        ["Silenciar un vídeo", "2 toques y 1 desplazamiento", "2 toques", "05"],
        ["Intercambiar dos huecos", "≈ 8 toques; se pierde el encuadre", "1 gesto de arrastrar", "07"],
        ["Cambiar forma o bordes", "1 toque, si estás arriba del todo", "2 toques, viendo el collage", "06"],
        ["Exportar con la calidad por defecto", "1 toque y desplazarse al final", "2 toques, sin desplazar", "09"],
        ["Vaciar el collage", "2 toques (la R siempre a mano)", "3 toques, a propósito", "02"],
    ]
    f.append(table([cells(r, True) for r in taps],
                   [56 * mm, 46 * mm, 46 * mm, CONTENT_W - 148 * mm]))
    f.append(Spacer(1, 2 * mm))
    f.append(P(
        "Exportar y cambiar la forma cuestan un toque más que hoy, pero ya no obligan a desplazarse y se hacen "
        "viendo el resultado. Vaciar cuesta uno más a propósito.",
        "small",
    ))

    f.append(PageBreak())
    f.append(P("REUBICACIÓN", "kicker"))
    f.append(P("Dónde va cada elemento", "h1"))
    f.append(P(
        "Ningún elemento desaparece salvo el diálogo previo a la galería: todos cambian de sitio o de forma. "
        "La última columna indica en qué fase se mueve.",
        "body",
    ))
    f.append(Spacer(1, 3 * mm))
    moves = [
        ["Elemento", "Dónde está hoy", "Dónde va", "Fase"],
        ["Botón «R» (vaciar)", "Cabecera, círculo negro relleno", "Menú «···» → «Nuevo collage…», con confirmación", "02"],
        ["Botón «i»", "Cabecera", "«?» en la cabecera y «Guía rápida» en el menú", "02"],
        ["Lienzo 9:16", "Ancho completo, cortado por abajo", "Centro de la pantalla, ajustado al alto libre", "01"],
        ["Exportar", "Al final del scroll", "Botón fijo abajo, siempre visible", "01"],
        ["Preview", "Al final del scroll, junto a Exportar", "«Vista previa» en la barra de herramientas", "01 · 09"],
        ["Cargar", "Barra bajo el lienzo, tras seleccionar", "Toque directo en el «+»; «Añadir» múltiple en la barra", "03 · 04"],
        ["Diálogo «Acceder a librería»", "Antes de cada carga", "Eliminado; queda solo el permiso del sistema", "03"],
        ["Ajustar · Audio · Quitar", "Barra bajo el lienzo, a menudo fuera de vista", "Barra del hueco: Cambiar · Ajustar · Sonido · Quitar · Listo", "05"],
        ["Etiquetas VIDEO / Corregido", "Texto encima de la imagen", "Pastilla con la duración; «Corregido» como aviso al cargar", "05"],
        ["Estilo del collage", "Sección fija bajo la cabecera", "Panel «Diseño» desde la barra", "06"],
        ["Bordes", "Sección fija con dos pastillas", "Interruptor dentro del panel «Diseño»", "06"],
        ["Duración", "Fila de pastillas sin título", "Botón «10 s» con reloj en la barra, y su panel", "06"],
        ["Cambiar dos huecos de sitio", "No existe", "Mantener pulsado y arrastrar", "07"],
        ["Editor: Reset · Cancelar · Guardar", "Tres botones iguales abajo", "Cancelar y Hecho arriba; Restablecer como enlace", "08"],
        ["Calidad", "Fila de pastillas sin título", "Hoja «Guardar historia», expresada en MB", "09"],
        ["Progreso de exportación", "Tarjeta al final del scroll", "Dentro de la hoja, con «Cancelar»", "09"],
        ["«Se mezclarán en una pista»", "Texto bajo la barra del hueco", "Resumen de la hoja: «Sonido: 2 vídeos mezclados»", "09"],
        ["Hoja «Listo»", "Ver galería · Nuevo collage · Seguir editando", "Compartir · Ver en galería · Seguir editando · «Empezar otra»", "10"],
        ["Guía «Cómo usar Historys»", "Modal largo detrás de la «i»", "Burbujas la primera vez, y la guía en «?»", "10"],
    ]
    f.append(table([cells(r, True) for r in moves], [42 * mm, 46 * mm, CONTENT_W - 100 * mm, 12 * mm]))

    for ph in PHASES:
        f.append(PageBreak())
        f.append(phase_block(ph))

    f.append(PageBreak())
    f.append(P("PLAN", "kicker"))
    f.append(P("Orden recomendado y esfuerzo", "h1"))
    f.append(P(
        "Las fases están ordenadas para que cada una se pueda publicar sola. Las tres primeras ya quitan la mayor "
        "parte de la fricción: la pantalla deja de desplazarse y cargar fotos cuesta la mitad.",
        "body",
    ))
    f.append(Spacer(1, 3 * mm))
    plan = [
        ["Fase", "Esfuerzo", "Riesgo", "Depende de", "Versión sugerida"],
        ["01 · Pantalla sin scroll", "Medio", "Medio: reparte App.tsx en piezas", "—", "1.1.0"],
        ["02 · Cabecera y menú", "Bajo", "Bajo", "01", "1.1.0"],
        ["03 · Toque directo a galería", "Bajo", "Bajo", "01", "1.1.0"],
        ["04 · Selección múltiple", "Medio", "Bajo: probar vídeos largos", "03", "1.1.1"],
        ["05 · Barra contextual", "Medio", "Bajo", "01", "1.1.1"],
        ["06 · Paneles Diseño y Duración", "Medio", "Bajo", "05", "1.1.1"],
        ["07 · Arrastrar y doble toque", "Alto", "Medio: gestos sobre el lienzo", "05", "1.2.0"],
        ["08 · Editor de encuadre", "Bajo–medio", "Bajo: la matemática no cambia", "—", "1.2.0"],
        ["09 · Hoja de exportación", "Medio", "Medio: cancelar FFmpeg y limpiar", "01", "1.2.0"],
        ["10 · Primera vez y compartir", "Medio", "Bajo", "04 · 09", "1.2.0"],
    ]
    f.append(table([cells(r, True) for r in plan], [48 * mm, 22 * mm, 56 * mm, 24 * mm, CONTENT_W - 150 * mm]))
    f.append(Spacer(1, 5 * mm))
    f.append(P("Cómo comprobar que funciona", "h2"))
    f.append(P(
        "Antes de empezar y al cerrar cada versión, pedir a 3–5 personas que no conozcan la app que hagan una historia "
        "con tres fotos y la guarden, sin explicarles nada. Anotar cuántos toques necesitan, cuántas veces se desplazan "
        "y dónde dudan. El objetivo de la 1.1.0 es que nadie tenga que desplazarse; el de la 1.2.0, que nadie abra la ayuda."
    ))
    f.append(Spacer(1, 3 * mm))
    f.append(P("Dependencias nuevas que harían falta", "h2"))
    f.append(P(
        "<b>react-native-gesture-handler</b> y <b>react-native-reanimated</b> (arrastrar, fase 07), "
        "<b>@react-native-async-storage/async-storage</b> (marca de primera vez), <b>@react-native-community/slider</b> "
        "(zoom del editor), <b>expo-sharing</b> (Compartir) y <b>expo-haptics</b> (vibración al arrastrar). "
        "Todas se instalan con <b>npx expo install</b> para que cuadren con Expo SDK 54, y como varias son módulos "
        "nativos hay que volver a compilar con <b>npm run android</b>."
    ))

    doc.build(f)
    return out


if __name__ == "__main__":
    print(build())
