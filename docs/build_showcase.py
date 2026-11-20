"""Genera las imágenes del README (hero, galería y vista previa social) a partir de capturas del móvil.

Uso:
    python docs/build_showcase.py <carpeta con capturas>

La carpeta debe contener, a 1080x2340:
    S_empty.png    lienzo vacío con la primera burbuja de ayuda
    S_main.png     collage de tres bandas en tema oscuro
    S_slot.png     un hueco seleccionado
    S_design.png   panel de diseño en tema oscuro
    S_settings.png ventana de ajustes
    L_main.png     collage en tema claro
    L_design.png   panel de diseño en tema claro
"""
import os
import sys

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, 'images')
FONTS = r'C:\Windows\Fonts'

CREAM = (244, 242, 229)
NAVY = (42, 59, 82)
BLUE = (123, 152, 187)
MUTED = (96, 108, 122)


def font(name, size):
    return ImageFont.truetype(os.path.join(FONTS, name), size)


def clean_screenshot(path):
    """Quita la barra de estado y el tirador del panel lateral de Samsung."""
    im = Image.open(path).convert('RGB')
    w, h = im.size
    px = im.load()
    fill = px[8, 112]
    ImageDraw.Draw(im).rectangle([0, 0, w, 104], fill=fill)
    for y in range(350, 650):
        edge = px[w - 46, y]
        for x in range(w - 46, w):
            px[x, y] = edge
    return im


def phone(shot, width):
    """Devuelve el móvil con marco fino, esquinas redondeadas y sombra suave."""
    scale = 3
    w = width * scale
    h = round(w * shot.height / shot.width)
    bezel = round(w * 0.016)
    radius = round(w * 0.115)
    body = Image.new('RGBA', (w + bezel * 2, h + bezel * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(body)
    d.rounded_rectangle([0, 0, body.width - 1, body.height - 1], radius + bezel, fill=(24, 26, 28, 255))
    screen = shot.resize((w, h), Image.LANCZOS).convert('RGBA')
    mask = Image.new('L', (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, w - 1, h - 1], radius, fill=255)
    body.paste(screen, (bezel, bezel), mask)
    return body.resize((body.width // scale, body.height // scale), Image.LANCZOS)


def paste_with_shadow(canvas, ph, xy, blur=34, offset=(0, 26), opacity=70, tint=(30, 40, 60)):
    shadow = Image.new('RGBA', ph.size, tint + (0,))
    alpha = ph.getchannel('A').point(lambda a: a * opacity // 255)
    shadow.putalpha(alpha)
    pad = blur * 3
    layer = Image.new('RGBA', (ph.width + pad * 2, ph.height + pad * 2), (0, 0, 0, 0))
    layer.paste(shadow, (pad, pad))
    layer = layer.filter(ImageFilter.GaussianBlur(blur))
    canvas.alpha_composite(layer, (xy[0] - pad + offset[0], xy[1] - pad + offset[1]))
    canvas.alpha_composite(ph, xy)


def soft_background(size):
    w, h = size
    bg = Image.new('RGBA', size, CREAM + (255,))
    glow = Image.new('RGBA', size, (0, 0, 0, 0))
    g = ImageDraw.Draw(glow)
    g.ellipse([w * 0.42, -h * 0.35, w * 1.15, h * 0.75], fill=BLUE + (46,))
    g.ellipse([-w * 0.2, h * 0.55, w * 0.35, h * 1.35], fill=(255, 255, 255, 120))
    glow = glow.filter(ImageFilter.GaussianBlur(min(size) // 6))
    return Image.alpha_composite(bg, glow)


def rounded_icon(path, size):
    icon = Image.open(path).convert('RGBA').resize((size * 3, size * 3), Image.LANCZOS)
    mask = Image.new('L', icon.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, icon.width - 1, icon.height - 1], icon.width * 0.225, fill=255)
    icon.putalpha(mask)
    return icon.resize((size, size), Image.LANCZOS)


def build_hero(shots, icon_path):
    W, H = 3200, 1600
    c = soft_background((W, H))

    icon = rounded_icon(icon_path, 230)
    paste_with_shadow(c, icon, (230, 430), blur=22, offset=(0, 14), opacity=55)

    d = ImageDraw.Draw(c)
    d.text((230, 700), 'Historys', font=font('segoeuib.ttf', 210), fill=NAVY)
    d.text((236, 960), 'Une tus fotos y vídeos', font=font('segoeui.ttf', 84), fill=NAVY)
    d.text((236, 1066), 'en una sola historia.', font=font('segoeui.ttf', 84), fill=NAVY)
    d.text((236, 1250), 'Gratis  ·  Sin cuentas  ·  Código abierto', font=font('segoeui.ttf', 56), fill=MUTED)

    left = phone(shots['L_main'], 560)
    center = phone(shots['S_main'], 640)
    right = phone(shots['S_design'], 560)
    paste_with_shadow(c, left, (1500, 450))
    paste_with_shadow(c, right, (2480, 450))
    paste_with_shadow(c, center, (1990, 250), blur=40, offset=(0, 34), opacity=85)

    return c.convert('RGB')


def build_gallery(shots):
    items = [
        ('S_empty', 'Empieza sin complicaciones'),
        ('S_slot', 'Toca un hueco y ajústalo'),
        ('S_design', 'Elige la forma y el formato'),
        ('S_settings', 'Hazla a tu manera'),
    ]
    pw = 520
    gap = 80
    margin = 150
    W = margin * 2 + pw * len(items) + gap * (len(items) - 1) + 40
    ph_h = round((pw + 16) * 2340 / 1080)
    H = 140 + ph_h + 230
    c = soft_background((W, H))
    d = ImageDraw.Draw(c)
    cap = font('seguisb.ttf', 46)
    for i, (key, label) in enumerate(items):
        x = margin + i * (pw + gap + 10)
        ph = phone(shots[key], pw)
        paste_with_shadow(c, ph, (x, 120), blur=30, offset=(0, 22), opacity=60)
        tw = d.textlength(label, font=cap)
        d.text((x + (ph.width - tw) / 2, 120 + ph.height + 70), label, font=cap, fill=NAVY)
    return c.convert('RGB')


def main():
    src = sys.argv[1]
    os.makedirs(OUT, exist_ok=True)
    keys = ['S_empty', 'S_main', 'S_slot', 'S_design', 'S_settings', 'L_main', 'L_design']
    shots = {k: clean_screenshot(os.path.join(src, k + '.png')) for k in keys}
    icon_path = os.path.join(ROOT, '..', 'assets', 'icon.png')

    hero = build_hero(shots, icon_path)
    hero.resize((1600, 800), Image.LANCZOS).save(os.path.join(OUT, 'hero.png'), optimize=True)
    hero.resize((1280, 640), Image.LANCZOS).save(os.path.join(OUT, 'social-preview.png'), optimize=True)

    gallery = build_gallery(shots)
    gallery.resize((gallery.width // 2, gallery.height // 2), Image.LANCZOS).save(
        os.path.join(OUT, 'gallery.png'), optimize=True
    )
    print('ok')


if __name__ == '__main__':
    main()
