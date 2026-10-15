import React, { useCallback } from 'react';
import { Text, View } from 'react-native';
import { Building } from 'lucide-react-native';
import { BackLink } from '../../../../shared/ui/BackLink';
import { EmptyState } from '../../../../shared/ui/EmptyState';
import { PageHeader } from '../../../../shared/ui/PageHeader';
import { Screen } from '../../../../shared/ui/Screen';
import { ApiError } from '../../../../shared/api/client';
import { copy } from '../../../../shared/lib/copy';
import type { AdminServices } from '../../application/admin-services';
import { useResource } from '../../application/hooks';
import type { ClubOverview, ClubOverviewFixture } from '../../domain/models';
import {
  Card,
  InfoRow,
  LoadState,
  SectionTitle,
  Tag,
  adminStyles,
  formatDate,
} from '../parts/AdminParts';

const text = copy.admin.overview;

// Read-only club summary: profile, news, player applications and leagues.
export function ClubOverviewScreen({
  services,
  id,
  name,
  onBack,
}: {
  services: AdminServices;
  id: string;
  name: string;
  onBack(): void;
}) {
  const load = useCallback(async () => {
    try {
      return await services.accounts.clubOverview(id);
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 404) return null;
      throw failure;
    }
  }, [services, id]);
  const overview = useResource(load);
  const data = overview.data;
  return (
    <Screen>
      <BackLink label={copy.admin.common.back} onPress={onBack} />
      <PageHeader eyebrow={text.eyebrow} title={data?.profile.name || name} />
      {overview.loading || overview.error ? (
        <LoadState
          loading={overview.loading}
          error={overview.error}
          onRetry={overview.retry}
        />
      ) : !data ? (
        <EmptyState
          icon={Building}
          title={text.notFound}
          body={text.notFoundBody}
        />
      ) : (
        <OverviewBody data={data} />
      )}
    </Screen>
  );
}

function OverviewBody({ data }: { data: ClubOverview }) {
  const { profile } = data;
  return (
    <>
      <Card>
        <View style={adminStyles.wrap}>
          <Tag
            label={data.active ? text.active : text.inactive}
            tone={data.active ? 'success' : 'danger'}
          />
          <Tag label={copy.admin.footballTypes[profile.footballType]} />
        </View>
        <SectionTitle title={text.profile} />
        <InfoRow label={text.email} value={data.email} />
        <InfoRow label={text.district} value={profile.district} />
        <InfoRow label={text.description} value={profile.description} />
        <InfoRow label={text.venueName} value={profile.venueName} />
        <InfoRow label={text.venueAddress} value={profile.venueAddress} />
        <InfoRow
          label={text.trainingGroundName}
          value={profile.trainingGroundName}
        />
        <InfoRow
          label={text.trainingGroundAddress}
          value={profile.trainingGroundAddress}
        />
        <InfoRow
          label={text.trainingSchedule}
          value={profile.trainingSchedule}
        />
      </Card>
      <Card>
        <SectionTitle title={text.news} />
        {data.news.length ? (
          data.news.map(item => (
            <View key={item.id} style={adminStyles.row}>
              <View style={adminStyles.flex}>
                <Text style={adminStyles.rowBody}>{item.title}</Text>
                <Text style={adminStyles.rowMeta}>
                  {formatDate(item.createdAt)} ·{' '}
                  {item.published ? text.published : text.unpublished}
                </Text>
              </View>
              <Tag
                label={text.reviewStatus[item.reviewStatus]}
                tone={
                  item.reviewStatus === 'approved'
                    ? 'success'
                    : item.reviewStatus === 'rejected'
                    ? 'danger'
                    : 'warning'
                }
              />
            </View>
          ))
        ) : (
          <Text style={adminStyles.rowMeta}>{text.newsEmpty}</Text>
        )}
      </Card>
      <Card>
        <SectionTitle title={text.applications} />
        {data.applications.length ? (
          data.applications.map(item => (
            <View key={item.id} style={adminStyles.row}>
              <View style={adminStyles.flex}>
                <Text style={adminStyles.rowBody}>{item.playerName}</Text>
                <Text style={adminStyles.rowMeta}>
                  {formatDate(item.createdAt)}
                </Text>
              </View>
              <Tag
                label={text.applicationStatus[item.status]}
                tone={
                  item.status === 'accepted'
                    ? 'success'
                    : item.status === 'rejected'
                    ? 'danger'
                    : 'warning'
                }
              />
            </View>
          ))
        ) : (
          <Text style={adminStyles.rowMeta}>{text.applicationsEmpty}</Text>
        )}
      </Card>
      <SectionTitle title={text.leagues} />
      {data.leagues.length ? (
        data.leagues.map(league => (
          <Card key={league.leagueId}>
            <View style={adminStyles.row}>
              <View style={adminStyles.flex}>
                <Text style={adminStyles.rowTitle}>{league.leagueName}</Text>
                <Text style={adminStyles.rowMeta}>
                  {league.season} ·{' '}
                  {text.position(league.position, league.teamCount)}
                </Text>
              </View>
              <Tag
                label={text.leagueStatus[league.status]}
                tone={league.status === 'active' ? 'brand' : 'neutral'}
              />
            </View>
            <View style={adminStyles.wrap}>
              <InfoRow label={text.points} value={String(league.points)} />
              <InfoRow label={text.played} value={String(league.played)} />
              <InfoRow
                label={text.record}
                value={league.wins + '-' + league.draws + '-' + league.losses}
              />
              <InfoRow
                label={text.goalDifference}
                value={
                  (league.goalDifference > 0 ? '+' : '') + league.goalDifference
                }
              />
            </View>
            <Fixtures
              title={text.recent}
              empty={text.noRecent}
              items={league.recent}
            />
            <Fixtures
              title={text.next}
              empty={text.noNext}
              items={league.upcoming}
            />
          </Card>
        ))
      ) : (
        <Text style={adminStyles.rowMeta}>{text.leaguesEmpty}</Text>
      )}
    </>
  );
}

function Fixtures({
  title,
  empty,
  items,
}: {
  title: string;
  empty: string;
  items: ClubOverviewFixture[];
}) {
  return (
    <View style={adminStyles.form}>
      <Text style={adminStyles.rowMeta}>{title}</Text>
      {items.length ? (
        items.map(item => (
          <View key={item.id} style={adminStyles.row}>
            <View style={adminStyles.flex}>
              <Text style={adminStyles.rowBody}>{item.opponentName}</Text>
              <Text style={adminStyles.rowMeta}>
                {text.round(item.round)} · {item.isHome ? text.home : text.away}{' '}
                ·{' '}
                {item.kickoffAt
                  ? formatDate(item.kickoffAt, true)
                  : text.dateUnknown}
              </Text>
            </View>
            {item.goalsFor !== null && item.goalsAgainst !== null ? (
              <Text style={adminStyles.rowTitle}>
                {item.goalsFor} – {item.goalsAgainst}
              </Text>
            ) : null}
            {item.result ? (
              <Tag
                label={text.results[item.result]}
                tone={
                  item.result === 'win'
                    ? 'success'
                    : item.result === 'loss'
                    ? 'danger'
                    : 'neutral'
                }
              />
            ) : null}
          </View>
        ))
      ) : (
        <Text style={adminStyles.rowMeta}>{empty}</Text>
      )}
    </View>
  );
}
