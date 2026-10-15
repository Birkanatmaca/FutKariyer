import React, { useCallback } from 'react';
import { Text, View } from 'react-native';
import { Plus, Trophy } from 'lucide-react-native';
import { BackLink } from '../../../../shared/ui/BackLink';
import { PageHeader } from '../../../../shared/ui/PageHeader';
import { copy } from '../../../../shared/lib/copy';
import type { AdminServices } from '../../application/admin-services';
import { usePagedList } from '../../application/hooks';
import type { League, LeagueStatus } from '../../domain/models';
import { AdminList } from '../parts/AdminList';
import {
  Card,
  LoadMore,
  LoadState,
  SmallButton,
  SuccessNotice,
  Tag,
  adminStyles,
  type Tone,
} from '../parts/AdminParts';

const text = copy.admin.leagues;
export const leagueTone: Record<LeagueStatus, Tone> = {
  draft: 'neutral',
  active: 'brand',
  finished: 'info',
};

export function LeaguesScreen({
  services,
  changedAt,
  notice,
  onBack,
  onCreate,
  onOpen,
}: {
  services: AdminServices;
  changedAt?: number;
  notice?: string;
  onBack(): void;
  onCreate(): void;
  onOpen(league: League): void;
}) {
  const load = useCallback(
    (page: number) => services.leagues.list(page),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [services, changedAt],
  );
  const list = usePagedList(load);
  return (
    <AdminList
      items={list.loading || list.error ? [] : list.items}
      keyOf={league => league.id}
      refreshing={list.refreshing}
      onRefresh={list.refresh}
      onEndReached={list.loadMore}
      header={
        <>
          <BackLink label={copy.admin.common.back} onPress={onBack} />
          <PageHeader
            eyebrow={text.eyebrow}
            title={text.title}
            description={text.description}
          />
          <SuccessNotice message={notice} />
          <View style={adminStyles.row}>
            <Text style={[adminStyles.rowMeta, adminStyles.flex]}>
              {list.total === null ? '' : copy.admin.common.total(list.total)}
            </Text>
            <SmallButton
              label={text.create}
              tone="brand"
              icon={Plus}
              onPress={onCreate}
            />
          </View>
          <LoadState
            loading={list.loading}
            error={list.error}
            onRetry={list.retry}
            empty={
              !list.loading && !list.error && !list.items.length
                ? { icon: Trophy, title: text.emptyTitle, body: text.emptyBody }
                : null
            }
          />
        </>
      }
      footer={
        <LoadMore
          hasMore={list.hasMore}
          loadingMore={list.loadingMore}
          error={list.moreError}
          onMore={list.loadMore}
        />
      }
      renderItem={({ item }) => (
        <Card>
          <View style={adminStyles.row}>
            <View style={adminStyles.flex}>
              <Text style={adminStyles.rowTitle}>{item.name}</Text>
              <Text style={adminStyles.rowMeta}>
                {item.season} ·{' '}
                {text.pointsRule(
                  item.winPoints,
                  item.drawPoints,
                  item.lossPoints,
                )}
              </Text>
            </View>
            <Tag
              label={text.statuses[item.status]}
              tone={leagueTone[item.status]}
            />
          </View>
          {item.description ? (
            <Text style={adminStyles.rowBody} numberOfLines={2}>
              {item.description}
            </Text>
          ) : null}
          <View style={adminStyles.actions}>
            <SmallButton
              label={text.manage}
              accessibilityLabel={item.name + ', ' + text.manage}
              onPress={() => onOpen(item)}
            />
          </View>
        </Card>
      )}
    />
  );
}
