import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowUpRight, Compass } from 'lucide-react-native';
import { useAuth } from '../features/auth';
import { Screen } from '../shared/ui/Screen';
import { Brand } from '../shared/ui/Brand';
import { PitchArt } from '../shared/ui/PitchArt';
import { Button } from '../shared/ui/Button';
import { copy } from '../shared/lib/copy';
import { colors, radius, space } from '../styles/tokens';
export function HomeScreen({
  onProfile,
  onDiscover,
}: {
  onProfile(): void;
  onDiscover(): void;
}) {
  const { user } = useAuth();
  const displayName =
    user?.role === 'club' ? user.fullName : user?.fullName.split(' ')[0];
  return (
    <Screen>
      <View style={styles.top}>
        <Brand />
        <Pressable
          onPress={onProfile}
          accessibilityRole="button"
          accessibilityLabel={copy.home.profileButton}
          style={styles.avatar}
        >
          <Text style={styles.initial}>
            {user?.fullName.charAt(0).toLocaleUpperCase('tr-TR')}
          </Text>
        </Pressable>
      </View>
      <View style={styles.welcome}>
        <Text style={styles.eyebrow}>{copy.home.greeting}</Text>
        <Text style={styles.name}>{displayName}</Text>
      </View>
      <View style={styles.hero}>
        <View style={styles.art}>
          <PitchArt width={185} height={214} />
        </View>
        <View style={styles.tag}>
          <Text style={styles.tagText}>{copy.home.tag}</Text>
        </View>
        <Text accessibilityRole="header" style={styles.title}>
          {copy.home.title}
        </Text>
        <Text style={styles.body}>
          {user?.role === 'player' ? copy.home.body : copy.home.networkBody}
        </Text>
        <Button label={copy.home.profileButton} onPress={onProfile} />
      </View>
      <View style={styles.network}>
        <Text style={styles.eyebrow}>{copy.home.shortcuts}</Text>
        <View style={styles.profileSummary}>
          <Text style={styles.cardTitle}>
            {user?.role === 'player'
              ? copy.home.profileTitle
              : copy.home.accountTitle}
          </Text>
          <Text style={styles.cardBody}>
            {user?.role === 'player'
              ? copy.home.profileBody
              : copy.home.accountBody}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={onDiscover}
          style={({ pressed }) => [styles.discovery, pressed && styles.pressed]}
        >
          <View style={styles.discoveryIcon}>
            <Compass size={24} color={colors.brand} />
          </View>
          <View style={styles.discoveryCopy}>
            <Text style={styles.cardTitle}>{copy.home.networkTitle}</Text>
            <Text style={styles.cardBody}>{copy.home.networkBody}</Text>
          </View>
          <ArrowUpRight color={colors.secondary} size={20} />
        </Pressable>
      </View>
    </Screen>
  );
}
const styles = StyleSheet.create({
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  avatar: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  },
  initial: { color: colors.text, fontSize: 16, fontWeight: '700' },
  welcome: { gap: space.sm },
  eyebrow: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.6,
    color: colors.muted,
  },
  name: {
    fontSize: 30,
    lineHeight: 38,
    color: colors.text,
    fontWeight: '800',
    letterSpacing: -1.1,
  },
  hero: {
    padding: space.xl,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    minHeight: 260,
    gap: space.lg,
  },
  art: {
    position: 'absolute',
    right: -70,
    top: -30,
    opacity: 0.5,
    transform: [{ rotate: '10deg' }],
  },
  tag: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  tagText: {
    fontSize: 10,
    color: colors.brand,
    letterSpacing: 1.5,
    fontWeight: '700',
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -1,
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.secondary,
    maxWidth: 300,
  },
  cardTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    color: colors.text,
  },
  cardBody: { fontSize: 13, lineHeight: 20, color: colors.secondary },
  network: { gap: space.lg },
  profileSummary: {
    gap: space.xs,
    paddingBottom: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  discovery: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    minHeight: 80,
  },
  discoveryIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discoveryCopy: { flex: 1, gap: space.xs },
  pressed: { opacity: 0.7 },
});
