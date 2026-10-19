import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  Award,
  BriefcaseBusiness,
  ShieldCheck,
  Trophy,
  type LucideIcon,
} from 'lucide-react-native';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space, type } from '../../../styles/tokens';
import type {
  ClubCard,
  CoachProfile,
  PublicCoachProfile,
} from '../domain/models';

const text = copy.coaches;

function Row({
  icon: Icon,
  title,
  children,
}: React.PropsWithChildren<{ icon: LucideIcon; title: string }>) {
  return (
    <View style={styles.row}>
      <View style={styles.icon}>
        <Icon size={18} color={colors.brand} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{title}</Text>
        {children}
      </View>
    </View>
  );
}

// A coach's football details. Club links come from the clubs themselves and
// are marked as such; everything else is the coach's own declaration.
export function CoachFacts({
  profile,
  clubs,
  emptyText,
}: {
  profile: CoachProfile | PublicCoachProfile;
  clubs: ClubCard[];
  emptyText?: string;
}) {
  const license =
    profile.licenseLevel && profile.licenseLevel !== 'unknown'
      ? text.licenses[profile.licenseLevel]
      : '';
  const specialties = (profile.specialties ?? [])
    .map(item => text.specialties[item])
    .join(', ');
  const experience =
    profile.experienceYears !== undefined && profile.experienceYears > 0
      ? text.years(profile.experienceYears)
      : '';
  const footballType =
    profile.footballType && profile.footballType !== 'unknown'
      ? copy.football.types[profile.footballType]
      : '';
  const football = [
    footballType,
    profile.availability ? text.availabilities[profile.availability] : '',
  ].filter(Boolean);
  const pastClubs = profile.pastClubs ?? [];
  const showClubs = clubs.length > 0 || pastClubs.length > 0;
  const anything =
    license || specialties || experience || football.length || showClubs;
  if (!anything)
    return emptyText ? <Text style={styles.empty}>{emptyText}</Text> : null;
  return (
    <View style={styles.list}>
      {license ? (
        <Row icon={Award} title={text.license}>
          <Text style={styles.value}>{text.licenseLine(license)}</Text>
          <Text style={styles.note}>{text.declaration}</Text>
        </Row>
      ) : null}
      {specialties || experience ? (
        <Row icon={BriefcaseBusiness} title={text.specialtiesLabel}>
          {specialties ? <Text style={styles.value}>{specialties}</Text> : null}
          {experience ? <Text style={styles.note}>{experience}</Text> : null}
        </Row>
      ) : null}
      {football.length ? (
        <Row
          icon={Trophy}
          title={footballType ? text.visibility.football : text.availability}
        >
          <Text style={styles.value}>{football.join(' · ')}</Text>
        </Row>
      ) : null}
      {showClubs ? (
        <Row icon={ShieldCheck} title={text.clubsTitle}>
          <View style={styles.tags}>
            {clubs.map(item => (
              <View key={item.club.id} style={styles.verified}>
                <ShieldCheck size={13} color={colors.brand} />
                <Text style={styles.verifiedText}>
                  {item.club.fullName} · {text.specialties[item.role]}
                </Text>
              </View>
            ))}
            {pastClubs.map(name => (
              <Text key={name} style={styles.past}>
                {name}
              </Text>
            ))}
          </View>
          {clubs.length ? (
            <Text style={styles.note}>
              {text.clubVerified}
              {pastClubs.length ? ' · ' + text.declaration : ''}
            </Text>
          ) : pastClubs.length ? (
            <Text style={styles.note}>{text.declaration}</Text>
          ) : null}
        </Row>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.md },
  row: { flexDirection: 'row', gap: space.md },
  icon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.brandWash,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { ...type.caption, color: colors.muted },
  value: { color: colors.text, fontSize: 14, fontWeight: '600' },
  note: { ...type.caption, color: colors.secondary },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: 2 },
  verified: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.brandWash,
    borderWidth: 1,
    borderColor: colors.brandSoft,
  },
  verifiedText: { color: colors.brand, fontSize: 12, fontWeight: '700' },
  past: {
    color: colors.secondary,
    fontSize: 12,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.raised,
    overflow: 'hidden',
  },
  empty: { ...type.caption, color: colors.secondary },
});
