import React, { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MapPin,
} from 'lucide-react-native';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, shadow, space, type } from '../../../styles/tokens';
import type { FootballService } from '../application/football-service';
import { useFootballResource } from '../application/useFootballResource';
import type { Competition } from '../domain/models';
import { countMatches } from '../domain/rules';
import { ErrorBlock, LoadingBlock, SectionTitle } from './FootballStates';
import { RemoteLogo } from '../../../shared/ui/RemoteLogo';

const text = copy.footballData;

export function FootballLeaguesSection({
  token,
  service,
  onOpenCompetition,
  onOpenAnkara,
}: {
  token: string;
  service: FootballService;
  onOpenCompetition(competition: Competition): void;
  onOpenAnkara(): void;
}) {
  const load = useCallback(() => service.competitions(token), [service, token]);
  const { data, error, loading, retry } = useFootballResource(load);
  // The bulletin is cached on the server; a failure just hides the badge.
  const loadBulletin = useCallback(
    () => service.ankaraBulletin(token),
    [service, token],
  );
  const bulletin = useFootballResource(loadBulletin);
  const weekMatches = bulletin.data
    ? bulletin.data.days.reduce((sum, day) => sum + countMatches(day.venues), 0)
    : 0;
  return (
    <>
      <SectionTitle
        title={text.majorTitle}
        description={text.majorDescription}
      />
      {loading ? (
        <LoadingBlock label={text.competitionsLoading} />
      ) : error ? (
        <ErrorBlock error={error} onRetry={retry} />
      ) : data ? (
        <CompetitionRail items={data.competitions} onOpen={onOpenCompetition} />
      ) : null}
      {data && data.cups.length ? (
        <>
          <SectionTitle
            title={text.cupsTitle}
            description={text.cupsDescription}
          />
          <CompetitionRail items={data.cups} onOpen={onOpenCompetition} />
        </>
      ) : null}
      <AnkaraCard
        title={data?.ankara.name || text.ankaraTitle}
        source={data?.ankara.source || text.ankaraSourceDefault}
        weekMatches={weekMatches}
        onPress={onOpenAnkara}
      />
    </>
  );
}

// One swipeable row of compact cards; the screen's side padding is cancelled
// so cards slide to the screen edge. Edge arrows show only while more cards
// lie in that direction and page the row by whole cards.
function CompetitionRail({
  items,
  onOpen,
}: {
  items: Competition[];
  onOpen(competition: Competition): void;
}) {
  const scroll = useRef<ScrollView>(null);
  const [offset, setOffset] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const [width, setWidth] = useState(0);
  const step = CARD_WIDTH + space.md;
  const canBack = offset > 1;
  const canForward = offset + width < contentWidth - 1;
  const page = (direction: 1 | -1) => {
    const cards = Math.max(1, Math.floor((width - space.xl * 2) / step));
    scroll.current?.scrollTo({
      x: Math.max(0, offset + direction * cards * step),
      animated: true,
    });
  };
  return (
    <View style={styles.railBleed}>
      <ScrollView
        ref={scroll}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={step}
        contentContainerStyle={styles.rail}
        scrollEventThrottle={32}
        onScroll={event => setOffset(event.nativeEvent.contentOffset.x)}
        onContentSizeChange={setContentWidth}
        onLayout={event => setWidth(event.nativeEvent.layout.width)}
      >
        {items.map(item => (
          <CompetitionCard
            key={item.slug}
            competition={item}
            onPress={() => onOpen(item)}
          />
        ))}
      </ScrollView>
      {canBack ? (
        <RailArrow
          side="left"
          label={text.railPrevious}
          onPress={() => page(-1)}
        />
      ) : null}
      {canForward ? (
        <RailArrow side="right" label={text.railNext} onPress={() => page(1)} />
      ) : null}
    </View>
  );
}

function RailArrow({
  side,
  label,
  onPress,
}: {
  side: 'left' | 'right';
  label: string;
  onPress(): void;
}) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight;
  return (
    <View
      pointerEvents="box-none"
      style={[styles.arrowSlot, side === 'left' ? styles.left : styles.right]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        hitSlop={8}
        onPress={onPress}
        style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
      >
        <Icon size={20} color={colors.brand} strokeWidth={2.4} />
      </Pressable>
    </View>
  );
}

function CompetitionCard({
  competition,
  onPress,
}: {
  competition: Competition;
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={text.openCompetition(competition.name)}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.badge}>
        <RemoteLogo
          uri={competition.logoUrl}
          name={competition.name}
          size={28}
        />
      </View>
      <Text numberOfLines={2} style={styles.cardName}>
        {competition.name}
      </Text>
      <Text numberOfLines={1} style={styles.cardCountry}>
        {competition.country}
      </Text>
    </Pressable>
  );
}

function AnkaraCard({
  title,
  source,
  weekMatches,
  onPress,
}: {
  title: string;
  source: string;
  weekMatches: number;
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        weekMatches > 0
          ? text.openAnkara + ', ' + text.weekBadge(weekMatches)
          : text.openAnkara
      }
      accessibilityHint={text.ankaraDescription}
      onPress={onPress}
      style={({ pressed }) => [styles.wide, pressed && styles.pressed]}
    >
      <View style={styles.wideIcon}>
        <MapPin size={22} color={colors.brand} />
      </View>
      <View style={styles.wideContent}>
        <Text style={styles.wideTitle}>{title}</Text>
        <Text style={styles.source}>{source}</Text>
        {weekMatches > 0 ? (
          <View style={styles.weekBadge}>
            <CalendarDays size={13} color={colors.brandInk} />
            <Text style={styles.weekBadgeText}>
              {text.matchCount(weekMatches)}
            </Text>
          </View>
        ) : null}
      </View>
      <ArrowRight size={19} color={colors.muted} />
    </Pressable>
  );
}

export const CARD_WIDTH = 112;
const styles = StyleSheet.create({
  railBleed: { marginHorizontal: -space.xl },
  rail: { gap: space.md, paddingHorizontal: space.xl },
  arrowSlot: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  left: { left: space.sm },
  right: { right: space.sm },
  arrow: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.layer,
  },
  card: {
    width: CARD_WIDTH,
    minHeight: 112,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderColor: colors.hairline,
    borderWidth: 1,
    padding: space.md,
    alignItems: 'flex-start',
    gap: 2,
  },
  // League logos are often dark; a light badge keeps them readable on the night background.
  badge: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  cardName: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  cardCountry: { ...type.caption, fontSize: 11, color: colors.muted },
  wide: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderColor: colors.hairline,
    borderWidth: 1,
    padding: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    overflow: 'hidden',
  },
  wideIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.brandWash,
    borderWidth: 1,
    borderColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wideContent: { flex: 1, minWidth: 0, gap: space.xs },
  wideTitle: { ...type.headline, color: colors.text },
  source: { ...type.caption, fontSize: 11, color: colors.muted },
  weekBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    marginTop: space.xs,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
  },
  weekBadgeText: {
    ...type.number,
    color: colors.brandInk,
    fontSize: 12,
    fontWeight: '800',
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
});
