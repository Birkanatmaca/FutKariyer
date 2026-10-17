import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Compass,
  Search,
  ShieldPlus,
  type LucideIcon,
} from 'lucide-react-native';
import { copy } from '../shared/lib/copy';
import { colors, radius, space, type } from '../styles/tokens';

type Action = {
  key: 'teams' | 'leagues' | 'discover';
  icon: LucideIcon;
  tint: string;
  wash: string;
};

// Same tones as the profile card counters so the home screen reads as one set.
const actions: Action[] = [
  {
    key: 'teams',
    icon: ShieldPlus,
    tint: colors.brand,
    wash: colors.brandSoft,
  },
  {
    key: 'leagues',
    icon: Search,
    tint: colors.accent,
    wash: colors.accentWash,
  },
  { key: 'discover', icon: Compass, tint: colors.info, wash: colors.infoWash },
];

// Three side-by-side shortcuts under the news: find a team, search a league,
// discover profiles.
export function HomeQuickActions({
  onTeams,
  onLeagues,
  onDiscover,
}: {
  onTeams(): void;
  onLeagues(): void;
  onDiscover(): void;
}) {
  const handlers = { teams: onTeams, leagues: onLeagues, discover: onDiscover };
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.title}>
        {copy.home.quickTitle}
      </Text>
      <View style={styles.row}>
        {actions.map(({ key, icon: Icon, tint, wash }) => (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityLabel={copy.home.quick[key]}
            onPress={handlers[key]}
            style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
          >
            <View style={[styles.icon, { backgroundColor: wash }]}>
              <Icon size={22} color={tint} strokeWidth={2.1} />
            </View>
            <Text numberOfLines={1} style={styles.label}>
              {copy.home.quick[key]}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.md },
  title: { color: colors.text, fontSize: 19, fontWeight: '700' },
  row: { flexDirection: 'row', gap: space.sm },
  tile: {
    flex: 1,
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  icon: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...type.caption,
    fontSize: 13,
    color: colors.text,
    fontWeight: '700',
  },
});
