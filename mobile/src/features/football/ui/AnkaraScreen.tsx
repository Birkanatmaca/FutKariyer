import React, { useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  CalendarDays,
  ListOrdered,
  Megaphone,
  type LucideIcon,
} from 'lucide-react-native';
import { BackLink } from '../../../shared/ui/BackLink';
import { Floodlight } from '../../../shared/ui/Floodlight';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space, type } from '../../../styles/tokens';
import type { FootballService } from '../application/football-service';
import { useAnkaraBulletin } from '../application/useAnkaraBulletin';
import { useAnkaraLeagues } from '../application/useAnkaraLeagues';
import { useAnkaraPosts } from '../application/useAnkaraPosts';
import { AnkaraPostsTab } from './AnkaraPostsTab';
import { AnkaraStandingsTab } from './AnkaraStandingsTab';
import { AnkaraWeekTab } from './AnkaraWeekTab';

const text = copy.footballData;
export type AnkaraTab = 'standings' | 'week' | 'posts';
const tabs: { key: AnkaraTab; icon: LucideIcon }[] = [
  { key: 'standings', icon: ListOrdered },
  { key: 'week', icon: CalendarDays },
  { key: 'posts', icon: Megaphone },
];

// TFF Ankara hub: standings by season/league/group, this week's bulletin of
// every league, and the federation's posts. Each tab loads when first shown.
export function AnkaraScreen({
  token,
  service,
  onBack,
  initialTab = 'standings',
}: {
  token: string;
  service: FootballService;
  onBack(): void;
  initialTab?: AnkaraTab;
}) {
  const [tab, setTab] = useState<AnkaraTab>(initialTab);
  const leagues = useAnkaraLeagues(service, token, tab === 'standings');
  const bulletin = useAnkaraBulletin(service, token, tab === 'week');
  const posts = useAnkaraPosts(service, token, tab === 'posts');
  const active =
    tab === 'standings' ? leagues : tab === 'week' ? bulletin : posts;
  const source =
    (tab === 'standings'
      ? leagues.data?.source
      : tab === 'week'
      ? bulletin.data?.source
      : posts.data?.source) || text.ankaraSourceDefault;
  const onRefresh = active.refresh;
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
      <Floodlight />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={active.refreshing}
            onRefresh={onRefresh}
            tintColor={colors.brand}
            colors={[colors.brand]}
          />
        }
      >
        <BackLink label={text.back} onPress={onBack} />
        <View style={styles.header}>
          <PageHeader
            eyebrow={text.ankaraEyebrow}
            title={text.ankaraTitle}
            hint={text.ankaraDescription}
          />
          <Text style={styles.source}>{text.source(source)}</Text>
        </View>
        <Segments value={tab} onChange={setTab} />
        {tab === 'standings' ? (
          <AnkaraStandingsTab
            data={leagues.data}
            query={leagues.query}
            error={leagues.error}
            loading={leagues.loading}
            retry={leagues.retry}
            select={leagues.select}
          />
        ) : tab === 'week' ? (
          <AnkaraWeekTab
            data={bulletin.data}
            error={bulletin.error}
            loading={bulletin.loading}
            retry={bulletin.retry}
          />
        ) : (
          <AnkaraPostsTab
            items={posts.items}
            error={posts.error}
            loading={posts.loading}
            retry={posts.retry}
            hasMore={posts.hasMore}
            loadingMore={posts.loadingMore}
            moreError={posts.moreError}
            loadMore={posts.loadMore}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Segments({
  value,
  onChange,
}: {
  value: AnkaraTab;
  onChange(tab: AnkaraTab): void;
}) {
  return (
    <View style={styles.segments} accessibilityRole="tablist">
      {tabs.map(({ key, icon: Icon }) => {
        const selected = key === value;
        return (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            aria-selected={selected}
            accessibilityHint={text.ankaraTabHints[key]}
            onPress={() => onChange(key)}
            style={({ pressed }) => [
              styles.segment,
              selected && styles.segmentSelected,
              pressed && styles.pressed,
            ]}
          >
            <Icon size={18} color={selected ? colors.brand : colors.muted} />
            <Text
              numberOfLines={1}
              style={[styles.segmentText, selected && styles.segmentTextOn]}
            >
              {text.ankaraTabs[key]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: {
    padding: space.xl,
    gap: space.xl,
    paddingBottom: 120,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
    flexGrow: 1,
  },
  header: { gap: space.sm },
  source: { ...type.caption, fontSize: 11, color: colors.muted },
  segments: {
    flexDirection: 'row',
    padding: space.xs,
    gap: space.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  segment: {
    flex: 1,
    minHeight: 52,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: space.xs,
    borderWidth: 1,
    borderColor: colors.transparent,
  },
  segmentSelected: {
    backgroundColor: colors.overlay,
    borderColor: colors.brandSoft,
  },
  segmentText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  segmentTextOn: { color: colors.text },
  pressed: { opacity: 0.85 },
});
