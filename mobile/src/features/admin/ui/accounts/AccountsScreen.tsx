import React, { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { Plus, Search, Users } from 'lucide-react-native';
import { Field } from '../../../../shared/ui/Field';
import { PageHeader } from '../../../../shared/ui/PageHeader';
import { copy } from '../../../../shared/lib/copy';
import type { AdminServices } from '../../application/admin-services';
import { usePagedList } from '../../application/hooks';
import type { AccountSection, ManagedAccount } from '../../domain/models';
import { AdminList } from '../parts/AdminList';
import {
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

const text = copy.admin.accounts;
const verifiable = ['club', 'coach', 'organizer'];

export function AccountsScreen({
  services,
  section,
  onSection,
  changedAt,
  notice,
  onCreate,
  onEdit,
  onOverview,
}: {
  services: AdminServices;
  section: AccountSection;
  onSection(section: AccountSection): void;
  changedAt?: number;
  notice?: string;
  onCreate(section: AccountSection): void;
  onEdit(account: ManagedAccount): void;
  onOverview(account: ManagedAccount): void;
}) {
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const load = useCallback(
    (page: number) => services.accounts.list(section, page, search),
    // changedAt reloads the list after an editor saved or deleted an account.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [services, section, search, changedAt],
  );
  const list = usePagedList(load);
  const empty =
    !list.loading && !list.error && list.items.length === 0
      ? {
          icon: Users,
          title: search ? text.emptySearch : text.emptyTitle,
          body: search ? '' : text.emptyBody,
        }
      : null;
  function submitSearch(value = draft) {
    setSearch(value.trim());
  }
  return (
    <AdminList
      items={list.loading || list.error ? [] : list.items}
      keyOf={account => account.id}
      refreshing={list.refreshing}
      onRefresh={list.refresh}
      onEndReached={list.loadMore}
      header={
        <>
          <PageHeader
            eyebrow={text.eyebrow}
            title={text.title}
            description={text.description}
          />
          <Segmented
            options={[
              { value: 'users', label: text.sections.users },
              { value: 'clubs', label: text.sections.clubs },
            ]}
            value={section}
            onChange={value => {
              setDraft('');
              setSearch('');
              onSection(value);
            }}
          />
          <SuccessNotice message={notice} />
          <Field
            label={copy.admin.common.search}
            icon={Search}
            value={draft}
            onChangeText={value => {
              setDraft(value);
              if (!value) submitSearch('');
            }}
            placeholder={text.search}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => submitSearch()}
            maxLength={120}
          />
          <View style={adminStyles.row}>
            <Text style={[adminStyles.rowMeta, adminStyles.flex]}>
              {list.total === null
                ? ''
                : copy.admin.common.shown(list.items.length, list.total)}
            </Text>
            <SmallButton
              label={section === 'clubs' ? text.newClub : text.newUser}
              tone="brand"
              icon={Plus}
              onPress={() => onCreate(section)}
            />
          </View>
          {section === 'clubs' ? (
            <Text style={adminStyles.rowMeta}>{text.clubNote}</Text>
          ) : null}
          <LoadState
            loading={list.loading}
            error={list.error}
            onRetry={list.retry}
            empty={empty}
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
        <AccountRow
          account={item}
          onEdit={() => onEdit(item)}
          onOverview={() => onOverview(item)}
        />
      )}
    />
  );
}

export function AccountRow({
  account,
  onEdit,
  onOverview,
}: {
  account: ManagedAccount;
  onEdit(): void;
  onOverview(): void;
}) {
  const place = [account.city, account.district].filter(Boolean).join(' / ');
  return (
    <Card>
      <View style={adminStyles.row}>
        <View style={adminStyles.avatar}>
          <Text style={adminStyles.avatarText}>
            {account.fullName.charAt(0).toLocaleUpperCase('tr-TR')}
          </Text>
        </View>
        <View style={adminStyles.flex}>
          <Text style={adminStyles.rowTitle} numberOfLines={1}>
            {account.fullName}
          </Text>
          <Text style={adminStyles.rowMeta} numberOfLines={1}>
            {copy.admin.roles[account.role]} ·{' '}
            {account.username || account.email}
          </Text>
        </View>
      </View>
      <View style={adminStyles.wrap}>
        <Tag
          label={account.active ? text.active : text.inactive}
          tone={account.active ? 'success' : 'danger'}
        />
        {verifiable.includes(account.role) ? (
          <Tag
            label={account.verified ? text.verified : text.unverified}
            tone={account.verified ? 'brand' : 'warning'}
          />
        ) : null}
      </View>
      <Text style={adminStyles.rowMeta}>
        {[place, text.joined(formatDate(account.createdAt))]
          .filter(Boolean)
          .join(' · ')}
      </Text>
      {account.role === 'admin' ? (
        <Tag label={text.protected} />
      ) : (
        <View style={adminStyles.actions}>
          {account.role === 'club' ? (
            <SmallButton
              label={text.overview}
              accessibilityLabel={account.fullName + ', ' + text.overview}
              onPress={onOverview}
            />
          ) : null}
          <SmallButton
            label={copy.admin.common.edit}
            accessibilityLabel={
              account.fullName + ', ' + copy.admin.common.edit
            }
            onPress={onEdit}
          />
        </View>
      )}
    </Card>
  );
}
