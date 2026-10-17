import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../../shared/ui/Button';
import { Floodlight } from '../../../shared/ui/Floodlight';
import { useReducedMotion } from '../../../shared/lib/useReducedMotion';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space } from '../../../styles/tokens';
import type { RatingSeason } from '../domain/models';
import { Countdown } from './Countdown';
import { RatingTrophy } from './RatingTrophy';

const medals = ['🥇', '🥈', '🥉'];

// Shown once per season the first time the games open: the trophy rises under
// the floodlight, then the countdown, prizes and the rules slide in.
export function RatingIntro({
  season,
  remaining,
  onJoin,
  onLeaderboard,
}: {
  season: RatingSeason | null;
  remaining: number;
  onJoin(): void;
  onLeaderboard(): void;
}) {
  const text = copy.rating.intro;
  const reduced = useReducedMotion();
  const rise = useRef(new Animated.Value(0)).current;
  const reveal = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!season) return;
    if (reduced) {
      rise.setValue(1);
      reveal.setValue(1);
      return;
    }
    rise.setValue(0);
    reveal.setValue(0);
    Animated.sequence([
      Animated.spring(rise, {
        toValue: 1,
        friction: 5,
        tension: 60,
        useNativeDriver: true,
      }),
      Animated.timing(reveal, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [season, reduced, rise, reveal]);
  const slide = {
    opacity: reveal,
    transform: [
      {
        translateY: reveal.interpolate({
          inputRange: [0, 1],
          outputRange: [24, 0],
        }),
      },
    ],
  };
  return (
    <Modal
      visible={!!season}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={onJoin}
    >
      <SafeAreaView style={styles.safe}>
        <Floodlight height={520} />
        {season ? (
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <Animated.View
              style={[
                styles.hero,
                {
                  opacity: rise,
                  transform: [
                    {
                      scale: rise.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.6, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              <RatingTrophy size={220} />
              <Text style={styles.eyebrow}>{copy.rating.eyebrow}</Text>
              <Text accessibilityRole="header" style={styles.title}>
                {season.status === 'upcoming' ? text.upcoming : text.active}
              </Text>
              <Text style={styles.season}>{season.title}</Text>
            </Animated.View>
            <Animated.View style={[styles.stack, slide]}>
              <Text style={styles.body}>{season.description || text.body}</Text>
              <View style={styles.timer}>
                <Text style={styles.timerLabel}>
                  {season.status === 'upcoming'
                    ? copy.rating.startsIn
                    : copy.rating.endsIn}
                </Text>
                <Countdown seconds={remaining} large />
              </View>
              {season.prizes.length ? (
                <View style={styles.prizes}>
                  {[...season.prizes]
                    .sort((a, b) => a.place - b.place)
                    .map(prize => (
                      <View key={prize.place} style={styles.prize}>
                        <Text style={styles.medal}>
                          {medals[prize.place - 1]}
                        </Text>
                        <Text style={styles.prizeTitle} numberOfLines={2}>
                          {prize.title}
                        </Text>
                      </View>
                    ))}
                </View>
              ) : null}
              <View style={styles.rules}>
                {text.rules.map(rule => (
                  <View key={rule} style={styles.rule}>
                    <View style={styles.dot} />
                    <Text style={styles.ruleText}>{rule}</Text>
                  </View>
                ))}
              </View>
              <Button label={text.join} onPress={onJoin} />
              <Button label={text.see} secondary onPress={onLeaderboard} />
            </Animated.View>
          </ScrollView>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: {
    padding: space.xl,
    paddingBottom: space.xxxl,
    gap: space.xl,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  hero: { alignItems: 'center', gap: space.sm },
  eyebrow: {
    color: colors.brand,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 4,
  },
  title: {
    color: colors.text,
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '800',
    letterSpacing: -1,
    textAlign: 'center',
  },
  season: { color: colors.secondary, fontSize: 15, fontWeight: '700' },
  stack: { gap: space.lg },
  body: {
    color: colors.secondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  timer: { gap: space.sm },
  timerLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  prizes: { flexDirection: 'row', gap: space.sm },
  prize: {
    flex: 1,
    alignItems: 'center',
    gap: space.xs,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  medal: { fontSize: 28 },
  prizeTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  rules: { gap: space.sm },
  rule: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 7,
    backgroundColor: colors.brand,
  },
  ruleText: { flex: 1, color: colors.text, fontSize: 14, lineHeight: 20 },
});
