import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Trophy } from 'lucide-react-native';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space, type } from '../../../styles/tokens';
import { primaryLeague } from '../application/club-center';
import type { ClubCenterState } from '../application/useClubCenter';
import { ClubHelloCard } from './ClubHelloCard';
import { ClubLeagueCarousel } from './ClubLeagueCarousel';

// The top of the club home (20 Oct 2026): the Merhaba card with the waiting
// work inside it, then the league card the club swipes through. Profile
// completeness moved to the profile screen.
export function ClubCenterSection({
  state,
  clubName,
  avatarUri,
  onProfile,
  onApplications,
  onNews,
  onLeagues,
  onLinkTff,
  now,
}: {
  // The home screen's single center read (useClubCenter).
  state: ClubCenterState;
  clubName: string;
  avatarUri?: string;
  // Left out when a switched coach lacks that section.
  onProfile?(): void;
  onApplications?(): void;
  onNews?(): void;
  onLeagues(): void;
  onLinkTff?(): void;
  // Fixed clock for tests.
  now?: number;
}) {
  const { center } = state;
  const league = center ? primaryLeague(center) : null;
  const text = copy.clubHome.match;
  return (
    <View style={styles.stack}>
      <ClubHelloCard
        name={clubName}
        avatarUri={avatarUri}
        subtitle={
          league
            ? copy.clubHome.helloLeague(league.leagueName, league.position)
            : ''
        }
        work={center ?? undefined}
        onProfile={onProfile}
        onApplications={onApplications}
        onNews={onNews}
      />
      {state.error ? (
        <>
          <ErrorBanner message={state.error} />
          <Button label={copy.form.retry} secondary onPress={state.retry} />
        </>
      ) : state.loading && !center ? (
        <View style={[styles.card, styles.loading]}>
          <ActivityIndicator
            accessibilityLabel={copy.clubHome.loading}
            color={colors.brand}
          />
        </View>
      ) : league ? (
        <ClubLeagueCarousel
          league={league}
          clubName={clubName}
          avatarUri={avatarUri}
          onLeagues={onLeagues}
          now={now}
        />
      ) : center ? (
        // No league yet: invite the club to link its TFF team, or say the
        // federation page is down when it is already linked.
        <View style={styles.card}>
          <View style={styles.icon}>
            <Trophy size={20} color={colors.brand} />
          </View>
          <Text accessibilityRole="header" style={styles.title}>
            {center.tffLinked ? text.standingsTitle : text.linkTitle}
          </Text>
          <Text style={styles.body}>
            {center.tffLinked ? text.tffDown : text.linkBody}
          </Text>
          {center.tffLinked ? (
            <Button
              label={copy.form.retry}
              secondary
              compact
              onPress={state.retry}
            />
          ) : onLinkTff ? (
            <Button label={text.linkAction} compact onPress={onLinkTff} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.lg },
  card: {
    padding: space.lg,
    gap: space.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  loading: { minHeight: 200, alignItems: 'center', justifyContent: 'center' },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandWash,
  },
  title: { ...type.headline, color: colors.text },
  body: { ...type.body, color: colors.secondary, marginBottom: space.xs },
});
