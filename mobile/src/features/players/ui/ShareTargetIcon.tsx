import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';
import { Share2 } from 'lucide-react-native';
import { colors, partner } from '../../../styles/tokens';
import type { ShareTarget } from '../application/profile-share';

// App marks on the share targets, drawn in each app's own colours.
export function ShareTargetIcon({
  target,
  size,
}: {
  target: ShareTarget;
  size: number;
}) {
  if (target === 'instagramStory')
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
        <Defs>
          <LinearGradient id="instagramMark" x1="0" y1="1" x2="1" y2="0">
            {partner.instagram.map((color, index) => (
              <Stop
                key={color}
                offset={index / (partner.instagram.length - 1)}
                stopColor={color}
              />
            ))}
          </LinearGradient>
        </Defs>
        <Rect
          x={1}
          y={1}
          width={22}
          height={22}
          rx={6.5}
          fill="url(#instagramMark)"
        />
        <Rect
          x={5.6}
          y={5.6}
          width={12.8}
          height={12.8}
          rx={3.8}
          fill="none"
          stroke={colors.text}
          strokeWidth={1.8}
        />
        <Circle
          cx={12}
          cy={12}
          r={3}
          fill="none"
          stroke={colors.text}
          strokeWidth={1.8}
        />
        <Circle cx={15.9} cy={8.1} r={1} fill={colors.text} />
      </Svg>
    );
  if (target === 'whatsapp')
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
        <Circle cx={12} cy={12} r={11.5} fill={partner.whatsapp} />
        <Path
          d="M12 5.2 A6.8 6.8 0 1 1 8.6 17.9 L5.4 18.8 L6.3 15.8 A6.8 6.8 0 0 1 12 5.2 Z"
          fill="none"
          stroke={colors.text}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
        <Path
          d="M9.7 8.8 C10 8.3 10.3 8.3 10.6 8.3 L11.2 9.6 C11.3 9.8 11.2 10 11.1 10.2 L10.6 10.8 C11.2 12 12.1 12.9 13.3 13.5 L13.9 13 C14.1 12.9 14.3 12.8 14.5 12.9 L15.8 13.5 C15.8 13.8 15.8 14.1 15.2 14.4 C14.6 14.8 13.7 14.9 12.9 14.5 C11.3 13.8 10.1 12.6 9.4 11 C9 10.2 9.1 9.3 9.7 8.8 Z"
          fill={colors.text}
        />
      </Svg>
    );
  return (
    <View style={[styles.more, { width: size, height: size }]}>
      <Share2 size={size * 0.5} color={colors.text} strokeWidth={2.2} />
    </View>
  );
}

const styles = StyleSheet.create({
  more: {
    borderRadius: 999,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
