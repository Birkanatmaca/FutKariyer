import React, { type PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Info } from 'lucide-react-native';
import {
  KeyboardAwareScrollView,
  keyboardOffset,
} from '../../../shared/ui/keyboard';
import { Floodlight } from '../../../shared/ui/Floodlight';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space, type } from '../../../styles/tokens';
import { StadiumHero } from './StadiumHero';

const STEPS = 2;

type Props = PropsWithChildren<{
  title: string;
  description: string;
  onBack?: () => void;
  // Reopens the product intro (sign-up steps).
  onInfo?: () => void;
  // Sign-up step (1 or 2); shown as a slim progress bar instead of the hero.
  step?: number;
}>;

// Auth layout (19 Oct 2026): the entry screen opens on a floodlit stadium with
// the FUTCAREER wordmark; sign-up steps show a slim progress bar and the title
// on the night background. Either way the form sits on one raised panel that
// runs to the bottom of the screen.
export function AuthFrame({
  children,
  title,
  description,
  onBack,
  onInfo,
  step,
}: Props) {
  const top =
    onBack || onInfo || step ? (
      <View style={[styles.top, step ? null : styles.topOverHero]}>
        <View style={styles.slot}>
          {onBack ? (
            <Pressable
              onPress={onBack}
              accessibilityLabel={copy.form.back}
              accessibilityRole="button"
              hitSlop={8}
              style={styles.iconButton}
            >
              <ArrowLeft size={20} color={colors.text} />
            </Pressable>
          ) : null}
        </View>
        {step ? (
          <View
            style={styles.progress}
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={copy.authStep(step, STEPS)}
          >
            {Array.from({ length: STEPS }, (_, index) => (
              <View
                key={index}
                style={[styles.segment, index < step && styles.segmentOn]}
              />
            ))}
          </View>
        ) : null}
        <View style={[styles.slot, styles.slotEnd]}>
          {onInfo ? (
            <Pressable
              onPress={onInfo}
              accessibilityLabel={copy.onboarding.open}
              accessibilityRole="button"
              hitSlop={8}
              style={styles.iconButton}
            >
              <Info size={20} color={colors.secondary} />
            </Pressable>
          ) : null}
        </View>
      </View>
    ) : null;
  const heading = (
    <View style={styles.heading}>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
  return (
    // The panel runs to the screen's bottom edge; its padding clears the home
    // indicator, so the bottom safe-area inset is not reserved.
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {step ? <Floodlight height={300} /> : null}
      <KeyboardAwareScrollView
        bottomOffset={keyboardOffset}
        style={styles.flex}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {step ? (
          <View style={styles.stepHead}>
            {top}
            {heading}
          </View>
        ) : (
          <View>
            <StadiumHero />
            {top}
          </View>
        )}
        <View style={styles.panel}>
          <View style={styles.inner}>
            {step ? null : heading}
            {children}
          </View>
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1 },
  stepHead: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    paddingBottom: space.xl,
    gap: space.xl,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  topOverHero: {
    position: 'absolute',
    top: space.md,
    left: space.xl,
    right: space.xl,
  },
  slot: { width: 44 },
  slotEnd: { alignItems: 'flex-end' },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  progress: { flexDirection: 'row', gap: space.xs },
  segment: {
    width: 28,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
  },
  segmentOn: { backgroundColor: colors.brand },
  // The form panel: one raised layer with rounded top corners that fills the
  // rest of the screen, like a sheet resting on the pitch.
  panel: {
    flexGrow: 1,
    marginTop: -space.xl,
    paddingTop: space.xl,
    paddingBottom: space.xxxl + space.lg,
    paddingHorizontal: space.xl,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  inner: {
    width: '100%',
    maxWidth: 432,
    alignSelf: 'center',
    gap: space.xl,
  },
  heading: { gap: space.sm },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.8,
    color: colors.text,
  },
  description: { ...type.body, fontSize: 15, color: colors.secondary },
});
