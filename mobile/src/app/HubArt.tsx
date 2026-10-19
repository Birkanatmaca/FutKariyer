import React from 'react';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Line,
  LinearGradient,
  Path,
  Polygon,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { BallMark } from '../shared/ui/BallMark';
import { colors } from '../styles/tokens';

// The centre hub of the tab bar (19 Oct 2026): four pages share the raised
// button, each with its own drawn object in the lit night-stadium style of the
// ball. The artworks have no backdrop, so they sit on any surface.
export type HubRoute = 'Social' | 'Profile' | 'Teams' | 'Games';
export const hubRoutes: readonly HubRoute[] = [
  'Social',
  'Profile',
  'Teams',
  'Games',
];
export function isHubRoute(name: string): name is HubRoute {
  return (hubRoutes as readonly string[]).includes(name);
}

type Art = (props: { size: number }) => React.JSX.Element;

// Sosyal keeps the brand ball.
function BallArt({ size }: { size: number }) {
  return <BallMark size={size} />;
}

// Profil: a lime football boot seen from the side, toe to the right, with a
// dark sole, metal studs, a dark side band, white laces and gloss.
function BootArt({ size }: { size: number }) {
  const upper =
    'M11 20 C9.5 27 9 33 9.2 40 L9.4 45 Q9.6 47 12 47 L54.5 47 C59.5 47 61.5 44.8 61 41.8 C60.5 38.8 57.5 37.2 53 36 L41 32.2 C36 30.6 32 27.4 29.4 23.4 L27.2 19.6 C21 17.4 15.5 17.6 11 20 Z';
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <Defs>
        <LinearGradient id="bootLime" x1="0.1" y1="0" x2="0.9" y2="1">
          <Stop offset="0" stopColor={colors.floodlight} />
          <Stop offset="0.4" stopColor={colors.brand} />
          <Stop offset="1" stopColor={colors.brandHover} />
        </LinearGradient>
        <LinearGradient id="bootShade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0.45" stopColor={colors.brandInk} stopOpacity={0} />
          <Stop offset="1" stopColor={colors.brandInk} stopOpacity={0.35} />
        </LinearGradient>
        <LinearGradient id="bootSole" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.border} />
          <Stop offset="1" stopColor={colors.brandInk} />
        </LinearGradient>
      </Defs>
      <G transform="translate(0 -3)">
        {[12.5, 20, 35, 43.5, 51.5].map(x => (
          <Rect
            key={x}
            x={x}
            y={50.6}
            width={3.8}
            height={3.4}
            rx={0.9}
            fill={colors.secondary}
            stroke={colors.brandInk}
            strokeWidth={0.6}
          />
        ))}
        <Path
          d="M8.6 46 L55 46 C60.5 46 62.4 47.4 61.8 49.4 C61.4 50.8 59.6 51.4 57 51.4 L11.4 51.4 C9.2 51.4 8.2 50.2 8.4 48.4 Z"
          fill="url(#bootSole)"
        />
        <Path d={upper} fill="url(#bootLime)" />
        <Path d={upper} fill="url(#bootShade)" />
        <Path
          d="M9.3 30 C12.5 29.5 15.5 31 16.5 35 L16.8 46.5 L9.4 46.5 Z"
          fill={colors.brandInk}
          fillOpacity={0.22}
        />
        <Path
          d="M13 41.5 C22 36.5 34 35.5 47 38.5 L46 41.5 C34 39 23 40 13.8 44.5 Z"
          fill={colors.brandInk}
          fillOpacity={0.85}
        />
        <Path
          d="M11.6 20.4 C16 18.6 21.5 18.4 26.6 20.2 C21 21.6 16 21.8 11.6 20.4 Z"
          fill={colors.brandInk}
          fillOpacity={0.85}
        />
        <Path
          d="M27.2 19.6 C29 21.5 33 26.5 41 32.2"
          fill="none"
          stroke={colors.brandInk}
          strokeOpacity={0.4}
          strokeWidth={1}
        />
        {[
          [27.8, 24.6, 31.2, 22.8],
          [30.4, 27.4, 33.8, 25.4],
          [33.4, 29.6, 36.8, 27.8],
          [36.8, 31.2, 40, 29.6],
        ].map(([x1, y1, x2, y2]) => (
          <Line
            key={x1}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={colors.text}
            strokeWidth={1.5}
            strokeLinecap="round"
          />
        ))}
        <Path
          d="M14.5 24 C18 21.6 22 21 25.5 21.8"
          fill="none"
          stroke={colors.text}
          strokeOpacity={0.6}
          strokeWidth={1.6}
          strokeLinecap="round"
        />
        <Ellipse
          cx={55}
          cy={39.5}
          rx={3.5}
          ry={1.4}
          fill={colors.text}
          fillOpacity={0.45}
          transform="rotate(15 55 39.5)"
        />
        <Path
          d={upper}
          fill="none"
          stroke={colors.brandInk}
          strokeOpacity={0.6}
          strokeWidth={1.2}
          strokeLinejoin="round"
        />
      </G>
    </Svg>
  );
}

// One floodlight tower behind the stands, with its beam falling on the pitch.
function Floodlight({ x, beam }: { x: number; beam: string }) {
  return (
    <>
      <Polygon points={beam} fill="url(#beam)" />
      <Line
        x1={x}
        y1={34}
        x2={x}
        y2={9}
        stroke={colors.secondary}
        strokeWidth={1.8}
      />
      <Circle cx={x} cy={7.2} r={6.5} fill="url(#lightGlow)" />
      <Rect
        x={x - 4.5}
        y={4.8}
        width={9}
        height={4.8}
        rx={1.2}
        fill={colors.floodlight}
        stroke={colors.brandInk}
        strokeOpacity={0.4}
        strokeWidth={0.6}
      />
    </>
  );
}

// Takımlar: a night stadium bowl with a lit pitch and two floodlight towers.
function StadiumArt({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <Defs>
        <LinearGradient id="beam" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.floodlight} stopOpacity={0.55} />
          <Stop offset="1" stopColor={colors.floodlight} stopOpacity={0} />
        </LinearGradient>
        <RadialGradient id="lightGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={colors.floodlight} stopOpacity={0.7} />
          <Stop offset="1" stopColor={colors.brand} stopOpacity={0} />
        </RadialGradient>
        <LinearGradient id="shell" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.secondary} />
          <Stop offset="1" stopColor={colors.muted} />
        </LinearGradient>
        <LinearGradient id="stands" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.border} />
          <Stop offset="1" stopColor={colors.overlay} />
        </LinearGradient>
        <LinearGradient id="pitch" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.brand} />
          <Stop offset="1" stopColor={colors.success} />
        </LinearGradient>
      </Defs>
      <Floodlight x={9} beam="7,9 11,9 30,36 18,39" />
      <Floodlight x={55} beam="53,9 57,9 46,39 34,36" />
      <Ellipse cx={32} cy={44} rx={28.5} ry={13.5} fill="url(#shell)" />
      <Ellipse
        cx={32}
        cy={44}
        rx={28.5}
        ry={13.5}
        fill={colors.brandInk}
        fillOpacity={0.35}
      />
      <Ellipse
        cx={32}
        cy={39.5}
        rx={28.5}
        ry={13.5}
        fill="url(#stands)"
        stroke={colors.secondary}
        strokeWidth={1.4}
      />
      {[
        [24.5, 11.2],
        [21, 9.3],
      ].map(([rx, ry]) => (
        <Ellipse
          key={rx}
          cx={32}
          cy={39.5}
          rx={rx}
          ry={ry}
          fill="none"
          stroke={colors.muted}
          strokeOpacity={0.6}
          strokeWidth={0.8}
        />
      ))}
      <Polygon
        points="19.5,34 44.5,34 48,45 16,45"
        fill="url(#pitch)"
        stroke={colors.text}
        strokeOpacity={0.85}
        strokeWidth={0.8}
      />
      <Polygon
        points="25.75,34 32,34 32,45 24,45"
        fill={colors.brandInk}
        fillOpacity={0.12}
      />
      <Polygon
        points="38.25,34 44.5,34 48,45 40,45"
        fill={colors.brandInk}
        fillOpacity={0.12}
      />
      <Line
        x1={32}
        y1={34}
        x2={32}
        y2={45}
        stroke={colors.text}
        strokeOpacity={0.85}
        strokeWidth={0.8}
      />
      <Ellipse
        cx={32}
        cy={39.5}
        rx={3.8}
        ry={1.9}
        fill="none"
        stroke={colors.text}
        strokeOpacity={0.85}
        strokeWidth={0.8}
      />
      <Path
        d="M5.5 41 Q32 58 58.5 41"
        fill="none"
        stroke={colors.text}
        strokeOpacity={0.35}
        strokeWidth={1.2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

// Oyunlar: an amber game pad with coloured face buttons.
function GamepadArt({ size }: { size: number }) {
  const body =
    'M19 17 H45 Q57 17 59.5 30 L61.5 41 Q62.5 49 56 50 Q51 51 47.5 45 L44.5 40 H19.5 L16.5 45 Q13 51 8 50 Q1.5 49 2.5 41 L4.5 30 Q7 17 19 17 Z';
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <Defs>
        <LinearGradient id="padShade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0.3" stopColor={colors.brandInk} stopOpacity={0} />
          <Stop offset="1" stopColor={colors.brandInk} stopOpacity={0.42} />
        </LinearGradient>
      </Defs>
      <Path d={body} fill={colors.warning} />
      <Path d={body} fill="url(#padShade)" />
      <Path
        d="M19 19.8 H45 Q53 19.8 56 26"
        fill="none"
        stroke={colors.text}
        strokeOpacity={0.45}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <Rect
        x={11}
        y={27}
        width={11}
        height={4.4}
        rx={1.3}
        fill={colors.brandInk}
      />
      <Rect
        x={14.3}
        y={23.7}
        width={4.4}
        height={11}
        rx={1.3}
        fill={colors.brandInk}
      />
      <Rect
        x={28}
        y={24}
        width={8}
        height={2.6}
        rx={1.3}
        fill={colors.brandInk}
        fillOpacity={0.55}
      />
      {[
        { cx: 47, cy: 23.6, fill: colors.brand },
        { cx: 52.2, cy: 28.8, fill: colors.accent },
        { cx: 47, cy: 34, fill: colors.info },
        { cx: 41.8, cy: 28.8, fill: colors.danger },
      ].map(button => (
        <Circle
          key={button.cx + '-' + button.cy}
          cx={button.cx}
          cy={button.cy}
          r={2.6}
          fill={button.fill}
          stroke={colors.brandInk}
          strokeWidth={1.1}
        />
      ))}
      <Path
        d={body}
        fill="none"
        stroke={colors.brandInk}
        strokeOpacity={0.5}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export const hubArt: Record<HubRoute, Art> = {
  Social: BallArt,
  Profile: BootArt,
  Teams: StadiumArt,
  Games: GamepadArt,
};
