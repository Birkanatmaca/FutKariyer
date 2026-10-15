import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../styles/tokens';

const initial = (name: string) =>
  Array.from(name.trim())[0]?.toLocaleUpperCase('tr-TR') ?? '?';

// Logos and photos come from the server payload; a missing or broken image
// falls back to the first letter of the name.
export function RemoteLogo({
  uri,
  name,
  size,
  round = false,
}: {
  uri: string;
  name: string;
  size: number;
  round?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  const shape = {
    width: size,
    height: size,
    borderRadius: round ? size / 2 : Math.round(size / 5),
  };
  if (!uri || failed || !/^https?:\/\//.test(uri))
    return (
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.fallback, shape]}
      >
        <Text style={[styles.letter, { fontSize: Math.round(size * 0.45) }]}>
          {initial(name)}
        </Text>
      </View>
    );
  return (
    <Image
      accessibilityIgnoresInvertColors
      source={{ uri }}
      resizeMode={round ? 'cover' : 'contain'}
      onError={() => setFailed(true)}
      style={shape}
    />
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: { color: colors.secondary, fontWeight: '800' },
});
