import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ArrowLeft, Check, Crown, Flame, X } from 'lucide-react-native';
import { colors, radius, shadow, space, type } from '../../../styles/tokens';
import { copy } from '../../../shared/lib/copy';
import { useReducedMotion } from '../../../shared/lib/useReducedMotion';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { RemoteLogo } from '../../../shared/ui/RemoteLogo';
import type { HeadToHeadService } from '../application/head-to-head-service';
import { useHeadToHead } from '../application/useHeadToHead';
import type {
  HeadToHeadMetric,
  HeadToHeadPick,
  HeadToHeadTeam,
} from '../domain/head-to-head';

const text = copy.games.headToHead;
// How long a correct answer's values stay on screen before the next round.
export const revealMs = 1100;

function formatValue(metric: HeadToHeadMetric, value: number) {
  if (metric === 'rank') return value + '.';
  if (metric === 'goalDiff' && value > 0) return '+' + value;
  return String(value);
}

export function HeadToHead({
  service,
  token,
  onBack,
}: {
  service: HeadToHeadService;
  token: string;
  onBack(): void;
}) {
  const game = useHeadToHead(service, token);
  const reduced = useReducedMotion();
  const flash = useRef(new Animated.Value(0)).current;
  const { phase, round, result, next } = game;

  // Colour flash on every answer; reduced motion keeps only the static tint.
  useEffect(() => {
    if (!result || reduced) return;
    flash.setValue(0);
    Animated.sequence([
      Animated.timing(flash, {
        toValue: 1,
        duration: 140,
        useNativeDriver: true,
      }),
      Animated.timing(flash, {
        toValue: 0,
        duration: 420,
        useNativeDriver: true,
      }),
    ]).start();
  }, [flash, reduced, result]);

  useEffect(() => {
    if (phase !== 'reveal') return;
    const timer = setTimeout(next, revealMs);
    return () => clearTimeout(timer);
  }, [next, phase]);

  const flashColor = result?.correct ? colors.success : colors.danger;

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.top}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.games.back}
            onPress={onBack}
            style={styles.back}
          >
            <ArrowLeft size={19} color={colors.text} />
            <Text style={styles.backText}>{copy.games.back}</Text>
          </Pressable>
          <View style={styles.counters}>
            <View
              accessible
              accessibilityLabel={text.streak(game.streak)}
              style={[styles.counter, styles.streak]}
            >
              <Flame
                size={16}
                color={colors.warning}
                fill={game.streak > 0 ? colors.warning : colors.transparent}
              />
              <Text style={[styles.counterValue, styles.streakValue]}>
                {game.streak}
              </Text>
            </View>
            <View
              accessible
              accessibilityLabel={text.best(game.best)}
              style={styles.counter}
            >
              <Crown size={14} color={colors.secondary} />
              <Text style={styles.counterValue}>{game.best}</Text>
            </View>
          </View>
        </View>

        {phase === 'loading' ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.brand} />
            <Text style={styles.muted}>{text.loading}</Text>
          </View>
        ) : phase === 'failed' || !round ? (
          <View style={styles.failed}>
            <ErrorBanner message={game.error || copy.form.unexpected} />
            <Button
              label={copy.form.retry}
              loading={game.busy}
              onPress={game.start}
            />
          </View>
        ) : (
          <>
            <View
              accessible
              accessibilityLabel={text.league(round.league.name)}
              style={styles.league}
            >
              <View style={styles.leagueBadge}>
                <RemoteLogo
                  uri={round.league.logoUrl}
                  name={round.league.name}
                  size={16}
                />
              </View>
              <Text numberOfLines={1} style={styles.leagueName}>
                {round.league.name}
              </Text>
            </View>
            <View style={styles.question}>
              <Text accessibilityRole="header" style={styles.questionText}>
                {round.question.label}
              </Text>
            </View>

            <View style={styles.faceOff}>
              {(['left', 'right'] as HeadToHeadPick[]).map((side, i) => (
                <React.Fragment key={side}>
                  {i === 1 ? (
                    <View
                      style={styles.vs}
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                    >
                      <Text style={styles.vsText}>{text.vs}</Text>
                    </View>
                  ) : null}
                  <ClubCard
                    team={round[side]}
                    value={
                      result
                        ? formatValue(
                            round.question.metric,
                            result.values[side],
                          )
                        : null
                    }
                    state={
                      !result
                        ? game.picked === side
                          ? 'picked'
                          : 'idle'
                        : game.picked === side
                        ? result.correct
                          ? 'correct'
                          : 'wrong'
                        : result.correct
                        ? 'idle'
                        : 'winner'
                    }
                    disabled={
                      game.busy ||
                      !!result ||
                      (!!game.picked && game.picked !== side)
                    }
                    onPress={() => game.answer(side)}
                  />
                </React.Fragment>
              ))}
            </View>

            {result ? (
              <View
                accessibilityLiveRegion="polite"
                accessibilityRole="alert"
                style={[
                  styles.verdict,
                  result.correct ? styles.verdictGood : styles.verdictBad,
                ]}
              >
                {result.correct ? (
                  <Check size={18} color={colors.success} />
                ) : (
                  <X size={18} color={colors.danger} />
                )}
                <Text
                  style={[
                    styles.verdictText,
                    result.correct ? styles.valueGood : styles.valueBad,
                  ]}
                >
                  {result.correct ? text.correct : text.wrong}
                </Text>
              </View>
            ) : game.busy ? (
              <ActivityIndicator color={colors.brand} />
            ) : null}

            <ErrorBanner message={game.error} />

            {phase === 'over' && result ? (
              <View style={styles.over}>
                <Text style={styles.overTitle}>{text.over}</Text>
                <View style={styles.overScore}>
                  <Flame size={30} color={colors.warning} />
                  <Text style={styles.overStreak}>{result.streak}</Text>
                  <Text style={styles.overUnit}>{text.streakUnit}</Text>
                </View>
                {result.streak > 0 && result.streak === result.best ? (
                  <Text style={styles.newBest}>{text.newBest}</Text>
                ) : (
                  <Text style={styles.muted}>{text.best(result.best)}</Text>
                )}
                <Button
                  label={text.again}
                  loading={game.busy}
                  onPress={game.start}
                />
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
      {result ? (
        <Animated.View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[
            styles.flash,
            {
              backgroundColor: flashColor,
              opacity: Animated.multiply(flash, 0.18),
            },
          ]}
        />
      ) : null}
    </View>
  );
}

function ClubCard({
  team,
  value,
  state,
  disabled,
  onPress,
}: {
  team: HeadToHeadTeam;
  value: string | null;
  state: 'idle' | 'picked' | 'correct' | 'wrong' | 'winner';
  disabled: boolean;
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        value ? text.value(team.name, value) : text.pick(team.name)
      }
      accessibilityState={{
        disabled,
        selected:
          state === 'picked' || state === 'correct' || state === 'wrong',
      }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        state === 'picked' && styles.cardPicked,
        state === 'correct' && styles.cardCorrect,
        state === 'wrong' && styles.cardWrong,
        state === 'winner' && styles.cardWinner,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.crest}>
        <RemoteLogo uri={team.logoUrl} name={team.name} size={64} />
      </View>
      <Text numberOfLines={2} style={styles.teamName}>
        {team.name}
      </Text>
      <Text
        style={[
          styles.value,
          !value && styles.valueHidden,
          (state === 'correct' || state === 'winner') && styles.valueGood,
          state === 'wrong' && styles.valueBad,
        ]}
      >
        {value ?? '?'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    padding: space.lg,
    paddingTop: space.xl,
    paddingBottom: 180,
    gap: space.xl,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  back: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  backText: { color: colors.secondary, fontSize: 11, fontWeight: '700' },
  counters: { flexDirection: 'row', gap: space.sm },
  counter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  streak: { borderColor: colors.warning },
  counterValue: {
    color: colors.secondary,
    fontSize: 15,
    fontWeight: '800',
    ...type.number,
  },
  streakValue: { color: colors.text },
  loading: { alignItems: 'center', gap: space.md, paddingTop: space.xxxl },
  failed: { gap: space.lg },
  muted: { color: colors.muted, fontSize: 12, textAlign: 'center' },
  league: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: space.sm,
  },
  leagueBadge: {
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leagueName: {
    color: colors.secondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  question: {
    alignSelf: 'center',
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    borderRadius: radius.pill,
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.brandSoft,
  },
  questionText: {
    color: colors.text,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  faceOff: { flexDirection: 'row', alignItems: 'stretch' },
  vs: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  vsText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  card: {
    flex: 1,
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.xl,
    paddingHorizontal: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    ...shadow.layer,
  },
  cardPicked: { borderColor: colors.brand },
  cardCorrect: { borderColor: colors.success, backgroundColor: colors.raised },
  cardWrong: { borderColor: colors.danger, backgroundColor: colors.dangerWash },
  cardWinner: { borderColor: colors.success },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  crest: {
    width: 96,
    height: 96,
    borderRadius: radius.pill,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.brandSoft,
    ...shadow.glow,
    shadowOpacity: 0.2,
  },
  teamName: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
    textAlign: 'center',
    minHeight: 38,
  },
  value: {
    color: colors.text,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    letterSpacing: -1,
    ...type.number,
  },
  valueHidden: { color: colors.muted },
  valueGood: { color: colors.success },
  valueBad: { color: colors.danger },
  verdict: {
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  verdictGood: { borderColor: colors.success },
  verdictBad: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerWash,
  },
  verdictText: { fontSize: 15, fontWeight: '800' },
  over: {
    alignItems: 'stretch',
    gap: space.md,
    padding: space.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  overTitle: {
    color: colors.text,
    ...type.title,
    textAlign: 'center',
  },
  overScore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  overStreak: {
    color: colors.text,
    fontSize: 64,
    lineHeight: 72,
    fontWeight: '800',
    letterSpacing: -3,
    ...type.number,
  },
  overUnit: { color: colors.muted, fontSize: 18, fontWeight: '700' },
  newBest: {
    color: colors.brand,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  flash: { ...StyleSheet.absoluteFillObject },
});
