import React from 'react';
import { Image, type ImageSourcePropType } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
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
import { hubImages } from './hub-images';

// The centre hub of the tab bar (19 Oct 2026): four pages share the raised
// button, each with its own object artwork in the lit night-stadium style of
// the ball. The artworks have no backdrop, so they sit on any surface.
// Keşif (20 Oct 2026) is the coach's fifth page, between Takımlar and Oyunlar.
export type HubRoute = 'Social' | 'Profile' | 'Teams' | 'Scout' | 'Games';
export const hubRoutes: readonly HubRoute[] = [
  'Social',
  'Profile',
  'Teams',
  'Scout',
  'Games',
];
export function isHubRoute(name: string): name is HubRoute {
  return (hubRoutes as readonly string[]).includes(name);
}

type Art = (props: { size: number }) => React.JSX.Element;

// The idle hub ("Saha") shows the brand ball.
export function HubBallArt({ size }: { size: number }) {
  return <BallMark size={size} />;
}

// Sosyal and Profil are rendered 3D images (scripts/hub-art.py): a lime
// speech bubble with a like heart, and a player bust in the lime kit.
function imageArt(source: ImageSourcePropType): Art {
  return function RenderedArt({ size }: { size: number }) {
    return (
      <Image
        source={source}
        style={{ width: size, height: size }}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
    );
  };
}
const SocialArt = imageArt(hubImages.social);
const ProfileArt = imageArt(hubImages.profile);

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

// Keşif: teal scouting binoculars whose lenses glow with the pitch's lime.
function BinocularsArt({ size }: { size: number }) {
  const barrels = [
    { x: 7, lens: 17.5 },
    { x: 36, lens: 46.5 },
  ];
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <Defs>
        <LinearGradient id="scopeShade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0.25" stopColor={colors.brandInk} stopOpacity={0} />
          <Stop offset="1" stopColor={colors.brandInk} stopOpacity={0.45} />
        </LinearGradient>
        <RadialGradient id="scopeLens" cx="0.4" cy="0.35" r="0.75">
          <Stop offset="0" stopColor={colors.floodlight} />
          <Stop offset="0.45" stopColor={colors.brand} />
          <Stop offset="1" stopColor={colors.brandInk} />
        </RadialGradient>
      </Defs>
      <Rect x={26} y={22} width={12} height={12} rx={3} fill={colors.accent} />
      <Rect
        x={26}
        y={22}
        width={12}
        height={12}
        rx={3}
        fill="url(#scopeShade)"
      />
      {barrels.map(({ x, lens }) => (
        <React.Fragment key={x}>
          <Rect
            x={x + 4}
            y={9}
            width={13}
            height={9}
            rx={3}
            fill={colors.brandInk}
            stroke={colors.accent}
            strokeOpacity={0.6}
            strokeWidth={1.2}
          />
          <Rect
            x={x}
            y={16}
            width={21}
            height={32}
            rx={8}
            fill={colors.accent}
          />
          <Rect
            x={x}
            y={16}
            width={21}
            height={32}
            rx={8}
            fill="url(#scopeShade)"
          />
          <Path
            d={`M${x + 4} 22 Q${x + 4} 19 ${x + 7} 19`}
            fill="none"
            stroke={colors.text}
            strokeOpacity={0.5}
            strokeWidth={1.6}
            strokeLinecap="round"
          />
          <Circle cx={lens} cy={47} r={9} fill={colors.brandInk} />
          <Circle cx={lens} cy={47} r={6.4} fill="url(#scopeLens)" />
          <Circle
            cx={lens - 2.2}
            cy={44.6}
            r={1.5}
            fill={colors.text}
            fillOpacity={0.85}
          />
          <Rect
            x={x}
            y={16}
            width={21}
            height={32}
            rx={8}
            fill="none"
            stroke={colors.brandInk}
            strokeOpacity={0.5}
            strokeWidth={1.4}
          />
        </React.Fragment>
      ))}
    </Svg>
  );
}

export const hubArt: Record<HubRoute, Art> = {
  Social: SocialArt,
  Profile: ProfileArt,
  Teams: StadiumArt,
  Scout: BinocularsArt,
  Games: GamepadArt,
};
