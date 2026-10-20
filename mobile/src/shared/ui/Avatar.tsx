import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { colors, radius } from '../../styles/tokens';
import { useAvatarSource } from '../lib/avatar';

export function initialsOf(name: string) {
  const [first, second] = name.trim().split(/\s+/);
  return [first, second]
    .filter(Boolean)
    .map(part => Array.from(part)[0])
    .join('')
    .toLocaleUpperCase('tr-TR');
}

// Profile photo with an initials fallback (no photo, or it failed to load).
// Clubs use a rounded square, people a circle.
export function Avatar({
  name,
  uri,
  size,
  square = false,
  style,
}: {
  name: string;
  uri?: string;
  size: number;
  square?: boolean;
  style?: ViewStyle;
}) {
  const source = useAvatarSource(uri);
  const [failed, setFailed] = useState('');
  useEffect(() => setFailed(''), [uri]);
  const shape = {
    width: size,
    height: size,
    borderRadius: square ? Math.min(radius.sm, size / 3) : size / 2,
  };
  return (
    <View style={[styles.frame, shape, style]} accessibilityIgnoresInvertColors>
      {source && uri && failed !== uri ? (
        <Image
          source={source}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onError={() => setFailed(uri)}
        />
      ) : (
        <Text style={[styles.initials, { fontSize: Math.round(size * 0.34) }]}>
          {initialsOf(name)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.raised,
  },
  initials: { color: colors.text, fontWeight: '800' },
});
