import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  ArrowLeft,
  ChevronRight,
  Flame,
  Heart,
  Sparkles,
  Trophy,
} from 'lucide-react-native';
import { colors, radius, space } from '../../../styles/tokens';
import { copy } from '../../../shared/lib/copy';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { createGamesService } from '../application/games-service';
import { createHeadToHeadService } from '../application/head-to-head-service';
import { useFootballGame } from '../application/useFootballGame';
import { gamesRepository } from '../data/http-games-repository';
import { headToHeadRepository } from '../data/http-head-to-head-repository';
import type { HeadToHeadRecord } from '../domain/head-to-head';
import { GameCard, type GameArt } from './GameCard';
import { GameRulesSheet } from './GameRulesSheet';
import { HeadToHead } from './HeadToHead';
import { HeartWallet } from './HeartWallet';
import { PenaltyShootout } from './PenaltyShootout';
import { QuizBoard } from './QuizBoard';
const service = createGamesService(gamesRepository);
const headToHeadService = createHeadToHeadService(headToHeadRepository);
export function GamesScreen({ token }: { token: string }) {
  const game = useFootballGame(service, token);
  const { data } = game;
  const scroll = useRef<ScrollView>(null);
  const [open, setOpen] = useState<'penalty' | 'headToHead' | null>(null);
  const [rules, setRules] = useState<GameArt | null>(null);
  const [record, setRecord] = useState<HeadToHeadRecord | null>(null);
  const loadRecord = useCallback(() => {
    // The lobby only shows the best streak; a failure just hides it.
    headToHeadService.record(token).then(setRecord, () => setRecord(null));
  }, [token]);
  useEffect(() => {
    if (!open) loadRecord();
  }, [loadRecord, open]);
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [game.mode, game.question?.id]);
  if (open === 'penalty')
    return (
      <PenaltyShootout
        service={service}
        token={token}
        onBack={() => {
          setOpen(null);
          game.refresh();
        }}
      />
    );
  if (open === 'headToHead')
    return (
      <HeadToHead
        service={headToHeadService}
        token={token}
        onBack={() => setOpen(null)}
      />
    );
  if (game.loading && !data)
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.brand} />
        <Text style={styles.secondary}>{copy.games.loading}</Text>
      </View>
    );
  if (!data)
    return (
      <View style={styles.content}>
        <ErrorBanner message={game.error} />
        <Button label={copy.form.retry} onPress={game.refresh} />
      </View>
    );
  const active = data.run?.status === 'active';
  const canPlay = active || data.hearts > 0;
  return (
    <ScrollView
      ref={scroll}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[
        styles.content,
        game.mode === 'result' && styles.resultContent,
      ]}
      keyboardShouldPersistTaps="handled"
    >
      {game.mode === 'play' && game.question ? (
        <>
          <View style={styles.top}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={copy.games.back}
              disabled={game.busy}
              onPress={game.lobby}
              style={styles.back}
            >
              <ArrowLeft size={19} color={colors.text} />
              <Text style={styles.backText}>{copy.games.back}</Text>
            </Pressable>
            <HeartWallet
              hearts={data.hearts}
              remaining={game.remaining}
              compact
            />
          </View>
          <QuizBoard
            key={game.question.id}
            question={game.question}
            number={game.questionNumber}
            score={data.run!.score}
            selected={game.selected}
            feedback={game.feedback}
            busy={game.busy}
            error={game.error}
            onAnswer={game.answer}
            onNext={game.next}
            onRecover={game.recover}
          />
        </>
      ) : game.mode === 'result' && data.run ? (
        <>
          <View style={styles.resultHero}>
            <View
              style={[styles.resultIcon, data.run.passed && styles.winIcon]}
            >
              <Trophy
                size={38}
                color={data.run.passed ? colors.brand : colors.secondary}
              />
            </View>
            <Text style={styles.eyebrow}>
              {data.run.passed ? copy.games.passed : copy.games.name}
            </Text>
            <Text accessibilityRole="header" style={styles.resultTitle}>
              {data.run.passed ? copy.games.success : copy.games.failure}
            </Text>
            <View style={styles.scoreLine}>
              <Text style={styles.bigScore}>{data.run.score}</Text>
              <Text style={styles.scoreOf}>/10</Text>
            </View>
            <Text style={styles.secondary}>
              {copy.games.score(data.run.score)} · {copy.games.target}
            </Text>
          </View>
          <View
            style={[styles.reward, data.run.rewardGranted && styles.rewardWon]}
          >
            {data.run.rewardGranted ? (
              <>
                <View style={styles.rewardHeading}>
                  <Sparkles size={22} color={colors.brand} />
                  <Text style={styles.rewardTitle}>
                    {copy.games.rewardGranted}
                  </Text>
                </View>
                <Text style={styles.rewardBody}>{copy.games.rewardDetail}</Text>
              </>
            ) : (
              <>
                <Text style={styles.rewardTitle}>
                  {data.run.passed
                    ? copy.games.practiceWin
                    : copy.games.missed(data.run.score)}
                </Text>
                <Text style={styles.rewardBody}>
                  {data.run.passed
                    ? copy.games.practiceHelp
                    : copy.games.noReward}
                </Text>
              </>
            )}
          </View>
          <HeartWallet hearts={data.hearts} remaining={game.remaining} />
          <ErrorBanner message={game.error} />
          <Button
            label={data.hearts ? copy.games.again : copy.games.wait}
            loading={game.busy}
            disabled={!data.hearts}
            onPress={game.start}
          />
          <Button
            label={copy.games.back}
            secondary
            disabled={game.busy}
            onPress={game.lobby}
          />
        </>
      ) : (
        <>
          <HeartWallet hearts={data.hearts} remaining={game.remaining} />
          <ErrorBanner message={game.error} />
          <GameCard
            art="crest"
            name={copy.games.name}
            tagline={copy.games.tagline}
            hint={copy.games.rules.join(' ')}
            meta={active ? undefined : copy.games.heartCost}
            metaIcon={Heart}
            badge={
              active
                ? copy.games.resume
                : !canPlay
                ? copy.games.wait
                : data.stats.played > 0
                ? copy.games.bestScore(data.stats.bestScore)
                : undefined
            }
            disabled={!canPlay || game.busy}
            onPress={game.start}
            onRules={() => setRules('crest')}
          />
          <GameCard
            art="spot"
            name={copy.games.penalty.name}
            tagline={copy.games.penalty.tagline}
            hint={copy.games.penalty.rules.join(' ')}
            meta={data.penalty ? undefined : copy.games.heartCost}
            metaIcon={Heart}
            badge={data.penalty ? copy.games.resume : undefined}
            onPress={() => setOpen('penalty')}
            onRules={() => setRules('spot')}
          />
          <GameCard
            art="faceoff"
            name={copy.games.headToHead.name}
            tagline={copy.games.headToHead.tagline}
            hint={copy.games.headToHead.rules.join(' ')}
            meta={
              record && record.plays > 0
                ? copy.games.headToHead.best(record.best)
                : copy.games.headToHead.free
            }
            metaIcon={record && record.plays > 0 ? Flame : undefined}
            onPress={() => setOpen('headToHead')}
            onRules={() => setRules('faceoff')}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              game.refresh();
              loadRecord();
            }}
            style={styles.refresh}
          >
            <Text style={styles.secondary}>{copy.discover.refresh}</Text>
            <ChevronRight size={16} color={colors.secondary} />
          </Pressable>
          <GameRulesSheet
            title={
              rules === 'crest'
                ? copy.games.name
                : rules === 'spot'
                ? copy.games.penalty.name
                : rules === 'faceoff'
                ? copy.games.headToHead.name
                : null
            }
            rules={
              rules === 'crest'
                ? copy.games.rules
                : rules === 'spot'
                ? copy.games.penalty.rules
                : copy.games.headToHead.rules
            }
            onClose={() => setRules(null)}
          />
        </>
      )}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
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
  resultContent: { gap: space.lg, paddingTop: space.lg },
  eyebrow: {
    color: colors.brand,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
  },
  secondary: { color: colors.secondary, fontSize: 12, lineHeight: 18 },
  refresh: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: space.sm,
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
  resultHero: { alignItems: 'center', gap: space.md, paddingTop: space.sm },
  resultIcon: {
    height: 86,
    width: 86,
    borderRadius: 43,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  winIcon: { borderColor: colors.brand, backgroundColor: colors.brandWash },
  resultTitle: {
    color: colors.text,
    fontSize: 27,
    lineHeight: 34,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.6,
  },
  scoreLine: { flexDirection: 'row', alignItems: 'baseline', gap: space.xs },
  bigScore: {
    color: colors.text,
    fontSize: 80,
    fontWeight: '800',
    letterSpacing: -4,
  },
  scoreOf: { color: colors.muted, fontSize: 26, fontWeight: '600' },
  reward: {
    padding: space.xl,
    gap: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rewardWon: { borderColor: colors.brand, backgroundColor: colors.brandWash },
  rewardHeading: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  rewardTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    flexShrink: 1,
  },
  rewardBody: { color: colors.secondary, fontSize: 12, lineHeight: 20 },
});
