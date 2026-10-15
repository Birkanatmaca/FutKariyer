import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  ArrowLeft,
  CalendarDays,
  MapPin,
  RefreshCw,
  Shield,
} from 'lucide-react-native';
import { Screen } from '../../../shared/ui/Screen';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { Button } from '../../../shared/ui/Button';
import { copy } from '../../../shared/lib/copy';
import { useFocusedResource } from '../../../shared/lib/useFocusedResource';
import { colors, radius, space } from '../../../styles/tokens';
import { createTeamsService } from '../application/teams-service';
import { teamsRepository } from '../data/http-teams-repository';

const service = createTeamsService(teamsRepository);

export function TeamDetailScreen({
  token,
  id,
  onBack,
}: {
  token: string;
  id: string;
  onBack(): void;
}) {
  const load = useCallback(() => service.detail(token, id), [token, id]);
  const state = useFocusedResource(load);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [actionError, setActionError] = useState('');
  async function sendRequest() {
    if (submitting) return;
    setSubmitting(true);
    setMessage('');
    setActionError('');
    try {
      await service.request(token, id);
      setMessage(copy.teams.requestSent);
      state.retry();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : copy.form.unexpected,
      );
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <Screen>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copy.teams.back}
        onPress={onBack}
        style={styles.back}
      >
        <ArrowLeft size={18} color={colors.text} />
        <Text style={styles.backText}>{copy.teams.back}</Text>
      </Pressable>
      {state.loading ? (
        <ActivityIndicator color={colors.brand} />
      ) : state.error ? (
        <>
          <ErrorBanner message={state.error} />
          <Button label={copy.form.retry} onPress={state.retry} />
        </>
      ) : state.data ? (
        <>
          <View style={styles.hero}>
            <View style={styles.badge}>
              <Shield size={28} color={colors.brand} />
            </View>
            <Text style={styles.eyebrow}>{copy.teams.profileEyebrow}</Text>
            <Text style={styles.name}>{state.data.team.name}</Text>
            {state.data.team.footballType !== 'unknown' ? (
              <Text style={styles.teamType}>
                {copy.football.types[state.data.team.footballType]}
              </Text>
            ) : null}
            {state.data.team.district ? (
              <View style={styles.location}>
                <MapPin size={15} color={colors.secondary} />
                <Text style={styles.secondary}>{state.data.team.district}</Text>
              </View>
            ) : null}
          </View>
          {state.data.team.description ? (
            <InfoCard
              title={copy.teams.about}
              body={state.data.team.description}
            />
          ) : null}
          <InfoCard
            title={copy.teams.venue}
            body={[state.data.team.venueName, state.data.team.venueAddress]
              .filter(Boolean)
              .join('\n')}
            icon="location"
          />
          <InfoCard
            title={copy.teams.training}
            body={[
              state.data.team.trainingGroundName,
              state.data.team.trainingGroundAddress,
              state.data.team.trainingSchedule,
            ]
              .filter(Boolean)
              .join('\n')}
            icon="calendar"
          />
          {state.data.quota ? (
            <View style={styles.quota}>
              <Text style={styles.quotaTitle}>{copy.teams.quotaTitle}</Text>
              <Text style={styles.quotaCount}>
                {copy.teams.quota(
                  state.data.quota.remaining,
                  state.data.quota.limit,
                )}
              </Text>
              <Text style={styles.helper}>
                {copy.teams.purchasedQuota(state.data.quota.purchased)}
              </Text>
              <Text style={styles.helper}>
                {copy.teams.earnedQuota(state.data.quota.earned)}
              </Text>
              <Text style={styles.helper}>{copy.teams.quotaHelp}</Text>
            </View>
          ) : null}
          {state.data.quota ? (
            <>
              {state.data.requestStatus ? (
                <View style={styles.statusBox}>
                  <Text style={styles.statusTitle}>
                    {copy.teams.requestStatusTitle}
                  </Text>
                  <Text style={styles.status}>
                    {copy.teams.status[state.data.requestStatus]}
                  </Text>
                  <Text style={styles.helper}>{copy.teams.noRepeat}</Text>
                </View>
              ) : state.data.quota.remaining > 0 ? (
                <Button
                  label={
                    submitting ? copy.teams.sending : copy.teams.joinRequest
                  }
                  disabled={submitting}
                  loading={submitting}
                  onPress={sendRequest}
                />
              ) : (
                <View style={styles.statusBox}>
                  <Text style={styles.statusTitle}>
                    {copy.teams.quotaSpent}
                  </Text>
                  <Text style={styles.helper}>{copy.teams.quotaHelp}</Text>
                </View>
              )}
              {message ? (
                <Text accessibilityRole="alert" style={styles.success}>
                  {message}
                </Text>
              ) : null}
              {actionError ? <ErrorBanner message={actionError} /> : null}
            </>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={state.retry}
            style={styles.refresh}
          >
            <RefreshCw size={15} color={colors.secondary} />
            <Text style={styles.secondary}>{copy.teams.refresh}</Text>
          </Pressable>
        </>
      ) : null}
    </Screen>
  );
}

function InfoCard({
  title,
  body,
  icon,
}: {
  title: string;
  body: string;
  icon?: 'location' | 'calendar';
}) {
  const Icon = icon === 'location' ? MapPin : CalendarDays;
  return (
    <View style={styles.info}>
      <View style={styles.infoHeading}>
        {icon ? <Icon size={18} color={colors.brand} /> : null}
        <Text style={styles.infoTitle}>{title}</Text>
      </View>
      <Text style={styles.infoBody}>{body || copy.teams.notProvided}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  back: {
    minHeight: 44,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingRight: space.md,
  },
  backText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  hero: { alignItems: 'center', gap: space.sm, paddingVertical: space.lg },
  badge: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: colors.raised,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  eyebrow: {
    color: colors.brand,
    fontSize: 10,
    letterSpacing: 1.6,
    fontWeight: '800',
  },
  name: {
    color: colors.text,
    fontSize: 24,
    textAlign: 'center',
    fontWeight: '800',
  },
  teamType: { color: colors.brand, fontSize: 13, fontWeight: '700' },
  location: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  secondary: { color: colors.secondary, fontSize: 13 },
  info: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: space.lg,
    gap: space.md,
  },
  infoHeading: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  infoTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  infoBody: { color: colors.secondary, fontSize: 13, lineHeight: 21 },
  quota: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.raised,
    padding: space.lg,
    gap: space.xs,
  },
  quotaTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  quotaCount: { color: colors.brand, fontSize: 20, fontWeight: '800' },
  helper: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  statusBox: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: space.lg,
    gap: space.xs,
  },
  statusTitle: { color: colors.text, fontWeight: '700', fontSize: 14 },
  status: { color: colors.brand, fontWeight: '700', fontSize: 13 },
  success: { color: colors.success, fontSize: 13, fontWeight: '600' },
  refresh: {
    alignSelf: 'center',
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.sm,
  },
});
