import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  Polygon,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { colors } from '../../../styles/tokens';
import { copy } from '../../../shared/lib/copy';
import { BallMark } from '../../../shared/ui/BallMark';
import type { OnboardingSlide } from '../domain/models';
import { MatchScene, StadiumScene } from './OnboardingScenes';

// Lit illustrations for the four intro slides, drawn on a 320 x 300 canvas
// from tokens. Light (floodlight beams, glows) is the only gradient use, as in
// the "night stadium" direction. Decorative: hidden from assistive tech.
const text = copy.onboarding.art;

export function OnboardingArt({
  slide,
  width,
}: {
  slide: OnboardingSlide;
  width: number;
}) {
  const Scene = scenes[slide];
  const scale = width / 320;
  const ball = balls[slide];
  return (
    <View
      style={{ width, height: 300 * scale }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={width} height={300 * scale} viewBox="0 0 320 300">
        <Light />
        <Scene />
      </Svg>
      {ball ? (
        // The brand football, the same drawing as the app icon.
        <View
          style={[
            styles.ball,
            {
              left: (ball.x - ball.r) * scale,
              top: (ball.y - ball.r) * scale,
            },
          ]}
        >
          <BallMark size={ball.r * 2 * scale} />
        </View>
      ) : null}
    </View>
  );
}

// Where each scene places the football (canvas units).
const balls: Partial<
  Record<OnboardingSlide, { x: number; y: number; r: number }>
> = {
  profile: { x: 246, y: 214, r: 20 },
  connect: { x: 160, y: 62, r: 19 },
  play: { x: 254, y: 252, r: 14 },
};

const styles = StyleSheet.create({ ball: { position: 'absolute' } });

// Shared gradients: floodlight beam, lime glow, jersey, glass and arcs.
function Light() {
  return (
    <Defs>
      <LinearGradient id="beam" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor={colors.floodlight} stopOpacity={0.34} />
        <Stop offset="0.7" stopColor={colors.brand} stopOpacity={0.06} />
        <Stop offset="1" stopColor={colors.brand} stopOpacity={0} />
      </LinearGradient>
      <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
        <Stop offset="0" stopColor={colors.brand} stopOpacity={0.55} />
        <Stop offset="1" stopColor={colors.brand} stopOpacity={0} />
      </RadialGradient>
      <RadialGradient id="glowSoft" cx="50%" cy="50%" r="50%">
        <Stop offset="0" stopColor={colors.brand} stopOpacity={0.22} />
        <Stop offset="1" stopColor={colors.brand} stopOpacity={0} />
      </RadialGradient>
      <RadialGradient id="tealGlow" cx="50%" cy="50%" r="50%">
        <Stop offset="0" stopColor={colors.accent} stopOpacity={0.4} />
        <Stop offset="1" stopColor={colors.accent} stopOpacity={0} />
      </RadialGradient>
      <LinearGradient id="jersey" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor={colors.floodlight} />
        <Stop offset="0.35" stopColor={colors.brand} />
        <Stop offset="1" stopColor={colors.brandHover} />
      </LinearGradient>
      <LinearGradient id="glass" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor={colors.overlay} stopOpacity={0.95} />
        <Stop offset="1" stopColor={colors.surface} stopOpacity={0.95} />
      </LinearGradient>
      <LinearGradient id="edge" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor={colors.brand} stopOpacity={0.9} />
        <Stop offset="1" stopColor={colors.accent} stopOpacity={0.5} />
      </LinearGradient>
      <LinearGradient id="pitch" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor={colors.brand} stopOpacity={0.05} />
        <Stop offset="1" stopColor={colors.brand} stopOpacity={0.22} />
      </LinearGradient>
      <LinearGradient id="sweep" x1="0" y1="0" x2="1" y2="0">
        <Stop offset="0" stopColor={colors.brand} stopOpacity={0} />
        <Stop offset="1" stopColor={colors.brand} stopOpacity={0.45} />
      </LinearGradient>
      <LinearGradient id="trophy" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor={colors.floodlight} />
        <Stop offset="0.5" stopColor={colors.brand} />
        <Stop offset="1" stopColor={colors.brandHover} />
      </LinearGradient>
    </Defs>
  );
}

function Sparkle({
  x,
  y,
  s,
  c,
}: {
  x: number;
  y: number;
  s: number;
  c: string;
}) {
  return (
    <Path
      d={`M${x} ${y - s} Q${x} ${y} ${x + s} ${y} Q${x} ${y} ${x} ${
        y + s
      } Q${x} ${y} ${x - s} ${y} Q${x} ${y} ${x} ${y - s} Z`}
      fill={c}
    />
  );
}

// A frosted chip floating in the scene, with a small icon drawn in it.
function GlassChip({
  x,
  y,
  w,
  label,
  icon,
}: {
  x: number;
  y: number;
  w: number;
  label?: string;
  icon: React.ReactNode;
}) {
  return (
    <G>
      <Rect
        x={x}
        y={y}
        width={w}
        height={34}
        rx={17}
        fill="url(#glass)"
        stroke={colors.hairline}
      />
      <Circle cx={x + 17} cy={y + 17} r={11} fill={colors.brandWash} />
      <G transform={`translate(${x + 17} ${y + 17})`}>{icon}</G>
      {label ? (
        <SvgText
          x={x + 34}
          y={y + 21.5}
          fontSize={12}
          fontWeight="700"
          fill={colors.text}
        >
          {label}
        </SvgText>
      ) : null}
    </G>
  );
}

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

// 1 · Your football identity: a lime jersey under the floodlight, with the
// things a profile carries (photo, video, position) floating around it.
function ProfileScene() {
  return (
    <G>
      <Polygon points="128,0 192,0 262,262 58,262" fill="url(#beam)" />
      <Ellipse cx={160} cy={256} rx={120} ry={20} fill="url(#glow)" />
      <Ellipse
        cx={160}
        cy={256}
        rx={70}
        ry={8}
        fill={colors.brand}
        opacity={0.35}
      />
      <Path
        d="M108 74 L136 60 Q160 78 184 60 L212 74 L246 108 L222 132 L208 120 L208 236 Q160 248 112 236 L112 120 L98 132 L74 108 Z"
        fill="url(#jersey)"
      />
      <Path
        d="M166 66 Q186 62 212 74 L246 108 L222 132 L208 120 L208 236 Q186 242 166 242 Z"
        fill={colors.brandInk}
        opacity={0.14}
      />
      <Path
        d="M134 62 Q160 92 186 62 Q160 80 134 62 Z"
        fill={colors.brandInk}
      />
      <Path
        d="M74 108 L98 132 M246 108 L222 132"
        stroke={colors.brandInk}
        strokeWidth={6}
        strokeLinecap="round"
        opacity={0.85}
      />
      <Rect
        x={136}
        y={96}
        width={10}
        height={140}
        fill={colors.brandInk}
        opacity={0.1}
      />
      <Rect
        x={174}
        y={96}
        width={10}
        height={146}
        fill={colors.brandInk}
        opacity={0.1}
      />
      <Shield
        x={186}
        y={104}
        s={9}
        fill={colors.brandInk}
        line={colors.brand}
      />
      <GlassChip
        x={8}
        y={50}
        w={86}
        label={text.position}
        icon={<Path d="M-5 3 L0 -5 L5 3 Z" fill={colors.brand} />}
      />
      <GlassChip
        x={226}
        y={42}
        w={34}
        icon={
          <G>
            <Rect
              x={-6}
              y={-4}
              width={12}
              height={9}
              rx={2}
              fill="none"
              stroke={colors.brand}
              strokeWidth={1.8}
            />
            <Circle cx={0} cy={0.5} r={2.2} fill={colors.brand} />
          </G>
        }
      />
      <GlassChip
        x={20}
        y={170}
        w={34}
        icon={<Polygon points="-3,-5 5,0 -3,5" fill={colors.brand} />}
      />
      <GlassChip
        x={190}
        y={152}
        w={126}
        label={text.available}
        icon={<Circle cx={0} cy={0} r={4} fill={colors.success} />}
      />
      <Sparkle x={66} y={34} s={6} c={colors.floodlight} />
      <Sparkle x={274} y={110} s={4} c={colors.brand} />
      <Sparkle x={40} y={140} s={4} c={colors.accent} />
    </G>
  );
}

// 3 · Connection: a request flies like a pass between player and club; once
// accepted, the line lights up and contact opens.
function ConnectScene() {
  const arc = 'M86 128 C110 34 210 34 234 128';
  return (
    <G>
      <Ellipse cx={160} cy={150} rx={150} ry={110} fill="url(#glowSoft)" />
      <Path
        d={arc}
        fill="none"
        stroke={colors.brand}
        strokeOpacity={0.18}
        strokeWidth={14}
        strokeLinecap="round"
      />
      <Path
        d={arc}
        fill="none"
        stroke="url(#edge)"
        strokeWidth={3.5}
        strokeLinecap="round"
      />
      <G transform="rotate(-8 86 180)">
        <Rect
          x={38}
          y={124}
          width={96}
          height={118}
          rx={20}
          fill="url(#glass)"
          stroke="url(#edge)"
          strokeWidth={1.5}
        />
        <Circle
          cx={86}
          cy={166}
          r={26}
          fill={colors.brandWash}
          stroke={colors.brand}
          strokeWidth={2.5}
        />
        <Person x={86} y={168} r={20} c={colors.brand} />
        <Rect
          x={60}
          y={204}
          width={52}
          height={7}
          rx={3.5}
          fill={colors.text}
          opacity={0.85}
        />
        <Rect x={68} y={218} width={36} height={6} rx={3} fill={colors.muted} />
      </G>
      <G transform="rotate(8 234 180)">
        <Rect
          x={186}
          y={124}
          width={96}
          height={118}
          rx={20}
          fill="url(#glass)"
          stroke="url(#edge)"
          strokeWidth={1.5}
        />
        <Circle cx={234} cy={166} r={26} fill={colors.accentWash} />
        <Shield
          x={234}
          y={164}
          s={19}
          fill={colors.overlay}
          line={colors.accent}
        />
        <Rect
          x={208}
          y={204}
          width={52}
          height={7}
          rx={3.5}
          fill={colors.text}
          opacity={0.85}
        />
        <Rect
          x={216}
          y={218}
          width={36}
          height={6}
          rx={3}
          fill={colors.muted}
        />
      </G>
      <Circle cx={160} cy={232} r={34} fill="url(#glow)" />
      <Circle cx={160} cy={232} r={20} fill={colors.brand} />
      <Path
        d="M151 232 L157.5 238.5 L170 225"
        fill="none"
        stroke={colors.brandInk}
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Rect
        x={110}
        y={268}
        width={100}
        height={28}
        rx={14}
        fill="url(#glass)"
        stroke={colors.hairline}
      />
      <Path
        d="M123 276 h14 v12 h-14 Z M123 276 l7 6 l7 -6"
        fill="none"
        stroke={colors.accent}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <SvgText
        x={145}
        y={286.5}
        fontSize={11}
        fontWeight="700"
        fill={colors.text}
      >
        {text.accepted}
      </SvgText>
      <Sparkle x={114} y={58} s={5} c={colors.floodlight} />
      <Sparkle x={212} y={50} s={4} c={colors.brand} />
      <Sparkle x={160} y={20} s={3.5} c={colors.accent} />
    </G>
  );
}

const scenes: Record<OnboardingSlide, () => React.JSX.Element> = {
  profile: ProfileScene,
  discover: MatchScene,
  connect: ConnectScene,
  play: StadiumScene,
};
