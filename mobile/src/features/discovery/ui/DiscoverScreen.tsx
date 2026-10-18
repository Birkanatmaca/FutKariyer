import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Compass, ShieldCheck } from 'lucide-react-native';
import { Screen } from '../../../shared/ui/Screen';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { TopBar } from '../../../shared/ui/TopBar';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space } from '../../../styles/tokens';
import type { AccountRole } from '../../auth';
import type { DiscoveryKind, DiscoveryQuery } from '../domain/models';
import type { DiscoveryService } from '../application/discovery-service';
import { useDiscovery } from '../application/useDiscovery';
import { DiscoveryFilters } from './DiscoveryFilters';
import { DiscoveryProfileCard } from './DiscoveryProfileCard';
function blankQuery(kind: DiscoveryKind): DiscoveryQuery {
  return {
    kind,
    search: '',
    position: '',
    dominantFoot: '',
    availability: '',
    footballType: '',
    licenseStatus: '',
    page: 1,
  };
}
export function DiscoverScreen({
  service,
  token,
  role,
  onOpen,
  onBack,
}: {
  service: DiscoveryService;
  token: string | null;
  role: AccountRole;
  onOpen(kind: DiscoveryKind, id: string): void;
  onBack?(): void;
}) {
  const sections: DiscoveryKind[] =
    role === 'player' ? ['players', 'clubs', 'coaches'] : ['players'];
  const [query, setQuery] = useState(() => blankQuery(sections[0]));
  const [draft, setDraft] = useState(query);
  const [expanded, setExpanded] = useState(false);
  const { page, error, loading, forbidden, refresh } = useDiscovery(
    service,
    token,
    query,
  );
  useEffect(() => {
    if (page && query.page > Math.max(1, page.totalPages)) {
      setQuery(current => ({ ...current, page: Math.max(1, page.totalPages) }));
    }
  }, [page, query.page]);
  function select(kind: DiscoveryKind) {
    const next = blankQuery(kind);
    setDraft(next);
    setQuery(next);
    setExpanded(false);
  }
  return (
    <Screen key={JSON.stringify(query)}>
      <TopBar title={copy.discover.title} onBack={onBack} />
      {sections.length > 1 && (
        <View style={styles.segments}>
          {sections.map(kind => (
            <Pressable
              key={kind}
              accessibilityRole="tab"
              accessibilityState={{ selected: query.kind === kind }}
              onPress={() => select(kind)}
              style={[styles.segment, query.kind === kind && styles.selected]}
            >
              <Text
                style={[
                  styles.segmentText,
                  query.kind === kind && styles.selectedText,
                ]}
              >
                {copy.discover[kind]}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      {!forbidden && (
        <DiscoveryFilters
          value={draft}
          onChange={setDraft}
          expanded={expanded}
          onToggle={() => setExpanded(value => !value)}
          onApply={() => setQuery({ ...draft, page: 1 })}
          onClear={() => select(query.kind)}
        />
      )}
      {loading ? (
        <View accessibilityLiveRegion="polite" style={styles.loading}>
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.helper}>{copy.discover.loading}</Text>
        </View>
      ) : forbidden ? (
        <>
          <EmptyState
            icon={ShieldCheck}
            title={copy.discover.verificationTitle}
            body={error || copy.discover.verificationBody}
          />
          <Button label={copy.discover.refresh} secondary onPress={refresh} />
        </>
      ) : error ? (
        <>
          <ErrorBanner message={error} />
          <Button label={copy.form.retry} onPress={refresh} />
        </>
      ) : (
        page && (
          <>
            <View style={styles.resultHeader}>
              <Text accessibilityLiveRegion="polite" style={styles.resultCount}>
                {copy.discover.results(page.total)}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={refresh}
                style={styles.refresh}
              >
                <Text style={styles.helper}>{copy.discover.refresh}</Text>
              </Pressable>
            </View>
            {page.items.length ? (
              page.items.map(profile => (
                <DiscoveryProfileCard
                  key={profile.id}
                  profile={profile}
                  onPress={() => onOpen(query.kind, profile.id)}
                />
              ))
            ) : (
              <EmptyState
                icon={Compass}
                title={copy.discover.emptyTitle}
                body={copy.discover.emptyBody}
              />
            )}
            {(page.totalPages > 1 || query.page > 1) && (
              <View style={styles.pagination}>
                <PageButton
                  label={copy.discover.previous}
                  disabled={query.page === 1}
                  onPress={() => setQuery({ ...query, page: query.page - 1 })}
                />
                <Text style={styles.helper}>
                  {copy.discover.page(query.page, page.totalPages)}
                </Text>
                <PageButton
                  label={copy.discover.next}
                  disabled={query.page >= page.totalPages}
                  onPress={() => setQuery({ ...query, page: query.page + 1 })}
                />
              </View>
            )}
            <Text style={styles.privacy}>{copy.discover.privacy}</Text>
          </>
        )
      )}
    </Screen>
  );
}
function PageButton({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled: boolean;
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.pageButton, disabled && styles.disabled]}
    >
      <Text style={styles.helper}>{label}</Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  segments: {
    backgroundColor: colors.surface,
    padding: space.xs,
    flexDirection: 'row',
    borderRadius: radius.md,
    gap: space.xs,
  },
  segment: {
    flex: 1,
    borderRadius: radius.sm,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: {
    backgroundColor: colors.raised,
    borderBottomWidth: 2,
    borderBottomColor: colors.brand,
  },
  segmentText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  selectedText: { color: colors.brand },
  loading: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
  },
  helper: { color: colors.secondary, fontSize: 12 },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  resultCount: { color: colors.text, fontSize: 15, fontWeight: '600' },
  refresh: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: space.sm,
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    flexWrap: 'wrap',
  },
  pageButton: {
    minHeight: 44,
    backgroundColor: colors.raised,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    justifyContent: 'center',
  },
  disabled: { opacity: 0.4 },
  privacy: { color: colors.muted, fontSize: 12, lineHeight: 19 },
});
