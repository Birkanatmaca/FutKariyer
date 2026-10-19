"""Renders the centre-hub artworks that are 3D images rather than SVG.

Sosyal (a glossy lime speech bubble with a red like heart) and Profil (a player
bust in the lime kit) are ray-marched signed-distance scenes with key, fill and
rim light, specular gloss and ambient occlusion, written as transparent PNGs in
the app palette. Run it after changing a scene:

    python scripts/hub-art.py

Needs numpy and Pillow. Output: assets/hub/<name>.png, @2x and @3x.
"""

import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'assets', 'hub')
RENDER = 576  # supersampled render size; downsampled for each density
BASE = 64  # @1x size in px


def hex_color(value):
    value = value.lstrip('#')
    rgb = np.array([int(value[i:i + 2], 16) for i in (0, 2, 4)], float) / 255
    return rgb ** 2.2  # linear light


# Palette from src/styles/tokens.ts.
BRAND = hex_color('#B6F36A')
BRAND_DEEP = hex_color('#7FCB2E')
FLOODLIGHT = hex_color('#E9FFD2')
INK = hex_color('#0B1206')
DANGER = hex_color('#FF6B72')
TEXT = hex_color('#F4F7FA')


# --- SDF helpers (vectorised over N points) ---------------------------------

def length(v):
    return np.sqrt(np.sum(v * v, axis=-1))


def rot_x(p, deg):
    a = np.radians(deg)
    c, s = np.cos(a), np.sin(a)
    x, y, z = p[:, 0], p[:, 1], p[:, 2]
    return np.stack([x, c * y - s * z, s * y + c * z], -1)


def rot_y(p, deg):
    a = np.radians(deg)
    c, s = np.cos(a), np.sin(a)
    x, y, z = p[:, 0], p[:, 1], p[:, 2]
    return np.stack([c * x + s * z, y, -s * x + c * z], -1)


def rot_z(p, deg):
    a = np.radians(deg)
    c, s = np.cos(a), np.sin(a)
    x, y, z = p[:, 0], p[:, 1], p[:, 2]
    return np.stack([c * x - s * y, s * x + c * y, z], -1)


def smin(a, b, k):
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0, 1)
    return b * (1 - h) + a * h - k * h * (1 - h)


def sd_sphere(p, c, r):
    return length(p - np.array(c)) - r


def sd_round_box2(p2, half, r):
    q = np.abs(p2) - (np.array(half) - r)
    return length(np.maximum(q, 0)) + np.minimum(np.max(q, -1), 0) - r


def sd_segment2(p2, a, b):
    a, b = np.array(a), np.array(b)
    pa, ba = p2 - a, b - a
    h = np.clip(np.sum(pa * ba, -1) / np.dot(ba, ba), 0, 1)
    return length(pa - ba * h[:, None])


def sd_heart2(p2):
    # Inigo Quilez's 2D heart, tip at the origin, about 1.2 tall.
    x = np.abs(p2[:, 0])
    y = p2[:, 1]
    upper = np.sqrt((x - 0.25) ** 2 + (y - 0.75) ** 2) - np.sqrt(2) / 4
    m = 0.5 * np.maximum(x + y, 0)
    d1 = x * x + (y - 1) ** 2
    d2 = (x - m) ** 2 + (y - m) ** 2
    lower = np.sqrt(np.minimum(d1, d2)) * np.sign(x - y)
    return np.where(y + x > 1, upper, lower)


def puff(d2, z, depth, r):
    """Extrudes a 2D shape into a soft pillow `depth` deep with edges rounded
    by r; the silhouette stays the 2D shape (it is eroded before rounding)."""
    w = np.stack([d2 + r, np.abs(z) - depth], -1)
    return np.minimum(np.max(w, -1), 0) + length(np.maximum(w, 0)) - r


def sd_capsule(p, a, b, r):
    a, b = np.array(a), np.array(b)
    pa, ba = p - a, b - a
    h = np.clip(np.sum(pa * ba, -1) / np.dot(ba, ba), 0, 1)
    return length(pa - ba * h[:, None]) - r


# --- Scenes: each returns (distance, material id) ---------------------------

def sd_taper2(p2, a, b, ra, rb):
    """A 2D segment whose radius shrinks from ra at a to rb at b."""
    a, b = np.array(a), np.array(b)
    pa, ba = p2 - a, b - a
    h = np.clip(np.sum(pa * ba, -1) / np.dot(ba, ba), 0, 1)
    return length(pa - ba * h[:, None]) - (ra + (rb - ra) * h)


def social(p):
    # Bubble: a rounded panel with a tapering tail, turned to the viewer.
    b = rot_x(rot_y(p - np.array([-0.12, 0.16, 0]), -16), 6)
    panel = sd_round_box2(b[:, :2], (1.12, 0.84), 0.5)
    tail = sd_taper2(b[:, :2], (-0.42, -0.5), (-0.78, -1.14), 0.3, 0.06)
    bubble = puff(smin(panel, tail, 0.16), b[:, 2], 0.2, 0.24)
    # Typing dots pressed into the front face.
    dots = np.minimum.reduce([
        sd_sphere(b, (x, 0.06, 0.4), 0.13) for x in (-0.46, 0.0, 0.46)
    ])
    # Heart: puffy, in front and to the lower right.
    h = rot_z(rot_y(p - np.array([0.55, -0.5, 0.55]), 18), -10) / 0.7
    heart = puff(sd_heart2(h[:, :2] + np.array([0, 0.6])), h[:, 2], 0.16, 0.26)
    heart = heart * 0.7
    d = np.minimum.reduce([bubble, dots, heart])
    mat = np.where(d == heart, 2, np.where(d == dots, 1, 0))
    return d, mat


def profile(p):
    # Lifted so the whole bust sits centred in the frame.
    q = rot_y(p - np.array([0, 0.4, 0]), -12)
    hq = (q - np.array([0, 0.2, 0])) / np.array([1, 1.08, 1])
    head = (length(hq) - 0.42) * 0.95
    # Hair covers the crown and back; the hairline rises towards the face.
    hair = np.maximum(
        sd_sphere(q, (0, 0.24, -0.03), 0.45),
        -(q[:, 1] - 0.31 - 0.55 * q[:, 2]),
    )
    neck = sd_capsule(q, (0, -0.4, -0.02), (0, 0.05, -0.02), 0.17)
    # Shoulders: a bell-shaped pillow cut flat at the bottom of the bust.
    torso2 = sd_round_box2(q[:, :2] - np.array([0, -1.0]), (0.98, 0.62), 0.55)
    torso = puff(torso2, q[:, 2] / 0.8, 0.26, 0.3)
    torso = np.maximum(torso, -(q[:, 1] + 1.42))
    front = q[:, 2] - 0.4
    # V collar and "10", raised a little from the shirt front.
    chest = q[:, :2]
    vee = np.minimum(
        sd_segment2(chest, (-0.26, -0.4), (0, -0.7)),
        sd_segment2(chest, (0.26, -0.4), (0, -0.7)),
    ) - 0.05
    one = sd_segment2(chest, (-0.16, -1.2), (-0.16, -0.86)) - 0.052
    zero = np.abs(
        length((chest - np.array([0.1, -1.03])) / np.array([0.105, 0.17])) - 1
    ) * 0.1 - 0.042
    marks2 = np.minimum(vee, np.minimum(one, zero))
    marks = np.maximum(marks2, torso - 0.03)
    marks = np.maximum(marks, -front - 0.2)
    skin = smin(head, neck, 0.07)
    d = np.minimum.reduce([skin, hair, torso, marks])
    mat = np.select([d == marks, d == hair, d == torso], [1, 1, 0], default=3)
    return d, mat


SCENES = {
    'social': (social, {0: BRAND, 1: INK, 2: DANGER}, 1.4),
    'profile': (profile, {0: BRAND, 1: INK, 3: TEXT}, 1.26),
}


# --- Renderer ----------------------------------------------------------------

def normal(scene, p):
    e = 0.0015
    n = np.zeros_like(p)
    for i in range(3):
        o = np.zeros(3)
        o[i] = e
        n[:, i] = scene(p + o)[0] - scene(p - o)[0]
    return n / np.maximum(length(n)[:, None], 1e-9)


def occlusion(scene, p, n):
    occ = np.zeros(len(p))
    w = 1.0
    for i in range(1, 6):
        h = 0.04 * i
        occ += w * (h - scene(p + n * h)[0])
        w *= 0.7
    return np.clip(1 - 2.2 * occ, 0, 1)


def render(name):
    scene, palette, extent = SCENES[name]
    size = RENDER
    lin = np.linspace(extent, -extent, size)
    ys, xs = np.meshgrid(lin, -lin, indexing='ij')
    ro = np.stack([xs.ravel(), ys.ravel(), np.full(xs.size, 4.0)], -1)
    rd = np.array([0, 0, -1.0])
    t = np.zeros(len(ro))
    hit = np.zeros(len(ro), bool)
    alive = np.ones(len(ro), bool)
    for _ in range(140):
        idx = np.nonzero(alive)[0]
        if not len(idx):
            break
        d = scene(ro[idx] + rd * t[idx, None])[0]
        t[idx] += d * 0.9
        hit[idx[d < 4e-4]] = True
        alive[idx[(d < 4e-4) | (t[idx] > 8)]] = False
    rgba = np.zeros((len(ro), 4))
    idx = np.nonzero(hit)[0]
    p = ro[idx] + rd * t[idx, None]
    _, mat = scene(p)
    n = normal(lambda q: scene(q), p)
    ao = occlusion(scene, p, n)
    view = -rd
    key = np.array([-0.55, 0.7, 0.55])
    key /= np.linalg.norm(key)
    fill = np.array([0.7, 0.1, 0.6])
    fill /= np.linalg.norm(fill)
    rim = np.array([0.2, 0.5, -0.9])
    rim /= np.linalg.norm(rim)
    base = np.zeros((len(idx), 3))
    for m, color in palette.items():
        base[mat == m] = color
    # Lime surfaces run from brand lime on top to a deeper lime underneath.
    lime = mat == 0
    rise = np.clip(0.75 + 0.35 * n[lime, 1] + 0.1 * p[lime, 1], 0, 1)[:, None]
    base[lime] = BRAND_DEEP * (1 - rise) + BRAND * rise
    gloss = np.where(mat == 1, 0.35, 1.0)[:, None]
    dkey = np.clip(np.sum(n * key, -1), 0, 1)[:, None]
    dfill = np.clip(np.sum(n * fill, -1), 0, 1)[:, None]
    sky = (0.5 + 0.5 * n[:, 1])[:, None]
    half = key + view
    half /= np.linalg.norm(half)
    spec = np.clip(np.sum(n * half, -1), 0, 1) ** 60
    fres = (1 - np.clip(np.sum(n * view, -1), 0, 1)) ** 3
    rim_l = np.clip(np.sum(n * rim, -1), 0, 1) ** 2 * fres
    a = ao[:, None]
    color = base * (0.95 * dkey + 0.28 * dfill + 0.22 * sky * a)
    color *= 0.55 + 0.45 * a
    color += gloss * (0.85 * spec[:, None] + 0.35 * rim_l[:, None] * FLOODLIGHT)
    color += gloss * 0.06 * fres[:, None]
    rgba[idx, :3] = np.clip(color, 0, 1) ** (1 / 2.2)
    rgba[idx, 3] = 1
    img = (rgba.reshape(size, size, 4) * 255).round().astype(np.uint8)
    return Image.fromarray(img, 'RGBA')


def main(names):
    os.makedirs(OUT, exist_ok=True)
    for name in names:
        big = render(name).convert('RGBa')
        for scale, suffix in ((1, ''), (2, '@2x'), (3, '@3x')):
            px = BASE * scale
            small = big.resize((px, px), Image.LANCZOS).convert('RGBA')
            small.save(os.path.join(OUT, f'{name}{suffix}.png'), optimize=True)
        print('rendered', name)


if __name__ == '__main__':
    main(sys.argv[1:] or list(SCENES))
