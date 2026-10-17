import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';
import { ArrowLeft, Trophy } from 'lucide-react-native';
import { colors, radius, space } from '../../../styles/tokens';
import { copy } from '../../../shared/lib/copy';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import type { GamesService } from '../application/games-service';
import { usePenaltyShootout } from '../application/usePenaltyShootout';
import type { PenaltyKick, Side } from '../domain/models';
import { penaltySides as sides } from '../domain/penalty';
import { GoalkeeperArt } from './GoalkeeperArt';
import { PlaysMeter } from './PlaysMeter';

const text = copy.games.penalty;
const ratio: Record<Side, number> = {
  left: 1 / 6,
  center: 1 / 2,
  right: 5 / 6,
};
const ballRatio = 0.08;

export function PenaltyShootout({
  service,
  token,
  onBack,
}: {
  service: GamesService;
  token: string;
  onBack(): void;
}) {
  const game = usePenaltyShootout(service, token);
  const { width } = useWindowDimensions();
  const scene = Math.min(width - space.lg * 2, 400);
  const goalHeight = scene * 0.6;
  const sceneHeight = goalHeight + 56;
  const ball = scene * ballRatio;
  const keeperHeight = goalHeight * 0.78;

  const keeperShift = useRef(new Animated.Value(0)).current;
  const ballX = useRef(new Animated.Value(0)).current;
  const ballY = useRef(new Animated.Value(0)).current;

  const { phase, lastKick, match } = game;

  useEffect(() => {
    // Offset from the centre of the scene, used for both keeper and ball.
    const offsetX = (side: Side) => (ratio[side] - 0.5) * scene;
    const ballStartY = goalHeight + 30;
    if (phase === 'reveal' && lastKick) {
      const { role, userSide, cpuSide } = lastKick;
      const dive = role === 'shooter' ? cpuSide : userSide;
      const shot = role === 'shooter' ? userSide : cpuSide;
      Animated.parallel([
        Animated.timing(keeperShift, {
          toValue: offsetX(dive),
          duration: 280,
          useNativeDriver: false,
        }),
        Animated.timing(ballX, {
          toValue: offsetX(shot),
          duration: 320,
          useNativeDriver: false,
        }),
        Animated.timing(ballY, {
          toValue: goalHeight * 0.5 - ballStartY,
          duration: 320,
          useNativeDriver: false,
        }),
      ]).start();
    } else if (phase === 'choose') {
      keeperShift.setValue(0);
      ballX.setValue(0);
      ballY.setValue(0);
    }
  }, [phase, lastKick, scene, goalHeight, keeperShift, ballX, ballY]);

  const kicks = match?.kicks ?? [];
  const kickCount = kicks.length;
  const displayedRole =
    phase === 'reveal' && lastKick
      ? lastKick.role
      : match?.nextRole || 'shooter';
  const kickNumber = phase === 'choose' ? kickCount + 1 : kickCount;
  const suddenDeath = kickNumber > 10;
  const userChoice = lastKick?.userSide;
  const goals = match?.goals ?? { user: 0, cpu: 0 };
  const remaining = game.nextResetAt
    ? Math.max(
        0,
        Math.round((Date.parse(game.nextResetAt) - Date.now()) / 1000),
      )
    : 0;
  const noMatch = !match;

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.top}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.games.back}
          disabled={game.busy}
          onPress={onBack}
          style={styles.back}
        >
          <ArrowLeft size={19} color={colors.text} />
          <Text style={styles.backText}>{copy.games.back}</Text>
        </Pressable>
        {match ? (
          <View style={styles.score}>
            <Trophy size={13} color={colors.brand} />
            <Text style={styles.scoreText}>
              {text.score(goals.user, goals.cpu)}
            </Text>
          </View>
        ) : null}
      </View>

      {game.loading && !match ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.role}>{copy.games.loading}</Text>
        </View>
      ) : noMatch ? (
        <>
          <View style={styles.intro}>
            <Text style={styles.kickLabel}>{text.kicks}</Text>
            <Text accessibilityRole="header" style={styles.introTitle}>
              {text.name}
            </Text>
            <Text style={styles.role}>{text.tagline}</Text>
          </View>
          {game.plays ? (
            <PlaysMeter plays={game.plays} remaining={remaining} />
          ) : null}
          <View style={styles.rules}>
            <Text style={styles.rulesTitle}>{text.rulesTitle}</Text>
            {text.rules.map((rule, i) => (
              <View key={rule} style={styles.rule}>
                <View style={styles.ruleIndex}>
                  <Text style={styles.ruleNumber}>{i + 1}</Text>
                </View>
                <Text style={styles.ruleBody}>{rule}</Text>
              </View>
            ))}
          </View>
          <ErrorBanner message={game.error} />
          <Button
            label={text.play}
            loading={game.busy}
            disabled={!game.canStart}
            onPress={game.start}
          />
          <Text style={styles.noStakes}>
            {game.canStart ? text.cost : copy.games.wait}
          </Text>
        </>
      ) : (
        <>
          <View style={styles.meta}>
            <Text style={styles.kickLabel}>
              {suddenDeath ? text.suddenDeath : text.kickLabel(kickNumber)}
            </Text>
            <Text style={styles.role}>
              {displayedRole === 'shooter' ? text.shooterRole : text.keeperRole}
            </Text>
          </View>
          <View style={styles.progress}>
            {Array.from({ length: 10 }, (_, i) => (
              <View
                key={i}
                style={[
                  styles.step,
                  i < kickCount && styles.completed,
                  i === kickCount && phase === 'choose' && styles.current,
                ]}
              />
            ))}
          </View>

          <View style={[styles.scene, { width: scene, height: sceneHeight }]}>
            <Svg
              width={scene}
              height={goalHeight}
              viewBox="0 0 300 180"
              style={styles.goal}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              {[60, 120, 180, 240].map(x => (
                <Line
                  key={'v' + x}
                  x1={x}
                  y1={8}
                  x2={x}
                  y2={180}
                  stroke={colors.pitchLine}
                  strokeWidth={1}
                />
              ))}
              {[30, 60, 90, 120, 150].map(y => (
                <Line
                  key={'h' + y}
                  x1={6}
                  y1={y}
                  x2={294}
                  y2={y}
                  stroke={colors.pitchLine}
                  strokeWidth={1}
                />
              ))}
              <Path
                d="M6 180 V8 H294 V180"
                fill="none"
                stroke={colors.text}
                strokeWidth={6}
              />
            </Svg>
            <View style={[styles.ground, { top: goalHeight }]} />

            <Animated.View
              style={[
                styles.keeper,
                {
                  left: scene / 2 - (keeperHeight * 0.6) / 2,
                  top: goalHeight - keeperHeight,
                  transform: [{ translateX: keeperShift }],
                },
              ]}
            >
              <GoalkeeperArt height={keeperHeight} />
            </Animated.View>

            <Animated.View
              style={[
                styles.ball,
                {
                  width: ball,
                  height: ball,
                  borderRadius: ball / 2,
                  left: scene / 2 - ball / 2,
                  top: goalHeight + 30 - ball / 2,
                  transform: [{ translateX: ballX }, { translateY: ballY }],
                },
              ]}
            />
          </View>

          {phase === 'reveal' && lastKick ? (
            <View
              style={[
                styles.result,
                lastKick.scored ? styles.resultGoal : styles.resultSaved,
              ]}
            >
              <Text style={styles.resultTitle}>
                {lastKick.role === 'shooter'
                  ? lastKick.scored
                    ? text.goal
                    : text.saved
                  : lastKick.scored
                  ? text.keeperLost
                  : text.keeperWon}
              </Text>
              <Text style={styles.resultBody}>{describe(lastKick)}</Text>
            </View>
          ) : phase === 'choose' ? (
            <Text style={styles.prompt}>
              {displayedRole === 'shooter'
                ? text.shooterPrompt
                : text.keeperPrompt}
            </Text>
          ) : null}

          {phase === 'over' && match ? (
            <View style={styles.summary}>
              <Text style={styles.summaryTitle}>
                {match.winner === 'user' ? text.youWon : text.cpuWon}
              </Text>
              <Text style={styles.summaryScore}>
                {text.finalScore(goals.user, goals.cpu)}
              </Text>
              <Text style={styles.noStakes}>
                {game.ratingActive
                  ? copy.games.pointsEarned(goals.user)
                  : copy.games.pointsOff}
              </Text>
              <ErrorBanner message={game.error} />
              {game.plays ? (
                <PlaysMeter plays={game.plays} remaining={remaining} />
              ) : null}
              <Button
                label={text.playAgain}
                loading={game.busy}
                disabled={!game.canStart}
                onPress={game.start}
              />
              <Button label={copy.games.back} secondary onPress={onBack} />
            </View>
          ) : (
            <>
              <ErrorBanner message={game.error} />
              <View style={styles.choices}>
                {sides.map(side => {
                  const chosen = phase !== 'choose' && userChoice === side;
                  const locked = phase !== 'choose' || game.busy;
                  return (
                    <Pressable
                      key={side}
                      accessibilityRole="button"
                      accessibilityLabel={text.sides[side]}
                      accessibilityState={{
                        selected: chosen,
                        disabled: locked,
                      }}
                      disabled={locked}
                      onPress={() => game.kick(side)}
                      style={[styles.choice, chosen && styles.chosen]}
                    >
                      <Text
                        style={[styles.choiceText, chosen && styles.chosenText]}
                      >
                        {text.sides[side]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {phase === 'reveal' ? (
                <Button
                  label={match?.winner ? text.showResult : text.next}
                  onPress={game.next}
                />
              ) : null}
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

function describe(kick: PenaltyKick) {
  const cpu = text.sideName[kick.cpuSide];
  if (kick.role === 'shooter')
    return kick.scored ? text.shooterScored(cpu) : text.shooterSaved(cpu);
  return kick.scored ? text.keeperConceded(cpu) : text.keeperSaved(cpu);
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    paddingVertical: space.xxl,
  },
  intro: { gap: space.md },
  introTitle: {
    color: colors.text,
    fontSize: 31,
    lineHeight: 37,
    fontWeight: '800',
    letterSpacing: -0.9,
  },
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
  score: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    backgroundColor: colors.surface,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
  },
  scoreText: { color: colors.text, fontSize: 11, fontWeight: '800' },
  meta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kickLabel: {
    color: colors.brand,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
  },
  role: { color: colors.secondary, fontSize: 12, fontWeight: '700' },
  progress: { flexDirection: 'row', gap: space.xs },
  step: {
    flex: 1,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
  },
  completed: { backgroundColor: colors.brand },
  current: { backgroundColor: colors.accent },
  scene: {
    alignSelf: 'center',
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.pitchLine,
  },
  goal: { position: 'absolute', top: 0, left: 0 },
  ground: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.pitchLine,
  },
  keeper: { position: 'absolute' },
  ball: {
    position: 'absolute',
    backgroundColor: colors.text,
    borderWidth: 2,
    borderColor: colors.bg,
  },
  prompt: {
    color: colors.secondary,
    fontSize: 13,
    textAlign: 'center',
  },
  result: {
    padding: space.lg,
    gap: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  resultGoal: { borderColor: colors.brand, backgroundColor: colors.brandWash },
  resultSaved: { borderColor: colors.warning },
  resultTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  resultBody: { color: colors.secondary, fontSize: 12, lineHeight: 20 },
  choices: { flexDirection: 'row', gap: space.sm },
  choice: {
    flex: 1,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.raised,
  },
  chosen: { borderColor: colors.brand, backgroundColor: colors.brandWash },
  choiceText: { color: colors.text, fontSize: 14, fontWeight: '800' },
  chosenText: { color: colors.brand },
  summary: { gap: space.md, alignItems: 'stretch' },
  summaryTitle: {
    color: colors.text,
    fontSize: 27,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.6,
  },
  summaryScore: {
    color: colors.secondary,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  noStakes: { color: colors.muted, fontSize: 11, textAlign: 'center' },
  rules: { gap: space.lg },
  rulesTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  rule: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  ruleIndex: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    backgroundColor: colors.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ruleNumber: { color: colors.muted, fontSize: 11, fontWeight: '800' },
  ruleBody: { color: colors.secondary, fontSize: 12, lineHeight: 20, flex: 1 },
});
