import React, { useCallback } from 'react';
import { Text, View } from 'react-native';
import { Megaphone, Plus } from 'lucide-react-native';
import { copy } from '../../../../shared/lib/copy';
import type { AdminServices } from '../../application/admin-services';
import { usePagedList } from '../../application/hooks';
import type { PopupAd } from '../../domain/models';
import { AdminList } from '../parts/AdminList';
import {
  AdminImage,
  Card,
  LoadMore,
  LoadState,
  SmallButton,
  SuccessNotice,
  Tag,
  adminStyles,
} from '../parts/AdminParts';

const text = copy.admin.popups;

// The Popup tab of İçerik: each popup with its format, schedule and reach.
export function PopupList({
  services,
  header,
  changedAt,
  notice,
  onCreate,
  onEdit,
}: {
  services: AdminServices;
  header: React.ReactElement;
  changedAt?: number;
  notice?: string;
  onCreate(): void;
  onEdit(item: PopupAd): void;
}) {
  const load = useCallback(
    (page: number) => services.popups.list(page),
    // changedAt reloads after the editor saved or deleted a popup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [services, changedAt],
  );
  const list = usePagedList(load);
  return (
    <AdminList
      items={list.loading || list.error ? [] : list.items}
      keyOf={item => item.id}
      refreshing={list.refreshing}
      onRefresh={list.refresh}
      onEndReached={list.loadMore}
      header={
        <>
          {header}
          <Text style={adminStyles.rowMeta}>{text.hint}</Text>
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
                ? {
                    icon: Megaphone,
                    title: text.emptyTitle,
                    body: text.emptyBody,
                  }
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
            <AdminImage
              source={services.content.imageSource(item.imageId)}
              label={item.title}
            />
            <View style={adminStyles.flex}>
              <Text style={adminStyles.rowTitle} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={adminStyles.rowMeta}>
                {text.summary(item.intervalMinutes, item.maxViews)}
              </Text>
              <Text style={adminStyles.rowMeta}>
                {text.reach(item.views, item.viewers)}
              </Text>
            </View>
          </View>
          <View style={adminStyles.wrap}>
            <Tag
              label={
                item.active ? copy.admin.content.live : copy.admin.content.draft
              }
              tone={item.active ? 'success' : 'neutral'}
            />
            <Tag label={text.formats[item.format]} tone="brand" />
          </View>
          <View style={adminStyles.actions}>
            <SmallButton
              label={copy.admin.common.edit}
              accessibilityLabel={item.title + ', ' + copy.admin.common.edit}
              onPress={() => onEdit(item)}
            />
          </View>
        </Card>
      )}
    />
  );
}
