import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Rect } from 'react-native-svg';
import { colors, radius, space } from '../../styles/tokens';
export function Brand() {
  return (
    <View style={styles.row}>
      <View style={styles.mark}>
        <Svg width={27} height={27} viewBox="0 0 28 28">
          <Rect
            x={4}
            y={3}
            width={20}
            height={22}
            rx={3}
            fill="none"
            stroke={colors.brandInk}
            strokeWidth={1.8}
          />
          <Line
            x1={4}
            y1={14}
            x2={24}
            y2={14}
            stroke={colors.brandInk}
            strokeWidth={1.8}
          />
          <Circle
            cx={14}
            cy={14}
            r={4}
            fill="none"
            stroke={colors.brandInk}
            strokeWidth={1.8}
          />
        </Svg>
      </View>
      <Text style={styles.word}>
        FUT<Text style={styles.second}> CAREER</Text>
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  mark: {
    width: 42,
    height: 42,
    borderRadius: radius.sm,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  word: {
    fontSize: 18,
    letterSpacing: 1.1,
    fontWeight: '900',
    color: colors.text,
  },
  second: { fontWeight: '400', color: colors.secondary },
});
