import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Star } from 'lucide-react-native';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space, type } from '../../../styles/tokens';
import type { DiscoveryService } from '../application/discovery-service';
import { useWatchlist } from '../application/useWatchlist';
import type { DiscoveryProfile } from '../domain/models';

// The İzleme listesi star on a player's discovery profile (coaches only).
export function WatchButton({
  service,
  token,
  profile,
}: {
  service: DiscoveryService;
  token: string;
  profile: DiscoveryProfile;
}) {
  const list = useWatchlist(service, token);
  if (!list.loaded) return null;
  const on = list.watched(profile.id);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={on ? copy.scout.unwatch : copy.scout.watch}
      accessibilityState={{ selected: on }}
      onPress={() => list.toggle(profile)}
      style={({ pressed }) => [
        styles.button,
        on && styles.on,
        pressed && styles.pressed,
      ]}
    >
      <Star
        size={16}
        color={on ? colors.brandInk : colors.brand}
        fill={on ? colors.brandInk : 'transparent'}
      />
      <Text style={[styles.text, on && styles.textOn]}>
        {on ? copy.scout.watching : copy.scout.watch}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.brand,
    backgroundColor: colors.brandWash,
  },
  on: { backgroundColor: colors.brand },
  pressed: { opacity: 0.8 },
  text: { ...type.body, color: colors.brand, fontWeight: '800' },
  textOn: { color: colors.brandInk },
});
