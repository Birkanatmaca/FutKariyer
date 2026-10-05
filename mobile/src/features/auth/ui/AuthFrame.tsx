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
import { ArrowLeft, MoveUpRight } from 'lucide-react-native';
import { Brand } from '../../../shared/ui/Brand';
import { PitchArt } from '../../../shared/ui/PitchArt';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space } from '../../../styles/tokens';

type Props = PropsWithChildren<{
  title: string;
  description: string;
  onBack?: () => void;
  compact?: boolean;
}>;
export function AuthFrame({
  children,
  title,
  description,
  onBack,
  compact,
}: Props) {
  return (
    <SafeAreaView style={styles.safe}>
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
            <Brand />
            {onBack ? (
              <Pressable
                onPress={onBack}
                accessibilityLabel={copy.form.back}
                accessibilityRole="button"
                style={styles.back}
              >
                <ArrowLeft size={21} color={colors.text} />
              </Pressable>
            ) : (
              <View style={styles.pilot}>
                <Text style={styles.pilotText}>18+</Text>
              </View>
            )}
          </View>
          <View style={[styles.hero, compact && styles.compact]}>
            <View style={styles.pitch}>
              <PitchArt />
            </View>
            <View style={styles.eyebrow}>
              <View style={styles.dot} />
              <Text style={styles.eyebrowText}>{copy.pilot}</Text>
              <MoveUpRight size={13} color={colors.brand} />
            </View>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.description}>{description}</Text>
          </View>
          {children}
          <View style={styles.footerLine}>
            <View style={styles.line} />
            <Text style={styles.footer}>{copy.location}</Text>
            <View style={styles.line} />
          </View>
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
    paddingTop: space.xl,
    paddingBottom: space.xl,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    flexGrow: 1,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pilot: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
  },
  pilotText: { color: colors.secondary, fontWeight: '600', fontSize: 11 },
  back: {
    padding: space.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  hero: { paddingVertical: space.xxxl, minHeight: 260 },
  compact: { paddingVertical: space.xxl, minHeight: 220 },
  pitch: {
    position: 'absolute',
    right: -38,
    top: 16,
    opacity: 0.72,
    transform: [{ rotate: '-14deg' }],
  },
  eyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginBottom: space.lg,
  },
  dot: {
    width: 5,
    height: 5,
    backgroundColor: colors.brand,
    borderRadius: radius.pill,
  },
  eyebrowText: {
    fontSize: 10,
    letterSpacing: 2,
    color: colors.brand,
    fontWeight: '700',
  },
  title: {
    fontSize: 43,
    lineHeight: 47,
    fontWeight: '800',
    letterSpacing: -1.8,
    color: colors.text,
    maxWidth: '95%',
  },
  description: {
    fontSize: 13,
    lineHeight: 21,
    color: colors.secondary,
    marginTop: space.lg,
    maxWidth: 280,
  },
  footerLine: {
    flexDirection: 'row',
    gap: space.lg,
    alignItems: 'center',
    marginTop: space.xxl,
  },
  line: { height: 1, backgroundColor: colors.border, flex: 1 },
  footer: {
    color: colors.muted,
    fontSize: 9,
    letterSpacing: 2,
    fontWeight: '600',
  },
});
