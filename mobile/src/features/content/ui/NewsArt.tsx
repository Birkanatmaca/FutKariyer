import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Line,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { BallMark } from '../../../shared/ui/BallMark';
import { colors } from '../../../styles/tokens';

const W = 320;
const H = 180;
export const newsArtCount = 3;

// Cover art for news that has no photo: three floodlit night scenes drawn from
// the app palette. The article id picks one, so the same story always looks the
// same and neighbours differ.
export function newsArtIndex(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) % 9973;
  }
  return hash % newsArtCount;
}

const confetti = [
  [44, 36, colors.brand],
  [92, 22, colors.accent],
  [236, 30, colors.info],
  [282, 64, colors.brand],
  [262, 128, colors.accent],
  [58, 118, colors.info],
  [130, 150, colors.brand],
] as const;

export function NewsArt({ id, width }: { id: string; width: number }) {
  const scale = width / W;
  const variant = newsArtIndex(id);
  const ball =
    variant === 0
      ? { x: 214, y: 78, size: 46 }
      : variant === 2
      ? { x: 186, y: 112, size: 30 }
      : null;
  return (
    <View style={styles.fill} pointerEvents="none">
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid slice"
      >
        <Defs>
          <LinearGradient id="newsBg" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.raised} />
            <Stop offset="1" stopColor={colors.bg} />
          </LinearGradient>
          <RadialGradient id="newsLight" cx="78%" cy="0%" r="75%">
            <Stop offset="0" stopColor={colors.floodlight} stopOpacity={0.5} />
            <Stop offset="0.45" stopColor={colors.brand} stopOpacity={0.16} />
            <Stop offset="1" stopColor={colors.brand} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="newsTeal" cx="12%" cy="100%" r="60%">
            <Stop offset="0" stopColor={colors.accent} stopOpacity={0.22} />
            <Stop offset="1" stopColor={colors.accent} stopOpacity={0} />
          </RadialGradient>
          <LinearGradient id="newsGold" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.floodlight} />
            <Stop offset="1" stopColor={colors.brand} />
          </LinearGradient>
        </Defs>
        <Rect width={W} height={H} fill="url(#newsBg)" />
        <Rect width={W} height={H} fill="url(#newsTeal)" />
        <Rect width={W} height={H} fill="url(#newsLight)" />
        {variant === 0 ? <Pitch /> : null}
        {variant === 1 ? <Trophy /> : null}
        {variant === 2 ? <Goal /> : null}
        {confetti.map(([x, y, fill], index) => (
          <Circle
            key={index}
            cx={x}
            cy={y}
            r={index % 2 ? 2 : 3}
            fill={fill}
            opacity={0.7}
          />
        ))}
      </Svg>
      {ball ? (
        <View
          style={[
            styles.ball,
            {
              left: (ball.x - ball.size / 2) * scale,
              top: (ball.y - ball.size / 2) * scale,
            },
          ]}
        >
          <BallMark size={ball.size * scale} />
        </View>
      ) : null}
    </View>
  );
}

// Pitch seen from the stand: halfway line, centre circle and a lit ball.
function Pitch() {
  return (
    <G stroke={colors.pitchLine} strokeWidth={2} fill="none">
      <Path d="M-10 150 L330 150" />
      <Ellipse cx={214} cy={150} rx={110} ry={34} />
      <Path d="M-10 120 L330 120" opacity={0.5} />
      <Line x1={214} y1={116} x2={214} y2={184} />
      <Ellipse cx={214} cy={110} rx={26} ry={9} opacity={0.6} />
    </G>
  );
}

// A cup on a podium with a ribbon of light behind it.
function Trophy() {
  return (
    <G>
      <Ellipse cx={214} cy={150} rx={86} ry={14} fill={colors.brandWash} />
      <Rect
        x={186}
        y={132}
        width={56}
        height={14}
        rx={4}
        fill={colors.overlay}
      />
      <Rect
        x={200}
        y={118}
        width={28}
        height={16}
        rx={3}
        fill={colors.border}
      />
      <Path
        d="M188 40 H240 V70 C240 92 228 108 214 112 C200 108 188 92 188 70 Z"
        fill="url(#newsGold)"
      />
      <Path
        d="M188 48 H172 C172 70 180 80 192 82 M240 48 H256 C256 70 248 80 236 82"
        stroke={colors.brand}
        strokeWidth={5}
        fill="none"
        strokeLinecap="round"
      />
      <Rect x={209} y={110} width={10} height={14} fill={colors.brand} />
      <Path
        d="M202 54 C202 76 208 90 214 98"
        stroke={colors.bg}
        strokeWidth={4}
        strokeLinecap="round"
        opacity={0.25}
        fill="none"
      />
    </G>
  );
}

// Goal frame with its net and a shot on the way in.
function Goal() {
  const posts = { left: 120, right: 270, top: 40, bottom: 150 };
  const lines: React.ReactNode[] = [];
  for (let x = posts.left + 15; x < posts.right; x += 15) {
    lines.push(
      <Line key={'v' + x} x1={x} y1={posts.top} x2={x} y2={posts.bottom} />,
    );
  }
  for (let y = posts.top + 16; y < posts.bottom; y += 16) {
    lines.push(
      <Line key={'h' + y} x1={posts.left} y1={y} x2={posts.right} y2={y} />,
    );
  }
  return (
    <G>
      <G stroke={colors.hairline} strokeWidth={1.5}>
        {lines}
      </G>
      <Path
        d={`M${posts.left} ${posts.bottom} V${posts.top} H${posts.right} V${posts.bottom}`}
        stroke={colors.text}
        strokeWidth={5}
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M40 172 C90 150 140 130 186 112"
        stroke={colors.brand}
        strokeWidth={3}
        strokeDasharray="2 8"
        strokeLinecap="round"
        fill="none"
        opacity={0.8}
      />
      <Path d="M-10 160 L330 160" stroke={colors.pitchLine} strokeWidth={2} />
    </G>
  );
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFillObject },
  ball: { position: 'absolute' },
});
