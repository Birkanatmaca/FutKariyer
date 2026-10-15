import React, { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { ImageOff } from 'lucide-react-native';
import { colors } from '../../../styles/tokens';
export function ContentImage({
  uri,
  label,
  contain = false,
}: {
  uri: string;
  label: string;
  contain?: boolean;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <View
      style={styles.frame}
      accessibilityRole="image"
      accessibilityLabel={label}
    >
      {failed === uri ? (
        <ImageOff size={28} color={colors.muted} />
      ) : (
        <Image
          source={{ uri }}
          resizeMode={contain ? 'contain' : 'cover'}
          style={styles.image}
          onError={() => setFailed(uri)}
        />
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  frame: {
    aspectRatio: 16 / 9,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
});
