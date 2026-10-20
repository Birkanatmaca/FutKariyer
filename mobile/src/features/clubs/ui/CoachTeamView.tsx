import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  ArrowLeftRight,
  ChevronRight,
  ClipboardList,
  Mail,
  ShieldCheck,
  Trophy,
  UsersRound,
  type LucideIcon,
} from 'lucide-react-native';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { avatarUrl } from '../../../shared/lib/avatar';
import { copy } from '../../../shared/lib/copy';
import { useFocusedResource } from '../../../shared/lib/useFocusedResource';
import { colors, radius, shadow, space, type } from '../../../styles/tokens';
import type { ClubService } from '../application/club-service';
import type { CoachTeam, CoachTeams } from '../domain/models';
import { ClubCrest } from './ClubCrest';
import { ClubLeagueCarousel } from './ClubLeagueCarousel';
import { sessionError } from './ClubPrimitives';

const text = copy.coachTeam;

// Takımım (20 Oct 2026): every club the coach works for — the club and the
// coach's role, the squad and waiting work, the club's league card and the
// switch into the club account.
export function CoachTeamView({
  token,
  service,
  onSwitch,
  onInvitations,
  onLeagues,
  now,
}: {
  token: string | null;
  service: ClubService;
  onSwitch(clubId: string): Promise<void>;
  onInvitations(): void;
  onLeagues(): void;
  // Fixed clock for tests.
  now?: number;
}) {
  const state = useFocusedResource(
    useCallback(
      () => (token ? service.coachTeams(token) : sessionError()),
      [service, token],
    ),
  );
  const [last, setLast] = useState<CoachTeams | null>(null);
  useEffect(() => {
    if (state.data) setLast(state.data);
  }, [state.data]);
  const data = state.data ?? (state.loading ? last : null);
  if (state.error && !data)
    return (
      <View style={styles.stack}>
        <ErrorBanner message={state.error} />
        <Button label={copy.form.retry} secondary onPress={state.retry} />
      </View>
    );
  if (!data)
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.brand} />
        <Text style={styles.muted}>{text.loading}</Text>
      </View>
    );
  return (
    <View style={styles.stack}>
      {data.invitations ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={text.invitations(data.invitations)}
          accessibilityHint={text.invitationsHint}
          onPress={onInvitations}
          style={({ pressed }) => [styles.invite, pressed && styles.pressed]}
        >
          <View style={styles.inviteIcon}>
            <Mail size={16} color={colors.brandInk} />
          </View>
          <Text style={styles.inviteText}>
            {text.invitations(data.invitations)}
          </Text>
          <ChevronRight size={18} color={colors.brand} />
        </Pressable>
      ) : null}
      {data.teams.map(team => (
        <TeamBlock
          key={team.clubId}
          team={team}
          onSwitch={onSwitch}
          onLeagues={onLeagues}
          now={now}
        />
      ))}
    </View>
  );
}

function TeamBlock({
  team,
  onSwitch,
  onLeagues,
  now,
}: {
  team: CoachTeam;
  onSwitch(clubId: string): Promise<void>;
  onLeagues(): void;
  now?: number;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const crest = avatarUrl(team.clubId, team.avatarVersion) || undefined;
  const role = copy.coaches.specialties[team.role] ?? team.role;
  const rights = team.permissions.length
    ? team.permissions
        .map(key => copy.coaches.permissions[key] ?? key)
        .join(', ')
    : text.noRights;
  async function go() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await onSwitch(team.clubId);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : copy.coaches.switchFailed,
      );
      setBusy(false);
    }
  }
  const stats: { icon: LucideIcon; label: string; value: number }[] = [
    { icon: UsersRound, label: text.squad, value: team.squadCount },
  ];
  if (team.permissions.includes('applications'))
    stats.push({
      icon: ClipboardList,
      label: text.applications,
      value: team.pendingApplications,
    });
  return (
    <View style={styles.stack}>
      <View style={styles.card}>
        <View style={styles.top}>
          <ClubCrest name={team.clubName} uri={crest} own size={58} />
          <View style={styles.title}>
            <Text style={styles.eyebrow}>{text.eyebrow}</Text>
            <Text
              accessibilityRole="header"
              numberOfLines={1}
              style={styles.name}
            >
              {team.clubName}
            </Text>
            <Text numberOfLines={1} style={styles.meta}>
              {[role, team.district].filter(Boolean).join(' · ')}
            </Text>
          </View>
        </View>
        <View style={styles.strip}>
          {stats.map(({ icon: Icon, label, value }, index) => (
            <View
              key={label}
              accessible
              accessibilityLabel={label + ': ' + value}
              style={[styles.cell, index > 0 && styles.divider]}
            >
              <Icon size={15} color={colors.brand} />
              <Text style={styles.value}>{value}</Text>
              <Text numberOfLines={1} style={styles.label}>
                {label}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.rights}>
          <ShieldCheck size={14} color={colors.muted} />
          <Text style={styles.rightsText}>
            {text.rights}: {rights}
          </Text>
        </View>
        {error ? <ErrorBanner message={error} /> : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={text.switch}
          accessibilityHint={text.switchHint}
          disabled={busy}
          onPress={go}
          style={({ pressed }) => [
            styles.switch,
            (pressed || busy) && styles.pressed,
          ]}
        >
          {busy ? (
            <ActivityIndicator color={colors.brandInk} />
          ) : (
            <ArrowLeftRight size={16} color={colors.brandInk} />
          )}
          <Text style={styles.switchText}>{text.switch}</Text>
        </Pressable>
      </View>
      {team.league ? (
        <ClubLeagueCarousel
          league={team.league}
          clubName={team.clubName}
          avatarUri={crest}
          onLeagues={onLeagues}
          now={now}
        />
      ) : (
        <View style={styles.card}>
          <View style={styles.emptyIcon}>
            <Trophy size={18} color={colors.brand} />
          </View>
          <Text style={styles.emptyTitle}>
            {team.tffLinked
              ? copy.clubHome.match.standingsTitle
              : text.noLeagueTitle}
          </Text>
          <Text style={styles.muted}>
            {team.tffLinked ? copy.clubHome.match.tffDown : text.noLeagueBody}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.lg },
  loading: {
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  muted: { ...type.body, color: colors.muted },
  pressed: { opacity: 0.75 },
  invite: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.brand,
    backgroundColor: colors.brandWash,
  },
  inviteIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
  },
  inviteText: { ...type.body, flex: 1, color: colors.text, fontWeight: '700' },
  card: {
    padding: space.lg,
    gap: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    ...shadow.layer,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  title: { flex: 1, gap: 2 },
  eyebrow: { ...type.eyebrow, color: colors.brand },
  name: { ...type.title, fontSize: 22, lineHeight: 28, color: colors.text },
  meta: { ...type.caption, color: colors.muted },
  strip: {
    flexDirection: 'row',
    borderRadius: radius.md,
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  cell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
  },
  divider: { borderLeftWidth: 1, borderLeftColor: colors.hairline },
  value: {
    ...type.number,
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  label: { ...type.caption, flexShrink: 1, color: colors.muted },
  rights: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xs },
  rightsText: { ...type.caption, flex: 1, color: colors.secondary },
  switch: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
  },
  switchText: { ...type.body, color: colors.brandInk, fontWeight: '800' },
  emptyIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandWash,
  },
  emptyTitle: { ...type.headline, color: colors.text },
});
