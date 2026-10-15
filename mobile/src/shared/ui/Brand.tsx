import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, space } from '../../styles/tokens';
import { BallMark } from './BallMark';
export function Brand() {
  return (
    <View style={styles.row}>
      <View style={styles.mark}>
        <BallMark size={30} />
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
