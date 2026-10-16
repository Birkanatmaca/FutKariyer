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
import { LogoMark } from '../../../shared/ui/LogoMark';
import { PitchArt } from '../../../shared/ui/PitchArt';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, shadow, space, type } from '../../../styles/tokens';

type Props = PropsWithChildren<{
  title: string;
  description: string;
  onBack?: () => void;
  // Reopens the product intro (sign-up steps).
  onInfo?: () => void;
  // Small label above the title, e.g. the sign-up step.
  eyebrow?: string;
  compact?: boolean;
}>;
export function AuthFrame({
  children,
  title,
  description,
  onBack,
  onInfo,
  eyebrow = copy.authEyebrow,
  compact,
}: Props) {
  return (
    <SafeAreaView style={styles.safe}>
      <Floodlight height={compact ? 420 : 560} />
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
            {onBack ? (
              <Pressable
                onPress={onBack}
                accessibilityLabel={copy.form.back}
                accessibilityRole="button"
                style={styles.iconButton}
              >
                <ArrowLeft size={20} color={colors.text} />
              </Pressable>
            ) : null}
            <View style={styles.brand}>
              <Brand />
            </View>
            {onInfo ? (
              <Pressable
                onPress={onInfo}
                accessibilityLabel={copy.onboarding.open}
                accessibilityRole="button"
                style={styles.iconButton}
              >
                <Info size={20} color={colors.text} />
              </Pressable>
            ) : null}
          </View>
          <View style={[styles.hero, compact && styles.compact]}>
            {!compact && (
              <View
                style={styles.art}
                pointerEvents="none"
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                <View style={styles.pitch}>
                  <PitchArt width={190} height={218} />
                </View>
                <View style={styles.halo}>
                  <View style={styles.haloInner}>
                    <LogoMark size={84} />
                  </View>
                </View>
              </View>
            )}
            <View style={styles.eyebrow}>
              <View style={styles.marker} />
              <Text style={styles.eyebrowText}>{eyebrow}</Text>
            </View>
            <Text
              accessibilityRole="header"
              accessibilityHint={description}
              style={[styles.title, compact && styles.compactTitle]}
            >
              {title}
            </Text>
          </View>
          <View style={styles.card}>{children}</View>
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
    paddingTop: space.lg,
    paddingBottom: space.xxl,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    flexGrow: 1,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 44,
  },
  brand: { flex: 1 },
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
  hero: { paddingTop: space.lg, paddingBottom: space.xl },
  compact: { paddingTop: space.xxl, paddingBottom: space.lg },
  // Floodlit ball over faint pitch lines, sitting above the headline.
  art: {
    height: 150,
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginBottom: space.md,
  },
  pitch: {
    position: 'absolute',
    right: -space.xxl,
    top: -space.xxl,
    opacity: 0.7,
    transform: [{ rotate: '12deg' }],
  },
  halo: {
    width: 132,
    height: 132,
    marginRight: space.sm,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandWash,
    borderWidth: 1,
    borderColor: colors.brandSoft,
  },
  haloInner: {
    borderRadius: radius.md + 4,
    ...shadow.glow,
  },
  eyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginBottom: space.md,
  },
  marker: {
    width: 20,
    height: 2,
    backgroundColor: colors.brand,
    borderRadius: radius.pill,
  },
  eyebrowText: { ...type.eyebrow, ...type.number, color: colors.brand },
  title: {
    fontSize: 44,
    lineHeight: 48,
    fontWeight: '800',
    letterSpacing: -1.5,
    color: colors.text,
  },
  compactTitle: { fontSize: 32, lineHeight: 38, letterSpacing: -0.9 },
  card: {
    padding: space.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    ...shadow.layer,
  },
});
