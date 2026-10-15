import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  CalendarClock,
  Goal,
  ListChecks,
  Plus,
  Search,
  Shield,
  Trash,
  Trophy,
} from 'lucide-react-native';
import { BackLink } from '../../../../shared/ui/BackLink';
import { ErrorBanner } from '../../../../shared/ui/ErrorBanner';
import { Field } from '../../../../shared/ui/Field';
import { PageHeader } from '../../../../shared/ui/PageHeader';
import { copy } from '../../../../shared/lib/copy';
import { colors, space, type } from '../../../../styles/tokens';
import type { AdminServices } from '../../application/admin-services';
import {
  errorMessage,
  usePagedList,
  useResource,
} from '../../application/hooks';
import type {
  League,
  LeagueDetail,
  LeagueMatch,
  LeagueTeam,
} from '../../domain/models';
import { AdminList } from '../parts/AdminList';
import {
  Card,
  LoadMore,
  LoadState,
  Metric,
  SectionTitle,
  SmallButton,
  SuccessNotice,
  Tag,
  ToggleRow,
  adminStyles,
  formatDate,
} from '../parts/AdminParts';
import { confirm } from '../parts/confirm';
import { leagueTone } from './LeaguesScreen';

const text = copy.admin.leagues;

export function LeagueWorkspaceScreen({
  services,
  id,
  changedAt,
  notice: incoming,
  onBack,
  onEdit,
  onDeleted,
  onMatch,
}: {
  services: AdminServices;
  id: string;
  changedAt?: number;
  notice?: string;
  onBack(): void;
  onEdit(league: League): void;
  onDeleted(message: string): void;
  onMatch(teams: LeagueTeam[], match?: LeagueMatch): void;
}) {
  const load = useCallback(
    () => services.leagues.detail(id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [services, id, changedAt],
  );
  const detail = useResource(load);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const data = detail.data;
  // Run a change, then reload the league so standings and stats follow.
  async function operate(action: () => Promise<unknown>, success: string) {
    if (busy) return false;
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      await action();
      setNotice(success);
      detail.refresh();
      return true;
    } catch (failure) {
      setError(errorMessage(failure));
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function togglePublished(league: League, on: boolean) {
    if (
      !on &&
      !(await confirm(text.unpublishTitle, text.unpublishBody, text.unpublish))
    )
      return;
    const { name, season, description, winPoints, drawPoints, lossPoints } =
      league;
    await operate(
      () =>
        services.leagues.save(
          {
            name,
            season,
            description,
            winPoints,
            drawPoints,
            lossPoints,
            status: on ? 'active' : 'draft',
          },
          league.id,
        ),
      on ? text.published : text.unpublished,
    );
  }
  async function removeLeague(league: League) {
    if (!(await confirm(text.deleteTitle, text.deleteBody, text.delete)))
      return;
    setBusy(true);
    setError(null);
    try {
      await services.leagues.remove(league.id);
      onDeleted(text.deleted);
    } catch (failure) {
      setError(errorMessage(failure));
      setBusy(false);
    }
  }
  async function removeTeam(team: LeagueTeam) {
    if (
      !(await confirm(
        text.removeTeamTitle,
        text.removeTeamBody(team.name),
        text.remove,
      ))
    )
      return;
    await operate(
      () => services.leagues.removeTeam(id, team.id),
      text.teamRemoved,
    );
  }
  async function removeMatch(match: LeagueMatch) {
    if (
      !(await confirm(
        text.deleteMatchTitle,
        text.deleteMatchBody,
        text.deleteMatch,
      ))
    )
      return;
    await operate(
      () => services.leagues.removeMatch(id, match.id),
      text.matchDeleted,
    );
  }
  const matches = useMemo(
    () =>
      [...(data?.matches ?? [])].sort(
        (a, b) =>
          a.round - b.round ||
          (a.kickoffAt ?? '').localeCompare(b.kickoffAt ?? ''),
      ),
    [data?.matches],
  );
  const shownNotice = notice ?? incoming ?? null;
  return (
    <AdminList
      items={data ? matches : []}
      keyOf={match => match.id}
      refreshing={detail.refreshing}
      onRefresh={detail.refresh}
      header={
        <>
          <BackLink label={copy.admin.common.back} onPress={onBack} />
          <PageHeader
            eyebrow={text.eyebrow + (data ? ' · ' + data.league.season : '')}
            title={data?.league.name ?? text.title}
            description={data?.league.description || undefined}
          />
          <SuccessNotice message={shownNotice} />
          <ErrorBanner message={error} />
          {!data ? (
            <LoadState
              loading={detail.loading}
              error={detail.error}
              onRetry={detail.retry}
            />
          ) : (
            <WorkspaceHeader
              services={services}
              data={data}
              busy={busy}
              onEdit={() => onEdit(data.league)}
              onDelete={() => removeLeague(data.league)}
              onPublish={on => togglePublished(data.league, on)}
              onAddTeam={clubId =>
                operate(
                  () => services.leagues.addTeam(id, clubId),
                  text.teamAdded,
                )
              }
              onRemoveTeam={removeTeam}
              onNewMatch={() => onMatch(data.teams)}
            />
          )}
        </>
      }
      renderItem={({ item }) => (
        <MatchRow
          match={item}
          busy={busy}
          onEdit={() => data && onMatch(data.teams, item)}
          onRemove={() => removeMatch(item)}
        />
      )}
    />
  );
}

function WorkspaceHeader({
  services,
  data,
  busy,
  onEdit,
  onDelete,
  onPublish,
  onAddTeam,
  onRemoveTeam,
  onNewMatch,
}: {
  services: AdminServices;
  data: LeagueDetail;
  busy: boolean;
  onEdit(): void;
  onDelete(): void;
  onPublish(on: boolean): void;
  onAddTeam(clubId: string): void;
  onRemoveTeam(team: LeagueTeam): void;
  onNewMatch(): void;
}) {
  const { league, statistics, teams, standings } = data;
  return (
    <>
      <View style={adminStyles.wrap}>
        <Tag
          label={text.statuses[league.status]}
          tone={leagueTone[league.status]}
        />
        <Tag
          label={text.pointsRule(
            league.winPoints,
            league.drawPoints,
            league.lossPoints,
          )}
        />
      </View>
      <Card>
        <ToggleRow
          label={text.publish}
          hint={text.publishHint}
          value={league.status !== 'draft'}
          onChange={onPublish}
          disabled={busy}
        />
        <View style={adminStyles.actions}>
          <SmallButton
            label={text.delete}
            tone="danger"
            icon={Trash}
            onPress={onDelete}
            disabled={busy}
          />
          <SmallButton label={text.edit} onPress={onEdit} disabled={busy} />
        </View>
      </Card>
      <View style={adminStyles.metrics}>
        <Metric
          label={text.teamCount}
          value={String(statistics.teamCount)}
          icon={Shield}
        />
        <Metric
          label={text.matchCount}
          value={String(statistics.matchCount)}
          icon={CalendarClock}
        />
        <Metric
          label={text.playedMatches}
          value={String(statistics.playedMatches)}
          icon={ListChecks}
        />
        <Metric
          label={text.averageGoals}
          value={statistics.averageGoals.toLocaleString('tr-TR', {
            maximumFractionDigits: 2,
          })}
          icon={Goal}
        />
      </View>
      <TeamsCard
        services={services}
        teams={teams}
        busy={busy}
        onAdd={onAddTeam}
        onRemove={onRemoveTeam}
      />
      <Card>
        <SectionTitle title={text.standings} />
        {standings.length ? (
          <>
            <View style={styles.standingRow}>
              <Text style={[styles.cell, styles.position]}>#</Text>
              <Text style={[styles.cell, styles.team]} />
              {['O', 'G', 'B', 'M', 'AV', 'P'].map(head => (
                <Text key={head} style={styles.cell}>
                  {head}
                </Text>
              ))}
            </View>
            {standings.map(row => (
              <View
                key={row.teamId}
                style={[
                  styles.standingRow,
                  row.position === 1 && styles.leader,
                ]}
              >
                <Text style={[styles.cell, styles.position]}>
                  {row.position}
                </Text>
                <Text style={[styles.value, styles.team]} numberOfLines={1}>
                  {row.teamName}
                </Text>
                {[
                  row.played,
                  row.wins,
                  row.draws,
                  row.losses,
                  (row.goalDifference > 0 ? '+' : '') + row.goalDifference,
                  row.points,
                ].map((value, index) => (
                  <Text
                    key={index}
                    style={[styles.value, index === 5 && styles.points]}
                  >
                    {value}
                  </Text>
                ))}
              </View>
            ))}
          </>
        ) : (
          <Text style={adminStyles.rowMeta}>{text.noTeams}</Text>
        )}
      </Card>
      <SectionTitle
        title={text.fixtures}
        hint={teams.length < 2 ? text.needTeams : undefined}
        action={
          <SmallButton
            label={text.newMatch}
            tone="brand"
            icon={Plus}
            onPress={onNewMatch}
            disabled={busy || teams.length < 2}
          />
        }
      />
      {data.matches.length ? null : (
        <Text style={adminStyles.rowMeta}>
          {teams.length < 2 ? text.noTeams : text.noMatches}
        </Text>
      )}
    </>
  );
}

function TeamsCard({
  services,
  teams,
  busy,
  onAdd,
  onRemove,
}: {
  services: AdminServices;
  teams: LeagueTeam[];
  busy: boolean;
  onAdd(clubId: string): void;
  onRemove(team: LeagueTeam): void;
}) {
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const load = useCallback(
    (page: number) => services.leagues.clubs(search, page),
    [services, search],
  );
  return (
    <Card>
      <SectionTitle title={text.teams} hint={text.addTeam} />
      {teams.map(team => (
        <View key={team.id} style={adminStyles.row}>
          <View style={adminStyles.flex}>
            <Text style={adminStyles.rowBody}>{team.name}</Text>
            {team.district ? (
              <Text style={adminStyles.rowMeta}>{team.district}</Text>
            ) : null}
          </View>
          <SmallButton
            label={text.remove}
            accessibilityLabel={text.removeLabel(team.name)}
            tone="danger"
            onPress={() => onRemove(team)}
            disabled={busy}
          />
        </View>
      ))}
      <Field
        label={text.searchClub}
        icon={Search}
        value={draft}
        onChangeText={setDraft}
        returnKeyType="search"
        onSubmitEditing={() => setSearch(draft.trim())}
        maxLength={80}
      />
      <SmallButton
        label={copy.admin.common.search}
        icon={Search}
        onPress={() => setSearch(draft.trim())}
      />
      <ClubResults load={load} teams={teams} busy={busy} onAdd={onAdd} />
    </Card>
  );
}

function ClubResults({
  load,
  teams,
  busy,
  onAdd,
}: {
  load(page: number): ReturnType<AdminServices['leagues']['clubs']>;
  teams: LeagueTeam[];
  busy: boolean;
  onAdd(clubId: string): void;
}) {
  const clubs = usePagedList(load);
  return (
    <View style={adminStyles.form}>
      <LoadState
        loading={clubs.loading}
        error={clubs.error}
        onRetry={clubs.retry}
        empty={
          !clubs.loading && !clubs.error && !clubs.items.length
            ? { icon: Trophy, title: text.noClubs, body: '' }
            : null
        }
      />
      {clubs.items.map(club => {
        const added = teams.some(team => team.clubId === club.id);
        return (
          <View key={club.id} style={adminStyles.row}>
            <Text style={[adminStyles.rowBody, adminStyles.flex]}>
              {club.fullName}
            </Text>
            {added ? (
              <Tag label={text.added} tone="success" />
            ) : (
              <SmallButton
                label={text.add}
                accessibilityLabel={text.addLabel(club.fullName)}
                tone="brand"
                onPress={() => onAdd(club.id)}
                disabled={busy}
              />
            )}
          </View>
        );
      })}
      <LoadMore
        hasMore={clubs.hasMore}
        loadingMore={clubs.loadingMore}
        error={clubs.moreError}
        onMore={clubs.loadMore}
      />
    </View>
  );
}

function MatchRow({
  match,
  busy,
  onEdit,
  onRemove,
}: {
  match: LeagueMatch;
  busy: boolean;
  onEdit(): void;
  onRemove(): void;
}) {
  const played = match.homeGoals !== null && match.awayGoals !== null;
  return (
    <Card>
      <View style={adminStyles.row}>
        <Text style={[adminStyles.rowMeta, adminStyles.flex]}>
          {text.roundLabel(match.round)} ·{' '}
          {match.kickoffAt
            ? formatDate(match.kickoffAt, true)
            : text.dateUnknown}
        </Text>
        <Tag
          label={played ? text.played : text.scheduled}
          tone={played ? 'success' : 'neutral'}
        />
      </View>
      <View style={adminStyles.row}>
        <Text style={[styles.club, styles.home]} numberOfLines={2}>
          {match.homeName}
        </Text>
        <Text style={styles.score}>
          {played ? match.homeGoals + ' – ' + match.awayGoals : '– : –'}
        </Text>
        <Text style={styles.club} numberOfLines={2}>
          {match.awayName}
        </Text>
      </View>
      <View style={adminStyles.actions}>
        <SmallButton
          label={copy.admin.common.delete}
          accessibilityLabel={
            match.homeName + ' – ' + match.awayName + ', ' + text.deleteMatch
          }
          tone="danger"
          onPress={onRemove}
          disabled={busy}
        />
        <SmallButton
          label={copy.admin.common.edit}
          accessibilityLabel={
            match.homeName + ' – ' + match.awayName + ', ' + text.editMatch
          }
          onPress={onEdit}
          disabled={busy}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  standingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 36,
    paddingHorizontal: space.sm,
    borderRadius: space.sm,
  },
  leader: { backgroundColor: colors.brandWash },
  cell: {
    ...type.caption,
    ...type.number,
    color: colors.muted,
    width: 28,
    textAlign: 'center',
  },
  value: {
    ...type.caption,
    ...type.number,
    color: colors.text,
    width: 28,
    textAlign: 'center',
  },
  position: { width: 24, textAlign: 'left' },
  team: { flex: 1, width: undefined, textAlign: 'left' },
  points: { color: colors.brand, fontWeight: '800' },
  club: { ...type.headline, color: colors.text, flex: 1 },
  home: { textAlign: 'right' },
  score: {
    ...type.title,
    ...type.number,
    color: colors.text,
    minWidth: 72,
    textAlign: 'center',
  },
});
