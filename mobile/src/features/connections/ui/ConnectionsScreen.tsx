import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { MessagesSquare } from 'lucide-react-native';
import { Screen } from '../../../shared/ui/Screen';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { Button } from '../../../shared/ui/Button';
import { copy } from '../../../shared/lib/copy';
import { colors } from '../../../styles/tokens';
export function ConnectionsScreen({ onDiscover }: { onDiscover(): void }) {
  return (
    <Screen>
      <Text style={styles.eyebrow}>{copy.connections.eyebrow}</Text>
      <Text style={styles.title}>{copy.connections.title}</Text>
      <EmptyState
        icon={MessagesSquare}
        title={copy.connections.emptyTitle}
        body={copy.connections.emptyBody}
      />
      <Button label={copy.connections.button} onPress={onDiscover} secondary />
    </Screen>
  );
}
const styles = StyleSheet.create({
  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.muted,
    letterSpacing: 1.5,
  },
  title: {
    fontSize: 35,
    lineHeight: 41,
    color: colors.text,
    fontWeight: '800',
    letterSpacing: -1.2,
  },
});
