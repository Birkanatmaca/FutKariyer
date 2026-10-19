import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GamesScreen } from '../features/games';
import { Wordmark } from '../shared/ui/Wordmark';
import { copy } from '../shared/lib/copy';
import { colors, space } from '../styles/tokens';

// Oyunlar is its own hub page (19 Oct 2026); it used to be a tab inside Sosyal.
export function GamesTab({ token }: { token: string }) {
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
      <View
        accessible
        accessibilityRole="header"
        accessibilityLabel={copy.brand}
        style={styles.brand}
      >
        <Wordmark height={26} />
      </View>
      <GamesScreen token={token} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  brand: {
    alignItems: 'center',
    paddingTop: space.md,
    paddingBottom: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
});
