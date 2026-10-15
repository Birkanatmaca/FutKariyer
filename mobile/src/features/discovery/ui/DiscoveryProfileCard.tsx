import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  BadgeCheck,
  ChevronRight,
  UserRound,
  Shield,
} from 'lucide-react-native';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space } from '../../../styles/tokens';
import type { DiscoveryProfile } from '../domain/models';
import { ProBadge } from '../../../shared/ui/ProBadge';
export function DiscoveryProfileCard({
  profile,
  onPress,
}: {
  profile: DiscoveryProfile;
  onPress?(): void;
}) {
  const football = profile.playerProfile;
  const Icon = profile.role === 'club' ? Shield : UserRound;
  const content = (
    <>
      <View style={styles.identity}>
        <View style={styles.avatar}>
          <Icon color={colors.secondary} size={24} />
        </View>
        <View style={styles.heading}>
          <Text style={styles.role}>{copy.roles[profile.role]}</Text>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{profile.fullName}</Text>
            {profile.isPro ? <ProBadge /> : null}
          </View>
        </View>
        {onPress && <ChevronRight size={20} color={colors.muted} />}
      </View>
      {profile.verified && (
        <View style={styles.badge}>
          <BadgeCheck size={16} color={colors.success} />
          <Text style={styles.verified}>{copy.discover.verified}</Text>
        </View>
      )}
      {football && (
        <View style={styles.football}>
          <Text style={styles.position}>
            {football.position || copy.discover.noPosition}
          </Text>
          <Text style={styles.helper}>
            {copy.discover.experience(football.experienceYears)}
            {football.dominantFoot
              ? ' · ' + copy.playerProfile.feet[football.dominantFoot]
              : ''}
          </Text>
          <Text style={styles.helper}>
            {copy.football.types[football.footballType]}
          </Text>
          {football.licenseStatus !== 'unknown' ? (
            <Text style={styles.helper}>
              {copy.playerProfile.licenseDeclaration}:{' '}
              {copy.football.licenseStatuses[football.licenseStatus]}
            </Text>
          ) : null}
          <Text style={styles.availability}>
            {copy.playerProfile.availabilities[football.availability]}
          </Text>
        </View>
      )}
    </>
  );
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={copy.discover.openProfile(profile.fullName)}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  ) : (
    <View style={styles.card}>{content}</View>
  );
}
const styles = StyleSheet.create({
  card: {
    padding: space.xl,
    gap: space.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  pressed: { backgroundColor: colors.raised },
  identity: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: { flex: 1, gap: space.xs },
  role: { fontSize: 11, color: colors.muted },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  name: { fontSize: 18, fontWeight: '700', color: colors.text },
  badge: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  verified: { color: colors.success, fontSize: 12, fontWeight: '600' },
  football: {
    gap: space.sm,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  position: { color: colors.text, fontSize: 15, fontWeight: '600' },
  helper: { color: colors.secondary, fontSize: 13 },
  availability: {
    color: colors.secondary,
    fontSize: 12,
    alignSelf: 'flex-start',
    backgroundColor: colors.raised,
    borderRadius: radius.sm,
    padding: space.sm,
  },
});
