import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import {
  ChevronRight,
  EyeOff,
  Lock,
  Shield,
  UserRound,
  Whistle,
  type LucideIcon,
} from 'lucide-react-native';
import {
  formatRelative,
  type ProfileVisitors,
  type VisitorRow,
} from '../features/pro';
import { ProBadge } from '../shared/ui/ProBadge';
import { useReducedMotion } from '../shared/lib/useReducedMotion';
import { copy } from '../shared/lib/copy';
import { colors, radius, space, type } from '../styles/tokens';

type Role = 'club' | 'player' | 'coach' | 'organizer' | 'hidden';
const tone: Record<Role, { color: string; wash: string; icon: LucideIcon }> = {
  club: { color: colors.brand, wash: colors.brandWash, icon: Shield },
  player: { color: colors.accent, wash: colors.accentWash, icon: UserRound },
  coach: { color: colors.info, wash: colors.infoWash, icon: Whistle },
  organizer: { color: colors.warning, wash: colors.raised, icon: UserRound },
  hidden: { color: colors.muted, wash: colors.raised, icon: EyeOff },
};
const order: Role[] = ['club', 'player', 'coach', 'hidden'];
const MAX_ROWS = 5;

function rowRole(row: VisitorRow): Role {
  return row.kind === 'visitor'
    ? row.visitor.role
    : row.kind === 'obscured'
    ? row.role
    : 'hidden';
}

// The visitors part of the Social side panel: this week's count, an avatar
// stack, a role breakdown bar and the latest visits. Without Pro the names
// stay hidden (grey bars and a lock) and a Pro card invites the upgrade.
export function SidebarVisitors({
  data,
  onOpen,
  onUpgrade,
}: {
  data: ProfileVisitors;
  onOpen(): void;
  onUpgrade(): void;
}) {
  const text = copy.social.sidebar.visitorsPanel;
  const week = data.summary.week;
  const window = data.summary.window;
  const byRole = order.map(role => ({
    role,
    count: window.byRole[role] ?? 0,
  }));
  const total = byRole.reduce((sum, item) => sum + item.count, 0);
  const rows = data.items.slice(0, MAX_ROWS);
  const stack = data.items.slice(0, 4);
  const extra = Math.max(0, window.visitors - stack.length);
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.eyebrow}>{text.eyebrow}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={text.seeAll}
          onPress={onOpen}
          hitSlop={8}
          style={styles.seeAll}
        >
          <Text style={styles.seeAllText}>{text.seeAll}</Text>
          <ChevronRight size={14} color={colors.brand} />
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          copy.visitors.headlineTotal(week.visitors) +
          '. ' +
          copy.visitors.totals(window.visitors, window.visits)
        }
        onPress={onOpen}
        style={({ pressed }) => [styles.hero, pressed && styles.pressed]}
      >
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <LinearGradient id="visitorsHero" x1="1" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.brand} stopOpacity={0.2} />
              <Stop offset="0.75" stopColor={colors.brand} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#visitorsHero)" />
        </Svg>
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.bigNumber}>{week.visitors}</Text>
            <Text style={styles.heroLabel}>{text.thisWeek}</Text>
          </View>
          <View style={styles.stack}>
            {stack.map((row, index) => {
              const role = rowRole(row);
              const Icon = tone[role].icon;
              return (
                <View
                  key={row.key}
                  style={[
                    styles.stackAvatar,
                    index > 0 && styles.stackOverlap,
                    { backgroundColor: tone[role].wash },
                  ]}
                >
                  {data.isPro && row.kind === 'visitor' ? (
                    <Text
                      style={[styles.stackInitial, { color: tone[role].color }]}
                    >
                      {Array.from(
                        row.visitor.fullName.trim(),
                      )[0]?.toLocaleUpperCase('tr-TR')}
                    </Text>
                  ) : (
                    <Icon size={14} color={tone[role].color} />
                  )}
                </View>
              );
            })}
            {extra > 0 ? (
              <View style={[styles.stackAvatar, styles.stackMore]}>
                <Text style={styles.stackMoreText}>+{extra}</Text>
              </View>
            ) : null}
          </View>
        </View>
        <Text style={styles.heroTotals}>
          {text.windowTotals(data.windowDays, window.visitors, window.visits)}
        </Text>
        {total > 0 ? (
          <>
            <View style={styles.bar}>
              {byRole
                .filter(item => item.count > 0)
                .map(item => (
                  <View
                    key={item.role}
                    style={{
                      flex: item.count,
                      backgroundColor: tone[item.role].color,
                    }}
                  />
                ))}
            </View>
            <View style={styles.legend}>
              {byRole
                .filter(item => item.count > 0)
                .map(item => (
                  <View key={item.role} style={styles.legendItem}>
                    <View
                      style={[
                        styles.legendDot,
                        { backgroundColor: tone[item.role].color },
                      ]}
                    />
                    <Text style={styles.legendText}>
                      {item.count} {copy.visitors.roleNouns[item.role]}
                    </Text>
                  </View>
                ))}
            </View>
          </>
        ) : null}
      </Pressable>

      <View style={styles.list}>
        <Text style={styles.listTitle}>{text.recent}</Text>
        <View style={[styles.rows, !data.isPro && styles.lockedRows]}>
          {rows.length ? (
            rows.map(row => (
              <VisitRow key={row.key} row={row} isPro={data.isPro} />
            ))
          ) : (
            <Text style={styles.empty}>{copy.visitors.emptyBody}</Text>
          )}
          {!data.isPro ? (
            <ProOverlay data={data} onUpgrade={onUpgrade} />
          ) : null}
        </View>
      </View>
    </View>
  );
}

// Two seconds after the hidden visitors appear, a Pro card rises over them.
// Reduced motion shows it after the same pause without movement.
function ProOverlay({
  data,
  onUpgrade,
}: {
  data: ProfileVisitors;
  onUpgrade(): void;
}) {
  const text = copy.social.sidebar.visitorsPanel;
  const reduced = useReducedMotion();
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    enter.setValue(0);
    const animation = Animated.sequence([
      Animated.delay(2000),
      reduced
        ? Animated.timing(enter, {
            toValue: 1,
            duration: 0,
            useNativeDriver: true,
          })
        : Animated.spring(enter, {
            toValue: 1,
            friction: 7,
            tension: 60,
            useNativeDriver: true,
          }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [data, reduced, enter]);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* The rows fade into the panel background under the card. */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            opacity: enter.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 1],
              extrapolate: 'clamp',
            }),
          },
        ]}
      >
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="visitorsFade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.surface} stopOpacity={0.2} />
              <Stop
                offset="0.35"
                stopColor={colors.surface}
                stopOpacity={0.85}
              />
              <Stop offset="1" stopColor={colors.surface} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#visitorsFade)" />
        </Svg>
      </Animated.View>
      <Animated.View
        style={[
          styles.proCard,
          {
            opacity: enter.interpolate({
              inputRange: [0, 0.6],
              outputRange: [0, 1],
              extrapolate: 'clamp',
            }),
            transform: [
              {
                translateY: enter.interpolate({
                  inputRange: [0, 1],
                  outputRange: [40, 0],
                }),
              },
              {
                scale: enter.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.92, 1],
                }),
              },
            ],
          },
        ]}
      >
        <ProBadge />
        <Text style={styles.proTitle}>{text.proTitle}</Text>
        <Text style={styles.proBody}>{text.proBody}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={text.proCta}
          onPress={onUpgrade}
          style={({ pressed }) => [styles.proButton, pressed && styles.pressed]}
        >
          <Text style={styles.proButtonText}>{text.proCta}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

function VisitRow({ row, isPro }: { row: VisitorRow; isPro: boolean }) {
  const role = rowRole(row);
  const { color, wash, icon: Icon } = tone[role];
  const when = formatRelative(row.lastVisitedAt);
  const roleName =
    role === 'hidden' ? copy.visitors.privateRow : copy.roles[role as 'club'];
  const district =
    row.kind === 'visitor'
      ? row.visitor.district
      : row.kind === 'obscured'
      ? row.district
      : '';
  const detail = [roleName, district, when].filter(Boolean).join(' · ');
  const named = row.kind === 'visitor' && (isPro || row.visitor.canOpen);
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={
        named && row.kind === 'visitor'
          ? row.visitor.fullName + ', ' + detail
          : copy.visitors.locked + ' ' + detail
      }
    >
      <View style={[styles.rowIcon, { backgroundColor: wash }]}>
        <Icon size={16} color={color} />
      </View>
      <View style={styles.rowBody}>
        {named && row.kind === 'visitor' ? (
          <Text numberOfLines={1} style={styles.rowName}>
            {row.visitor.fullName}
          </Text>
        ) : (
          <View style={styles.ghost} />
        )}
        <Text numberOfLines={1} style={styles.rowDetail}>
          {detail}
        </Text>
      </View>
      {named ? null : <Lock size={13} color={colors.muted} />}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.md },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: {
    color: colors.brand,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
  },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAllText: { color: colors.brand, fontSize: 12, fontWeight: '700' },
  pressed: { opacity: 0.85 },
  hero: {
    padding: space.lg,
    gap: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.brandSoft,
    overflow: 'hidden',
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  bigNumber: {
    color: colors.text,
    fontSize: 44,
    lineHeight: 48,
    fontWeight: '800',
    letterSpacing: -1.5,
    fontVariant: ['tabular-nums'],
  },
  heroLabel: { color: colors.secondary, fontSize: 12, fontWeight: '600' },
  stack: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: space.xs,
  },
  stackAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.raised,
  },
  stackInitial: { fontSize: 12, fontWeight: '800' },
  stackOverlap: { marginLeft: -10 },
  stackMore: { marginLeft: -10, backgroundColor: colors.overlay },
  stackMoreText: { color: colors.text, fontSize: 10, fontWeight: '800' },
  heroTotals: { ...type.caption, color: colors.muted },
  bar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: radius.pill,
    overflow: 'hidden',
    gap: 2,
  },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: colors.secondary, fontSize: 11, fontWeight: '700' },
  list: { gap: space.sm },
  listTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  empty: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1, gap: 4 },
  rowName: { color: colors.text, fontSize: 13, fontWeight: '700' },
  ghost: {
    width: '62%',
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.overlay,
  },
  rowDetail: { ...type.caption, color: colors.muted },
  rows: { gap: space.sm },
  lockedRows: { minHeight: 230 },
  proCard: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    gap: space.sm,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.brand,
    shadowColor: colors.brand,
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  proTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  proBody: {
    color: colors.secondary,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  proButton: {
    alignSelf: 'stretch',
    marginTop: space.xs,
    minHeight: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
  },
  proButtonText: { color: colors.brandInk, fontSize: 14, fontWeight: '800' },
});
