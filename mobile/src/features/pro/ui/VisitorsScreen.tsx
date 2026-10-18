import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Eye, Sparkles } from 'lucide-react-native';
import { Screen } from '../../../shared/ui/Screen';
import { TopBar } from '../../../shared/ui/TopBar';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { Button } from '../../../shared/ui/Button';
import { copy } from '../../../shared/lib/copy';
import { useFocusedResource } from '../../../shared/lib/useFocusedResource';
import { colors, radius, space, type } from '../../../styles/tokens';
import type { ProService } from '../application/pro-service';
import type { VisitorTotals } from '../domain/models';
import { roleBreakdown, visitorKind, weeklyHeadline } from '../domain/visitors';
import { VisitorRowCard } from './VisitorRowCard';

export function VisitorsScreen({
  token,
  service,
  onBack,
  onUpgrade,
  onOpenProfile,
}: {
  token: string;
  service: ProService;
  onBack(): void;
  onUpgrade(): void;
  onOpenProfile(kind: 'players' | 'clubs' | 'coaches', id: string): void;
}) {
  const load = useCallback(() => service.visitors(token), [service, token]);
  const state = useFocusedResource(load);
  const now = new Date();
  const data = state.data;
  return (
    <Screen>
      <TopBar title={copy.visitors.title} onBack={onBack} />
      {state.loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.helper}>{copy.visitors.loading}</Text>
        </View>
      ) : state.error ? (
        <>
          <ErrorBanner message={state.error} />
          <Button label={copy.form.retry} onPress={state.retry} />
        </>
      ) : data ? (
        <>
          <Summary
            week={data.summary.week}
            window={data.summary.window}
            windowDays={data.windowDays}
          />
          {!data.isPro ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={copy.visitors.upgradeCta}
              accessibilityHint={copy.visitors.upgradeTitle}
              onPress={onUpgrade}
              style={({ pressed }) => [
                styles.upgrade,
                pressed && styles.pressed,
              ]}
            >
              <Sparkles size={16} color={colors.brand} />
              <Text style={styles.upgradeTitle}>
                {copy.visitors.upgradeTitle}
              </Text>
              <Text style={styles.upgradeCta}>{copy.visitors.upgradeCta}</Text>
            </Pressable>
          ) : null}
          {data.items.length ? (
            <View style={styles.list}>
              {data.items.map(row => {
                const kind =
                  row.kind === 'visitor' && row.visitor.canOpen
                    ? visitorKind(row.visitor.role)
                    : null;
                return (
                  <VisitorRowCard
                    key={row.key}
                    row={row}
                    now={now}
                    onOpen={
                      kind && row.kind === 'visitor'
                        ? () => onOpenProfile(kind, row.visitor.id)
                        : undefined
                    }
                  />
                );
              })}
            </View>
          ) : (
            <EmptyState
              icon={Eye}
              title={copy.visitors.emptyTitle}
              body={copy.visitors.emptyBody}
            />
          )}
        </>
      ) : null}
    </Screen>
  );
}

function Summary({
  week,
  window,
  windowDays,
}: {
  week: VisitorTotals;
  window: VisitorTotals;
  windowDays: number;
}) {
  const headline = weeklyHeadline(week);
  const text =
    headline.kind === 'role'
      ? copy.visitors.headline(
          headline.count,
          copy.visitors.roleNouns[headline.role],
        )
      : headline.kind === 'total'
      ? copy.visitors.headlineTotal(headline.count)
      : copy.visitors.headlineNone;
  const breakdown = roleBreakdown(window.byRole);
  return (
    <View style={styles.summary}>
      <Text accessibilityRole="header" style={styles.headline}>
        {text}
      </Text>
      <Text style={styles.helper}>
        {copy.visitors.window(windowDays) +
          ' · ' +
          copy.visitors.totals(window.visitors, window.visits)}
      </Text>
      {breakdown.length ? (
        <View style={styles.chips}>
          {breakdown.map(item => (
            <View key={item.role} style={styles.chip}>
              <Text style={styles.chipCount}>{item.count}</Text>
              <Text style={styles.chipLabel}>
                {copy.visitors.roleNouns[item.role]}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
  },
  helper: { color: colors.secondary, fontSize: 12, lineHeight: 18 },
  summary: {
    gap: space.sm,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  headline: { ...type.headline, color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.xs,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.raised,
  },
  chipCount: { ...type.number, color: colors.brand, fontWeight: '800' },
  chipLabel: { color: colors.secondary, fontSize: 12 },
  upgrade: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.brandSoft,
    backgroundColor: colors.brandWash,
  },
  pressed: { opacity: 0.8 },
  upgradeTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  upgradeCta: { color: colors.brand, fontSize: 13, fontWeight: '800' },
  list: { gap: space.sm },
});
