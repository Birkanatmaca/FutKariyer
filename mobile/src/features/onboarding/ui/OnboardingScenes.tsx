import React from 'react';
import {
  Circle,
  Ellipse,
  G,
  Line,
  Path,
  Polygon,
  Rect,
  Text as SvgText,
} from 'react-native-svg';
import { colors } from '../../../styles/tokens';
import { copy } from '../../../shared/lib/copy';

// Slides 2 and 4 of the intro (canvas 320 x 300, gradients from OnboardingArt).
const text = copy.onboarding.art;

function Person({
  x,
  y,
  r,
  c,
}: {
  x: number;
  y: number;
  r: number;
  c: string;
}) {
  return (
    <G>
      <Circle cx={x} cy={y - r * 0.28} r={r * 0.36} fill={c} />
      <Path
        d={`M${x - r * 0.72} ${y + r * 0.78} Q${x} ${y - r * 0.05} ${
          x + r * 0.72
        } ${y + r * 0.78} Z`}
        fill={c}
      />
    </G>
  );
}

function Shield({
  x,
  y,
  s,
  fill,
  line,
}: {
  x: number;
  y: number;
  s: number;
  fill: string;
  line: string;
}) {
  return (
    <G>
      <Path
        d={`M${x} ${y - s} L${x + s * 0.86} ${y - s * 0.62} V${y + s * 0.08} C${
          x + s * 0.86
        } ${y + s * 0.62} ${x + s * 0.42} ${y + s * 0.9} ${x} ${
          y + s * 1.06
        } C${x - s * 0.42} ${y + s * 0.9} ${x - s * 0.86} ${y + s * 0.62} ${
          x - s * 0.86
        } ${y + s * 0.08} V${y - s * 0.62} Z`}
        fill={fill}
        stroke={line}
        strokeWidth={s * 0.1}
      />
      <Path
        d={`M${x - s * 0.42} ${y + s * 0.12} L${x} ${y - s * 0.26} L${
          x + s * 0.42
        } ${y + s * 0.12} M${x - s * 0.42} ${y + s * 0.5} L${x} ${
          y + s * 0.12
        } L${x + s * 0.42} ${y + s * 0.5}`}
        fill="none"
        stroke={line}
        strokeWidth={s * 0.14}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </G>
  );
}

function Check({
  x,
  y,
  r,
  bg,
  fg,
}: {
  x: number;
  y: number;
  r: number;
  bg: string;
  fg: string;
}) {
  return (
    <G>
      <Circle cx={x} cy={y} r={r} fill={bg} />
      <Path
        d={`M${x - r * 0.45} ${y} L${x - r * 0.1} ${y + r * 0.35} L${
          x + r * 0.5
        } ${y - r * 0.35}`}
        fill="none"
        stroke={fg}
        strokeWidth={r * 0.28}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </G>
  );
}

// Perspective pitch: x across 0..1 and y down 0..1 mapped onto the trapezoid
// far edge (y=96, x 92..228) to near edge (y=286, x 20..300).
const FAR = 96,
  NEAR = 286;
function onPitch(u: number, v: number): [number, number] {
  const y = FAR + (NEAR - FAR) * v;
  const half = 68 + (140 - 68) * v;
  return [160 + (u - 0.5) * 2 * half, y];
}
function depth(v: number) {
  return 0.7 + 0.5 * v;
}

// The club's line-up (u, v on the pitch); the left winger's spot is open.
const lineup: [number, number][] = [
  [0.5, 0.94],
  [0.16, 0.76],
  [0.38, 0.79],
  [0.62, 0.79],
  [0.84, 0.76],
  [0.3, 0.55],
  [0.5, 0.6],
  [0.7, 0.55],
  [0.5, 0.26],
  [0.82, 0.3],
];
const OPEN: [number, number] = [0.18, 0.3];

// 2 · Matching: the club's formation has an open position; a player who
// plays exactly there is matched into it.
export function MatchScene() {
  const [ox, oy] = onPitch(...OPEN);
  const line = { stroke: colors.brand, strokeOpacity: 0.32, strokeWidth: 1.4 };
  const [hx1, hy] = onPitch(0, 0.5);
  const [hx2] = onPitch(1, 0.5);
  const [bx1, by1] = onPitch(0.25, 0);
  const [bx2] = onPitch(0.75, 0);
  const [bx3, by2] = onPitch(0.3, 0.13);
  const [bx4] = onPitch(0.7, 0.13);
  return (
    <G>
      <Polygon
        points="104,0 216,0 296,270 24,270"
        fill="url(#beam)"
        opacity={0.55}
      />
      {/* pitch with mowing stripes */}
      <Path
        d={`M20 ${NEAR} L92 ${FAR} H228 L300 ${NEAR} Z`}
        fill="url(#pitch)"
      />
      {[0, 1, 2, 3, 4].map(i => {
        const [a1, y1] = onPitch(0, i * 0.2 + 0.1);
        const [a2] = onPitch(1, i * 0.2 + 0.1);
        const [b1, y2] = onPitch(0, i * 0.2 + 0.2);
        const [b2] = onPitch(1, i * 0.2 + 0.2);
        return (
          <Polygon
            key={i}
            points={`${a1},${y1} ${a2},${y1} ${b2},${y2} ${b1},${y2}`}
            fill={colors.brand}
            opacity={0.05}
          />
        );
      })}
      <Path
        d={`M20 ${NEAR} L92 ${FAR} H228 L300 ${NEAR} Z`}
        fill="none"
        {...line}
      />
      <Line x1={hx1} y1={hy} x2={hx2} y2={hy} {...line} />
      <Ellipse cx={160} cy={hy} rx={30} ry={11} fill="none" {...line} />
      <Path
        d={`M${bx1} ${by1} L${bx3} ${by2} H${bx4} L${bx2} ${by1}`}
        fill="none"
        {...line}
      />
      {/* the club at the far goal */}
      <Ellipse cx={160} cy={74} rx={34} ry={14} fill="url(#tealGlow)" />
      <Shield
        x={160}
        y={66}
        s={18}
        fill={colors.overlay}
        line={colors.accent}
      />
      {/* line-up */}
      {lineup.map(([u, v]) => {
        const [x, y] = onPitch(u, v);
        const k = depth(v);
        return (
          <G key={u + ':' + v}>
            <Ellipse
              cx={x}
              cy={y + 5 * k}
              rx={8 * k}
              ry={2.6 * k}
              fill={colors.brandInk}
              opacity={0.55}
            />
            <Circle cx={x} cy={y} r={6 * k} fill={colors.accent} />
            <Circle
              cx={x}
              cy={y}
              r={6 * k}
              fill="none"
              stroke={colors.text}
              strokeOpacity={0.5}
              strokeWidth={1}
            />
          </G>
        );
      })}
      {/* the open position, lit */}
      <Ellipse cx={ox} cy={oy} rx={30} ry={12} fill="url(#glow)" />
      <Ellipse
        cx={ox}
        cy={oy}
        rx={15}
        ry={6}
        fill="none"
        stroke={colors.brand}
        strokeWidth={2}
        strokeDasharray="4 3"
      />
      <Ellipse
        cx={ox}
        cy={oy}
        rx={24}
        ry={9.5}
        fill="none"
        stroke={colors.brand}
        strokeOpacity={0.4}
        strokeWidth={1.2}
      />
      {/* the player card flying in */}
      <Path
        d={`M210 104 C172 116 126 112 ${ox + 4} ${oy - 14}`}
        fill="none"
        stroke={colors.brand}
        strokeOpacity={0.18}
        strokeWidth={10}
        strokeLinecap="round"
      />
      <Path
        d={`M210 104 C172 116 126 112 ${ox + 4} ${oy - 14}`}
        fill="none"
        stroke="url(#edge)"
        strokeWidth={2.5}
        strokeDasharray="6 5"
        strokeLinecap="round"
      />
      <Polygon
        points={`${ox - 3},${oy - 22} ${ox + 9},${oy - 18} ${ox + 1},${oy - 9}`}
        fill={colors.brand}
      />
      <G transform="rotate(6 258 64)">
        <Rect
          x={206}
          y={12}
          width={104}
          height={104}
          rx={18}
          fill="url(#glass)"
          stroke="url(#edge)"
          strokeWidth={1.5}
        />
        <Circle
          cx={258}
          cy={44}
          r={20}
          fill={colors.brandWash}
          stroke={colors.brand}
          strokeWidth={2}
        />
        <Person x={258} y={46} r={15} c={colors.brand} />
        <Rect
          x={222}
          y={74}
          width={72}
          height={22}
          rx={11}
          fill={colors.brand}
        />
        <SvgText
          x={258}
          y={89}
          fontSize={11}
          fontWeight="800"
          textAnchor="middle"
          fill={colors.brandInk}
        >
          {text.wing}
        </SvgText>
      </G>
      {/* matched */}
      <G>
        <Rect
          x={8}
          y={106}
          width={94}
          height={30}
          rx={15}
          fill="url(#glass)"
          stroke={colors.brand}
          strokeOpacity={0.6}
        />
        <Check x={25} y={121} r={9} bg={colors.brand} fg={colors.brandInk} />
        <SvgText
          x={40}
          y={125.5}
          fontSize={12}
          fontWeight="800"
          fill={colors.text}
        >
          {text.match}
        </SvgText>
      </G>
    </G>
  );
}

// Stadium crowd: rows of dots along the stands.
const crowd = Array.from({ length: 3 }, (_, row) =>
  Array.from({ length: 22 }, (__, i) => {
    const a = Math.PI * (0.06 + (0.88 * i) / 21);
    const rx = 150 - row * 16,
      ry = 92 - row * 14;
    return [160 - Math.cos(a) * rx, 128 - Math.sin(a) * ry, row] as const;
  }),
).flat();

const confetti: [number, number, string, number][] = [
  [100, 44, colors.brand, 14],
  [218, 50, colors.accent, -20],
  [124, 22, colors.warning, 32],
  [196, 18, colors.brand, -10],
  [236, 84, colors.info, 24],
  [86, 80, colors.accent, -28],
  [146, 8, colors.info, 40],
  [178, 36, colors.warning, -36],
];

// 4 · Your pitch: the podium under the floodlights with the trophy on top,
// the crowd in the stands, your league table and social post beside it.
export function StadiumScene() {
  return (
    <G>
      {/* stands */}
      {crowd.map(([x, y, row]) => (
        <Circle
          key={x.toFixed(1) + ':' + y.toFixed(1)}
          cx={x}
          cy={y}
          r={2.6 - row * 0.4}
          fill={row === 1 ? colors.accent : colors.secondary}
          opacity={0.22 + row * 0.08}
        />
      ))}
      {/* floodlights */}
      <Polygon points="30,4 54,4 196,250 118,250" fill="url(#beam)" />
      <Polygon points="266,4 290,4 202,250 124,250" fill="url(#beam)" />
      <Circle cx={42} cy={6} r={24} fill="url(#glow)" />
      <Circle cx={278} cy={6} r={24} fill="url(#glow)" />
      {/* floor glow */}
      <Ellipse
        cx={160}
        cy={264}
        rx={150}
        ry={26}
        fill="url(#glow)"
        opacity={0.7}
      />
      {/* podium: second, first, third */}
      <G>
        <Rect x={78} y={208} width={50} height={58} fill={colors.overlay} />
        <Polygon points="78,208 128,208 136,200 86,200" fill={colors.raised} />
        <SvgText
          x={103}
          y={244}
          fontSize={20}
          fontWeight="900"
          textAnchor="middle"
          fill={colors.muted}
        >
          2
        </SvgText>
        <Rect x={192} y={222} width={50} height={44} fill={colors.overlay} />
        <Polygon
          points="192,222 242,222 250,214 200,214"
          fill={colors.raised}
        />
        <SvgText
          x={217}
          y={252}
          fontSize={20}
          fontWeight="900"
          textAnchor="middle"
          fill={colors.muted}
        >
          3
        </SvgText>
        <Rect x={128} y={182} width={64} height={84} fill={colors.raised} />
        <Polygon points="128,182 192,182 200,174 136,174" fill="url(#trophy)" />
        <Rect
          x={128}
          y={182}
          width={64}
          height={84}
          fill={colors.brand}
          opacity={0.08}
        />
        <SvgText
          x={160}
          y={228}
          fontSize={26}
          fontWeight="900"
          textAnchor="middle"
          fill={colors.brand}
        >
          1
        </SvgText>
      </G>
      {/* trophy */}
      <Circle cx={166} cy={138} r={56} fill="url(#glow)" />
      <G transform="translate(-6 10)">
        <Path
          d="M142 90 H190 V112 C190 130 180 140 166 140 C152 140 142 130 142 112 Z"
          fill="url(#trophy)"
        />
        <Path
          d="M142 97 H130 C130 113 137 120 146 120 M190 97 H202 C202 113 195 120 186 120"
          fill="none"
          stroke={colors.brand}
          strokeWidth={4.5}
          strokeLinecap="round"
        />
        <Rect x={160} y={140} width={12} height={14} fill={colors.brandHover} />
        <Rect
          x={149}
          y={154}
          width={34}
          height={10}
          rx={3}
          fill={colors.brand}
        />
        <Path
          d="M154 98 Q156 120 166 126"
          fill="none"
          stroke={colors.floodlight}
          strokeWidth={3}
          strokeLinecap="round"
          opacity={0.85}
        />
      </G>
      {/* league table card */}
      <G transform="rotate(-6 54 150)">
        <Rect
          x={6}
          y={110}
          width={96}
          height={86}
          rx={14}
          fill="url(#glass)"
          stroke={colors.hairline}
        />
        <Shield
          x={22}
          y={128}
          s={7}
          fill={colors.overlay}
          line={colors.accent}
        />
        <Rect
          x={34}
          y={124}
          width={48}
          height={6}
          rx={3}
          fill={colors.text}
          opacity={0.85}
        />
        {[0, 1, 2].map(i => (
          <G key={i}>
            <Rect
              x={14}
              y={142 + i * 16}
              width={80}
              height={13}
              rx={5}
              fill={i === 0 ? colors.brandWash : colors.transparent}
            />
            <Circle
              cx={22}
              cy={148.5 + i * 16}
              r={4}
              fill={i === 0 ? colors.brand : colors.border}
            />
            <Rect
              x={32}
              y={146 + i * 16}
              width={[38, 32, 28][i]}
              height={5}
              rx={2.5}
              fill={i === 0 ? colors.text : colors.muted}
            />
            <Rect
              x={78}
              y={146 + i * 16}
              width={10}
              height={5}
              rx={2.5}
              fill={i === 0 ? colors.brand : colors.border}
            />
          </G>
        ))}
      </G>
      {/* social post card */}
      <G transform="rotate(6 266 140)">
        <Rect
          x={218}
          y={98}
          width={96}
          height={86}
          rx={14}
          fill="url(#glass)"
          stroke={colors.hairline}
        />
        <Circle
          cx={236}
          cy={116}
          r={8}
          fill={colors.brandWash}
          stroke={colors.brand}
          strokeWidth={1.5}
        />
        <Rect
          x={248}
          y={113}
          width={46}
          height={6}
          rx={3}
          fill={colors.text}
          opacity={0.85}
        />
        <Rect
          x={228}
          y={132}
          width={76}
          height={26}
          rx={7}
          fill={colors.overlay}
        />
        <Polygon points="262,139 272,145 262,151" fill={colors.brand} />
        <Path
          d="M234 171 l-5 -4.5 c-2.8 -2.8 1 -7.4 5 -3.6 c4 -3.8 7.8 0.8 5 3.6 Z"
          fill={colors.danger}
        />
        <Path
          d="M252 164 h14 v8 h-8 l-4 3 v-3 h-2 Z"
          fill="none"
          stroke={colors.secondary}
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
      </G>
      {confetti.map(([x, y, c, r]) => (
        <Rect
          key={x + ':' + y}
          x={x}
          y={y}
          width={8}
          height={3.6}
          rx={1}
          fill={c}
          transform={`rotate(${r} ${x} ${y})`}
        />
      ))}
    </G>
  );
}
