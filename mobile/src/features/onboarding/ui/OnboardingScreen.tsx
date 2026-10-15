import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  Handshake,
  Search,
  Trophy,
  UserRound,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { Brand } from '../../../shared/ui/Brand';
import { Button } from '../../../shared/ui/Button';
import { Floodlight } from '../../../shared/ui/Floodlight';
import { PitchArt } from '../../../shared/ui/PitchArt';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, shadow, space, type } from '../../../styles/tokens';
import { onboardingSlides, type OnboardingSlide } from '../domain/models';

const text = copy.onboarding;
const icons: Record<OnboardingSlide, LucideIcon> = {
  profile: UserRound,
  discover: Search,
  connect: Handshake,
  play: Trophy,
};

type Props =
  // First launch: ends on sign-up, can be skipped to sign-in.
  | { mode: 'intro'; onSignUp(): void; onSignIn(): void }
  // Reopened from the sign-up info button: closing returns to the form.
  | { mode: 'info'; onClose(): void };

export function OnboardingScreen(props: Props) {
  const [index, setIndex] = useState(0);
  const slide = onboardingSlides[index],
    last = index === onboardingSlides.length - 1,
    Icon = icons[slide];
  return (
    <SafeAreaView style={styles.safe}>
      <Floodlight height={560} />
      <View style={styles.content}>
        <View style={styles.top}>
          <Brand />
          {props.mode === 'intro' ? (
            last ? null : (
              <Pressable
                accessibilityRole="button"
                onPress={props.onSignIn}
                hitSlop={10}
                style={styles.skip}
              >
                <Text style={styles.skipText}>{text.skip}</Text>
              </Pressable>
            )
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={text.close}
              onPress={props.onClose}
              style={styles.iconButton}
            >
              <X size={20} color={colors.text} />
            </Pressable>
          )}
        </View>

        <View style={styles.art} pointerEvents="none">
          <View style={styles.pitch}>
            <PitchArt width={250} height={288} />
          </View>
          <View style={styles.ringOuter}>
            <View style={styles.ringInner}>
              <View style={styles.emblem}>
                <Icon size={40} color={colors.brandInk} strokeWidth={2} />
              </View>
            </View>
          </View>
        </View>

        <View style={styles.copy}>
          <Text style={styles.step}>
            {text.step(index + 1, onboardingSlides.length)}
          </Text>
          <Text accessibilityRole="header" style={styles.title}>
            {text.slides[slide].title}
          </Text>
          <Text style={styles.body}>{text.slides[slide].body}</Text>
        </View>

        <View style={styles.footer}>
          <View style={styles.dots} accessibilityElementsHidden>
            {onboardingSlides.map((item, i) => (
              <View
                key={item}
                style={[styles.dot, i === index && styles.dotActive]}
              />
            ))}
          </View>
          <View style={styles.actions}>
            {index > 0 && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={text.previous}
                onPress={() => setIndex(index - 1)}
                style={styles.previous}
              >
                <ChevronLeft size={22} color={colors.text} />
              </Pressable>
            )}
            <View style={styles.primary}>
              {!last ? (
                <Button label={text.next} onPress={() => setIndex(index + 1)} />
              ) : props.mode === 'intro' ? (
                <Button label={text.signUp} onPress={props.onSignUp} />
              ) : (
                <Button label={text.backToSignUp} onPress={props.onClose} />
              )}
            </View>
          </View>
          {props.mode === 'intro' && last ? (
            <View style={styles.switch}>
              <Text style={styles.question}>{text.question}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={props.onSignIn}
                hitSlop={10}
              >
                <Text style={styles.link}>{text.signIn}</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    paddingHorizontal: space.xl,
    paddingTop: space.xl,
    paddingBottom: space.xl,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  skip: {
    minHeight: 44,
    paddingHorizontal: space.lg,
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  skipText: { color: colors.secondary, fontSize: 13, fontWeight: '700' },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  art: {
    flex: 1,
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pitch: { position: 'absolute', opacity: 0.55 },
  ringOuter: {
    width: 188,
    height: 188,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.brandSoft,
    backgroundColor: colors.brandWash,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringInner: {
    width: 132,
    height: 132,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.brandSoft,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emblem: {
    width: 84,
    height: 84,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.glow,
  },
  copy: { gap: space.md, paddingBottom: space.xl },
  step: { ...type.eyebrow, ...type.number, color: colors.brand },
  title: { ...type.display, color: colors.text },
  body: { ...type.body, fontSize: 15, lineHeight: 23, color: colors.secondary },
  footer: { gap: space.lg },
  dots: { flexDirection: 'row', gap: space.xs },
  dot: {
    width: 8,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
  },
  dotActive: { width: 28, backgroundColor: colors.brand },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  previous: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  primary: { flex: 1 },
  switch: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: space.sm,
  },
  question: { color: colors.secondary, fontSize: 13 },
  link: { color: colors.brand, fontSize: 13, fontWeight: '700' },
});
