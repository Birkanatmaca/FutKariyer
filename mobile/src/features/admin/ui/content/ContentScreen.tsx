import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Newspaper, Plus } from 'lucide-react-native';
import { ErrorBanner } from '../../../../shared/ui/ErrorBanner';
import { PageHeader } from '../../../../shared/ui/PageHeader';
import { copy } from '../../../../shared/lib/copy';
import type { AdminServices } from '../../application/admin-services';
import {
  errorMessage,
  usePagedList,
  useResource,
} from '../../application/hooks';
import type {
  ApplicationDecision,
  Article,
  ContentItem,
  ContentSection,
} from '../../domain/models';
import { AdminList } from '../parts/AdminList';
import {
  AdminImage,
  Card,
  LoadMore,
  LoadState,
  Segmented,
  SmallButton,
  SuccessNotice,
  Tag,
  adminStyles,
  formatDate,
} from '../parts/AdminParts';
import { confirm } from '../parts/confirm';

const text = copy.admin.content;
export type ContentTab = ContentSection | 'reviews';

export function ContentScreen({
  services,
  tab,
  onTab,
  changedAt,
  notice,
  onCreate,
  onEdit,
  onReviewed,
}: {
  services: AdminServices;
  tab: ContentTab;
  onTab(tab: ContentTab): void;
  changedAt?: number;
  notice?: string;
  onCreate(section: ContentSection): void;
  onEdit(section: ContentSection, item: ContentItem): void;
  onReviewed?(): void;
}) {
  const header = (
    <>
      <PageHeader
        eyebrow={text.eyebrow}
        title={text.title}
        description={text.description}
      />
      <Segmented<ContentTab>
        value={tab}
        onChange={onTab}
        options={(['ads', 'news', 'reviews'] as const).map(value => ({
          value,
          label: text.sections[value],
        }))}
      />
    </>
  );
  return tab === 'reviews' ? (
    <ReviewQueue
      services={services}
      header={header}
      onReviewed={onReviewed}
      changedAt={changedAt}
    />
  ) : (
    <ContentList
      key={tab}
      services={services}
      section={tab}
      header={header}
      changedAt={changedAt}
      notice={notice}
      onCreate={() => onCreate(tab)}
      onEdit={item => onEdit(tab, item)}
    />
  );
}

function ContentList({
  services,
  section,
  header,
  changedAt,
  notice,
  onCreate,
  onEdit,
}: {
  services: AdminServices;
  section: ContentSection;
  header: React.ReactElement;
  changedAt?: number;
  notice?: string;
  onCreate(): void;
  onEdit(item: ContentItem): void;
}) {
  const load = useCallback(
    (page: number) => services.content.list(section, page),
    // changedAt reloads after the editor saved or deleted an item.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [services, section, changedAt],
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
          <SuccessNotice message={notice} />
          <View style={adminStyles.row}>
            <Text style={[adminStyles.rowMeta, adminStyles.flex]}>
              {list.total === null ? '' : copy.admin.common.total(list.total)}
            </Text>
            <SmallButton
              label={section === 'ads' ? text.newAd : text.newNews}
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
                    icon: Newspaper,
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
        <ContentRow
          item={item}
          services={services}
          onEdit={() => onEdit(item)}
        />
      )}
    />
  );
}

function ContentRow({
  item,
  services,
  onEdit,
}: {
  item: ContentItem;
  services: AdminServices;
  onEdit(): void;
}) {
  const live = 'active' in item ? item.active : item.published;
  return (
    <Card>
      <View style={adminStyles.row}>
        <AdminImage
          source={
            item.imageId ? services.content.imageSource(item.imageId) : null
          }
          label={item.title}
        />
        <View style={adminStyles.flex}>
          <Text style={adminStyles.rowTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={adminStyles.rowMeta}>{formatDate(item.updatedAt)}</Text>
        </View>
      </View>
      <View style={adminStyles.wrap}>
        <Tag
          label={live ? text.live : text.draft}
          tone={live ? 'success' : 'neutral'}
        />
        {'sortOrder' in item ? (
          <Tag label={text.orderLabel(item.sortOrder)} />
        ) : null}
        {'showOnHome' in item && item.showOnHome ? (
          <Tag label={text.onHome} tone="brand" />
        ) : null}
        {'authorName' in item && item.authorName ? (
          <Tag label={text.club(item.authorName)} tone="info" />
        ) : null}
        {'reviewStatus' in item && item.authorName && item.reviewStatus ? (
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
        ) : null}
      </View>
      <View style={adminStyles.actions}>
        <SmallButton
          label={copy.admin.common.edit}
          accessibilityLabel={item.title + ', ' + copy.admin.common.edit}
          onPress={onEdit}
        />
      </View>
    </Card>
  );
}

function ReviewQueue({
  services,
  header,
  changedAt,
  onReviewed,
}: {
  services: AdminServices;
  header: React.ReactElement;
  changedAt?: number;
  onReviewed?(): void;
}) {
  const load = useCallback(
    () => services.content.pendingReviews(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [services, changedAt],
  );
  const queue = useResource(load);
  const [busy, setBusy] = useState<{
    id: string;
    decision: ApplicationDecision;
  } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function decide(article: Article, decision: ApplicationDecision) {
    if (busy) return;
    if (
      decision === 'reject' &&
      !(await confirm(
        text.rejectTitle,
        text.rejectBody(article.title),
        text.reject,
      ))
    )
      return;
    setBusy({ id: article.id, decision });
    setNotice(null);
    setError(null);
    try {
      await services.content.review(article.id, decision);
      queue.setData(current =>
        current ? current.filter(item => item.id !== article.id) : current,
      );
      setNotice(decision === 'approve' ? text.approved : text.rejectedNotice);
      onReviewed?.();
    } catch (failure) {
      setError(errorMessage(failure));
      queue.refresh();
    } finally {
      setBusy(null);
    }
  }
  return (
    <AdminList
      items={queue.loading || queue.error ? [] : queue.data ?? []}
      keyOf={item => item.id}
      refreshing={queue.refreshing}
      onRefresh={queue.refresh}
      header={
        <>
          {header}
          <Text style={adminStyles.rowMeta}>{text.reviewHint}</Text>
          <SuccessNotice message={notice} />
          <ErrorBanner message={error} />
          <LoadState
            loading={queue.loading}
            error={queue.error}
            onRetry={queue.retry}
            empty={
              queue.data && !queue.data.length
                ? {
                    icon: Newspaper,
                    title: text.reviewEmpty,
                    body: text.reviewEmptyBody,
                  }
                : null
            }
          />
        </>
      }
      renderItem={({ item }) => (
        <Card>
          {item.imageId ? (
            <AdminImage
              source={services.content.imageSource(item.imageId)}
              label={item.title}
              style={styles.cover}
            />
          ) : null}
          <Text style={adminStyles.rowTitle}>{item.title}</Text>
          <Text style={adminStyles.rowMeta}>
            {[
              item.authorName ? text.club(item.authorName) : '',
              formatDate(item.createdAt),
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          {item.summary ? (
            <Text style={adminStyles.rowBody}>{item.summary}</Text>
          ) : null}
          <Text style={adminStyles.rowBody} numberOfLines={8}>
            {item.body}
          </Text>
          <View style={adminStyles.actions}>
            <SmallButton
              label={text.reject}
              accessibilityLabel={item.title + ', ' + text.reject}
              tone="danger"
              onPress={() => decide(item, 'reject')}
              loading={busy?.id === item.id && busy.decision === 'reject'}
              disabled={!!busy}
            />
            <SmallButton
              label={text.approve}
              accessibilityLabel={item.title + ', ' + text.approve}
              tone="brand"
              onPress={() => decide(item, 'approve')}
              loading={busy?.id === item.id && busy.decision === 'approve'}
              disabled={!!busy}
            />
          </View>
        </Card>
      )}
    />
  );
}
const styles = StyleSheet.create({
  cover: { width: '100%', height: 160 },
});
