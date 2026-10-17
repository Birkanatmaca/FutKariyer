import React, { type PropsWithChildren } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Info } from 'lucide-react-native';
import { Floodlight } from '../../../shared/ui/Floodlight';
import { Brand } from '../../../shared/ui/Brand';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space, type } from '../../../styles/tokens';

const STEPS = 2;

type Props = PropsWithChildren<{
  title: string;
  description: string;
  onBack?: () => void;
  // Reopens the product intro (sign-up steps).
  onInfo?: () => void;
  // Sign-up step (1 or 2); shown as a slim progress bar instead of text.
  step?: number;
}>;

// Minimal auth layout: centered logo on the entry screen, a short plain
// heading, and the form straight on the night background (no card, no
// marketing copy). Sign-up steps swap the logo for a two-segment progress bar.
export function AuthFrame({
  children,
  title,
  description,
  onBack,
  onInfo,
  step,
}: Props) {
  return (
    <SafeAreaView style={styles.safe}>
      <Floodlight height={step ? 300 : 420} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          <View style={styles.top}>
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
          {step ? null : (
            <View style={styles.brand}>
              <Brand size={48} />
            </View>
          )}
          <View style={[styles.hero, step ? styles.heroStep : null]}>
            <Text accessibilityRole="header" style={styles.title}>
              {title}
            </Text>
            <Text style={styles.description}>{description}</Text>
          </View>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: colors.bg },
  content: {
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    paddingBottom: space.xxl,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    flexGrow: 1,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
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
  brand: {
    alignItems: 'center',
    paddingTop: space.xxxl,
    paddingBottom: space.xxxl,
  },
  hero: { gap: space.sm, marginBottom: space.xl },
  heroStep: { marginTop: space.xl },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
    letterSpacing: -0.8,
    color: colors.text,
  },
  description: { ...type.body, fontSize: 15, color: colors.secondary },
});
