# Generates the football drawing: a truncated icosahedron (the classic
# 12 pentagon / 20 hexagon football) projected orthographically, with per-panel
# lighting, on the brand lime. It is the app icon and the logo mark; the
# wordmark and lockups come from scripts/brand-svg.py.
#   python3 scripts/app-icon-svg.py assets/brand/app-icon.svg       -> app icon master
#   python3 scripts/app-icon-svg.py src/shared/ui/BallMark.tsx      -> in-app ball (same drawing)
import itertools, math, sys

PHI = (1 + 5 ** 0.5) / 2
CX, CY, R = 512, 486, 322
LIGHT = (-0.45, -0.62, 0.64)  # screen space: x right, y down, z towards viewer

def norm(v):
    l = math.sqrt(sum(c * c for c in v))
    return tuple(c / l for c in v)
def sub(a, b): return tuple(x - y for x, y in zip(a, b))
def add(a, b): return tuple(x + y for x, y in zip(a, b))
def mul(a, s): return tuple(x * s for x in a)
def dot(a, b): return sum(x * y for x, y in zip(a, b))

ico = []
for s1, s2 in itertools.product((1, -1), repeat=2):
    ico += [(0, s1, s2 * PHI), (s1, s2 * PHI, 0), (s2 * PHI, 0, s1)]
edges = [(i, j) for i in range(12) for j in range(i + 1, 12) if abs(math.dist(ico[i], ico[j]) - 2) < 1e-6]
faces = [(i, j, k) for i, j, k in itertools.combinations(range(12), 3)
         if all(abs(math.dist(ico[a], ico[b]) - 2) < 1e-6 for a, b in ((i, j), (j, k), (i, k)))]
def third(a, b, t): return add(ico[a], mul(sub(ico[b], ico[a]), t))
def ordered(points):
    c = norm(tuple(sum(p[i] for p in points) / len(points) for i in range(3)))
    ref = norm(sub(points[0], mul(c, dot(points[0], c))))
    other = (c[1] * ref[2] - c[2] * ref[1], c[2] * ref[0] - c[0] * ref[2], c[0] * ref[1] - c[1] * ref[0])
    return sorted(points, key=lambda p: math.atan2(dot(p, other), dot(p, ref)))

polys = []
for v in range(12):
    nbrs = [b if a == v else a for a, b in edges if v in (a, b)]
    polys.append(("pent", ordered([third(v, n, 1 / 3) for n in nbrs])))
for i, j, k in faces:
    pts = [third(i, j, 1 / 3), third(i, j, 2 / 3), third(j, k, 1 / 3), third(j, k, 2 / 3), third(k, i, 1 / 3), third(k, i, 2 / 3)]
    polys.append(("hex", ordered(pts)))

# Rotate so one pentagon faces the viewer, then tilt for a livelier angle.
front = norm(ico[0])
def rot_to_z(v):
    # rotation taking `front` to +z (Rodrigues)
    axis = (front[1], -front[0], 0.0)
    s = math.sqrt(dot(axis, axis)); c = front[2]
    if s < 1e-9: return v
    k = mul(axis, 1 / s)
    cross = (k[1] * v[2] - k[2] * v[1], k[2] * v[0] - k[0] * v[2], k[0] * v[1] - k[1] * v[0])
    return add(add(mul(v, c), mul(cross, s)), mul(k, dot(k, v) * (1 - c)))
def rot(v, ax, ay, az):
    x, y, z = v
    y, z = y * math.cos(ax) - z * math.sin(ax), y * math.sin(ax) + z * math.cos(ax)
    x, z = x * math.cos(ay) + z * math.sin(ay), -x * math.sin(ay) + z * math.cos(ay)
    x, y = x * math.cos(az) - y * math.sin(az), x * math.sin(az) + y * math.cos(az)
    return (x, y, z)
def place(v):
    v = rot(rot_to_z(norm(v)), math.radians(-9), math.radians(11), math.radians(6))
    return (v[0], -v[1], v[2])  # screen y down

TSX = sys.argv[1].endswith(".tsx")

def arc(a, b, steps=4 if TSX else 10):
    a, b = norm(a), norm(b)
    om = math.acos(max(-1, min(1, dot(a, b))))
    out = []
    for t in range(steps):
        f = t / steps
        if om < 1e-6: p = a
        else: p = add(mul(a, math.sin((1 - f) * om) / math.sin(om)), mul(b, math.sin(f * om) / math.sin(om)))
        out.append(p)
    return out
def project(p):
    x, y, z = place(p)
    if z < 0:  # behind the horizon: pin to the silhouette
        l = math.hypot(x, y) or 1
        x, y = x / l, y / l
    return (CX + R * x, CY + R * y)

shapes = []
for kind, pts in polys:
    centre = place(tuple(sum(p[i] for p in pts) / len(pts) for i in range(3)))
    if centre[2] < -0.25:
        continue
    outline = []
    for a, b in zip(pts, pts[1:] + pts[:1]):
        outline += arc(a, b)
    path = " ".join("%.1f,%.1f" % project(p) for p in outline)
    n = norm(centre)
    lit = max(0.0, dot(n, norm(LIGHT)))
    shapes.append((centre[2], kind, path, lit))
shapes.sort()

def shade(kind, lit):
    if kind == "pent":
        v = int(10 + 38 * lit)
        return "#%02x%02x%02x" % (v, v + 4, v - 2 if v > 2 else 0)
    v = int(196 + 59 * lit)
    return "#%02x%02x%02x" % (min(v, 255) - 4, min(v, 255) - 1, min(v, 255))

body = "\n    ".join('<polygon points="%s" fill="%s" stroke="%s" stroke-width="%s" stroke-linejoin="round"/>' % (
    path, shade(kind, lit), "#0A0F08" if kind == "pent" else "#2A3226", 7 if kind == "pent" else 5) for _, kind, path, lit in shapes)

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <!-- Fut Career app icon: a lit football on the brand lime. Generated master file
       by mobile/scripts/app-icon-svg.py; PNG sizes come from it.
       Full bleed: iOS and Android mask the corners. -->
  <defs>
    <radialGradient id="field" cx="50%" cy="36%" r="78%">
      <stop offset="0" stop-color="#D2FB97"/>
      <stop offset="0.5" stop-color="#B6F36A"/>
      <stop offset="1" stop-color="#7CC63A"/>
    </radialGradient>
    <radialGradient id="volume" cx="38%" cy="32%" r="72%">
      <stop offset="0.5" stop-color="#0B1206" stop-opacity="0"/>
      <stop offset="0.85" stop-color="#0B1206" stop-opacity="0.18"/>
      <stop offset="1" stop-color="#0B1206" stop-opacity="0.5"/>
    </radialGradient>
    <radialGradient id="shine" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.9"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="bounce" cx="50%" cy="100%" r="60%">
      <stop offset="0" stop-color="#B6F36A" stop-opacity="0.2"/>
      <stop offset="1" stop-color="#B6F36A" stop-opacity="0"/>
    </radialGradient>
    <filter id="blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="20"/></filter>
    <clipPath id="ball"><circle cx="{CX}" cy="{CY}" r="{R}"/></clipPath>
  </defs>
  <rect width="1024" height="1024" fill="url(#field)"/>
  <ellipse cx="{CX + 18}" cy="{CY + R + 52}" rx="{R * 0.74:.0f}" ry="38" fill="#2F6512" opacity="0.45" filter="url(#blur)"/>
  <circle cx="{CX}" cy="{CY}" r="{R}" fill="#F2F5F7"/>
  <g clip-path="url(#ball)">
    {body}
    <circle cx="{CX}" cy="{CY}" r="{R}" fill="url(#volume)"/>
    <circle cx="{CX}" cy="{CY}" r="{R}" fill="url(#bounce)"/>
    <ellipse cx="{CX - R * 0.34:.0f}" cy="{CY - R * 0.44:.0f}" rx="{R * 0.36:.0f}" ry="{R * 0.2:.0f}" fill="url(#shine)" transform="rotate(-32 {CX - R * 0.34:.0f} {CY - R * 0.44:.0f})"/>
  </g>
  <circle cx="{CX}" cy="{CY}" r="{R}" fill="none" stroke="#0B1206" stroke-opacity="0.5" stroke-width="5"/>
</svg>
'''
if not TSX:
    open(sys.argv[1], "w").write(svg)
    print("faces drawn:", len(shapes))
    sys.exit()

# In-app ball: the same panels and lighting without the field and floor shadow,
# as react-native-svg elements cropped to the ball.
def fmt(path):
    return " ".join("%.0f,%.0f" % tuple(map(float, p.split(","))) for p in path.split())
panels = "\n".join(
    '      <Polygon points="%s" fill="%s" stroke="%s" strokeWidth={%d} strokeLinejoin="round" />'
    % (fmt(path), shade(kind, lit), "#0A0F08" if kind == "pent" else "#2A3226", 7 if kind == "pent" else 5)
    for _, kind, path, lit in shapes)
hx, hy = CX - R * 0.34, CY - R * 0.44
tsx = f"""import React from 'react';
import Svg, {{
  Circle,
  ClipPath,
  Defs,
  Ellipse,
  G,
  Polygon,
  RadialGradient,
  Stop,
}} from 'react-native-svg';

// Generated by mobile/scripts/app-icon-svg.py from the app icon geometry; do not edit by hand.
// The Fut Career ball: the app icon, the logo mark and the Social tab button share it.
export function BallMark({{ size }}: {{ size: number }}) {{
  return (
    <Svg
      width={{size}}
      height={{size}}
      viewBox="{CX - R - 4} {CY - R - 4} {2 * R + 8} {2 * R + 8}"
      aria-hidden
    >
      <Defs>
        <RadialGradient id="ballVolume" cx="38%" cy="32%" r="72%">
          <Stop offset="0.5" stopColor="#0B1206" stopOpacity={{0}} />
          <Stop offset="0.85" stopColor="#0B1206" stopOpacity={{0.18}} />
          <Stop offset="1" stopColor="#0B1206" stopOpacity={{0.5}} />
        </RadialGradient>
        <RadialGradient id="ballShine" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={{0.9}} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={{0}} />
        </RadialGradient>
        <ClipPath id="ballClip">
          <Circle cx={{{CX}}} cy={{{CY}}} r={{{R}}} />
        </ClipPath>
      </Defs>
      <Circle cx={{{CX}}} cy={{{CY}}} r={{{R}}} fill="#F2F5F7" />
      <G clipPath="url(#ballClip)">
{panels}
        <Circle cx={{{CX}}} cy={{{CY}}} r={{{R}}} fill="url(#ballVolume)" />
        <Ellipse
          cx={{{hx:.0f}}}
          cy={{{hy:.0f}}}
          rx={{{R * 0.36:.0f}}}
          ry={{{R * 0.2:.0f}}}
          fill="url(#ballShine)"
          transform="rotate(-32 {hx:.0f} {hy:.0f})"
        />
      </G>
      <Circle
        cx={{{CX}}}
        cy={{{CY}}}
        r={{{R}}}
        fill="none"
        stroke="#0B1206"
        strokeOpacity={{0.55}}
        strokeWidth={{8}}
      />
    </Svg>
  );
}}
"""
open(sys.argv[1], "w").write(tsx)
print("ball mark written:", len(shapes), "panels")
