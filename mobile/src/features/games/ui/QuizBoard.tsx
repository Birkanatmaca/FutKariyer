import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Check, X, Shield, Trophy } from 'lucide-react-native';
import { colors, radius, space } from '../../../styles/tokens';
import { copy } from '../../../shared/lib/copy';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { clubInitials } from '../domain/models';
import type { GameClub, GameFeedback, GameQuestion } from '../domain/models';

// Clubs without a bundled crest (or whose crest fails to load) get a night
// pitch shield with the club's initials; the name stays below as usual.
function ClubBadge({ club, narrow }: { club: GameClub; narrow: boolean }) {
  return (
    <View
      testID={'club-badge-' + club.id}
      accessible
      accessibilityLabel={club.name}
      style={styles.badgeInner}
    >
      <Shield
        size={narrow ? 46 : 56}
        color={colors.pitchLine}
        fill={colors.overlay}
        strokeWidth={1.5}
      />
      <Text
        style={[styles.initials, narrow && styles.narrowInitials]}
        numberOfLines={1}
      >
        {clubInitials(club.name)}
      </Text>
    </View>
  );
}

export function QuizBoard({
  question,
  number,
  score,
  selected,
  feedback,
  busy,
  error,
  onAnswer,
  onNext,
  onRecover,
}: {
  question: GameQuestion;
  number: number;
  score: number;
  selected: string;
  feedback: GameFeedback | null;
  busy: boolean;
  error: string;
  onAnswer(id: string): void;
  onNext(): void;
  onRecover(): void;
}) {
  const [failed, setFailed] = useState<string[]>([]);
  const { width } = useWindowDimensions();
  const count = question.clubs.length;
  const narrowClues =
    (count === 4 && width < 360) || (count === 5 && width < 440);
  return (
    <>
      <View style={styles.gameMeta}>
        <Text style={styles.questionNumber}>{copy.games.question(number)}</Text>
        <View style={styles.score}>
          <Trophy size={13} color={colors.brand} />
          <Text style={styles.scoreText}>{copy.games.score(score)}</Text>
        </View>
      </View>
      <View style={styles.progress}>
        {Array.from({ length: 10 }, (_, i) => (
          <View
            key={i}
            style={[
              styles.step,
              i < number - 1 && styles.completed,
              i === number - 1 && styles.current,
            ]}
          />
        ))}
      </View>
      <View style={styles.heading}>
        <Text style={styles.difficulty}>
          {copy.games.difficulty[question.difficulty]}
        </Text>
        <Text accessibilityRole="header" style={styles.title}>
          {copy.games.find}
        </Text>
        <Text style={styles.hint}>{copy.games.clue}</Text>
      </View>
      <View style={[styles.clues, count === 5 && styles.fiveClues]}>
        {question.clubs.map((club, i) => (
          <View
            key={i + '-' + club.id}
            style={[styles.club, narrowClues && styles.narrowClub]}
          >
            <Text style={styles.clubNumber}>
              {String(i + 1).padStart(2, '0')}
            </Text>
            <View
              style={[
                styles.crest,
                narrowClues && styles.narrowCrest,
                (!club.hasCrest || failed.includes(club.id)) && styles.badge,
              ]}
            >
              {!club.hasCrest || failed.includes(club.id) ? (
                <ClubBadge club={club} narrow={narrowClues} />
              ) : (
                <Image
                  accessibilityLabel={club.name}
                  source={{ uri: club.logoUrl }}
                  style={[styles.image, narrowClues && styles.narrowImage]}
                  resizeMode="contain"
                  onError={() => setFailed(v => [...v, club.id])}
                />
              )}
            </View>
            <Text numberOfLines={2} style={styles.clubName}>
              {club.name}
            </Text>
          </View>
        ))}
      </View>
      {failed.length > 0 ? (
        <Text style={styles.hint}>{copy.games.logoUnavailable}</Text>
      ) : null}
      <Text style={styles.choose}>{copy.games.choose}</Text>
      <View style={styles.options}>
        {question.options.map((option, i) => {
          const correct = feedback?.correctOptionId === option.id;
          const wrong = !!feedback && selected === option.id && !correct;
          const chosen = selected === option.id;
          return (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              accessibilityState={{
                selected: chosen,
                disabled: busy || !!selected,
              }}
              disabled={busy || !!selected}
              onPress={() => onAnswer(option.id)}
              style={[
                styles.option,
                chosen && styles.chosen,
                correct && styles.correct,
                wrong && styles.wrong,
              ]}
            >
              <View style={styles.optionTop}>
                <Text
                  style={[
                    styles.letter,
                    correct && styles.correctText,
                    wrong && styles.wrongText,
                  ]}
                >
                  {String.fromCharCode(65 + i)}
                </Text>
                {correct ? (
                  <Check size={19} color={colors.success} />
                ) : wrong ? (
                  <X size={19} color={colors.danger} />
                ) : busy && chosen ? (
                  <ActivityIndicator size="small" color={colors.brand} />
                ) : null}
              </View>
              <Text
                style={[
                  styles.optionName,
                  correct && styles.correctText,
                  wrong && styles.wrongText,
                ]}
              >
                {option.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {feedback ? (
        <View
          accessibilityLiveRegion="polite"
          style={[
            styles.feedback,
            feedback.correct ? styles.correct : styles.wrong,
          ]}
        >
          <Text
            style={[
              styles.feedbackTitle,
              feedback.correct ? styles.correctText : styles.wrongText,
            ]}
          >
            {feedback.correct ? copy.games.correct : copy.games.wrong}
          </Text>
          <Text style={styles.feedbackBody}>
            {copy.games.correctAnswer(feedback.correctName)}
          </Text>
        </View>
      ) : busy ? (
        <Text style={styles.hint}>{copy.games.selected}</Text>
      ) : null}
      {error ? (
        <>
          <ErrorBanner message={error} />
          {selected && !feedback ? (
            <Button
              label={copy.games.retryAnswer}
              loading={busy}
              onPress={() => onAnswer(selected)}
            />
          ) : null}
          <Button
            label={copy.games.recover}
            secondary
            disabled={busy}
            onPress={onRecover}
          />
        </>
      ) : null}
      {feedback ? (
        <Button
          label={number === 10 ? copy.games.showResult : copy.games.next}
          onPress={onNext}
        />
      ) : null}
    </>
  );
}
const styles = StyleSheet.create({
  gameMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  questionNumber: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.8,
  },
  score: { flexDirection: 'row', gap: space.xs, alignItems: 'center' },
  scoreText: { color: colors.brand, fontSize: 11, fontWeight: '700' },
  progress: { flexDirection: 'row', gap: space.xs },
  step: {
    height: 5,
    flex: 1,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
  },
  completed: { backgroundColor: colors.brandWash },
  current: { backgroundColor: colors.brand },
  heading: { gap: space.sm, alignItems: 'center', paddingTop: space.sm },
  difficulty: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
    backgroundColor: colors.raised,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  hint: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
  },
  clues: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: space.md,
    paddingVertical: space.sm,
  },
  club: { width: 76, alignItems: 'center', gap: space.sm },
  narrowClub: { width: 62 },
  clubNumber: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  crest: {
    width: 72,
    height: 78,
    borderRadius: radius.md,
    backgroundColor: colors.text,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: { width: 55, height: 59 },
  fiveClues: { gap: space.sm },
  badge: {
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  badgeInner: { justifyContent: 'center', alignItems: 'center' },
  initials: {
    position: 'absolute',
    color: colors.brand,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  narrowInitials: { fontSize: 14 },
  narrowCrest: { width: 60, height: 70 },
  narrowImage: { width: 46, height: 53 },
  clubName: {
    color: colors.secondary,
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'center',
    minHeight: 28,
  },
  choose: { color: colors.secondary, fontSize: 12, textAlign: 'center' },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: space.md,
  },
  option: {
    width: '47.5%',
    minHeight: 90,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: space.md,
    gap: space.sm,
  },
  optionTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  letter: { color: colors.muted, fontSize: 11, fontWeight: '800' },
  optionName: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
  },
  chosen: { borderColor: colors.brand, backgroundColor: colors.brandWash },
  correct: { borderColor: colors.success, backgroundColor: colors.surface },
  wrong: { borderColor: colors.danger, backgroundColor: colors.dangerWash },
  correctText: { color: colors.success },
  wrongText: { color: colors.danger },
  feedback: {
    padding: space.lg,
    gap: space.sm,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  feedbackTitle: { fontSize: 15, fontWeight: '800' },
  feedbackBody: { color: colors.secondary, fontSize: 12, lineHeight: 18 },
});
