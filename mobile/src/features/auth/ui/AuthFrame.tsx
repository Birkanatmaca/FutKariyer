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
import { Floodlight } from '../../../shared/ui/Floodlight';
import { ArrowLeft } from 'lucide-react-native';
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
      <Floodlight height={520} />
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
            ) : null}
          </View>
          <View style={[styles.hero, compact && styles.compact]}>
            {!compact && (
              <View style={styles.pitch} pointerEvents="none">
                <PitchArt width={155} height={180} />
              </View>
            )}
            <View style={styles.eyebrow}>
              <View style={styles.marker} />
              <Text style={styles.eyebrowText}>{copy.authEyebrow}</Text>
            </View>
            <Text
              accessibilityRole="header"
              accessibilityHint={description}
              style={[styles.title, compact && styles.compactTitle]}
            >
              {title}
            </Text>
          </View>
          <View style={styles.form}>{children}</View>
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
    maxWidth: 480,
    alignSelf: 'center',
    flexGrow: 1,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  back: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  hero: {
    paddingTop: space.xxxl,
    paddingBottom: space.xxl,
    overflow: 'hidden',
  },
  compact: { paddingTop: space.xxl, paddingBottom: space.xl },
  pitch: {
    position: 'absolute',
    right: -55,
    top: 40,
    opacity: 0.45,
    transform: [{ rotate: '10deg' }],
  },
  eyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginBottom: space.lg,
  },
  marker: {
    width: 20,
    height: 2,
    backgroundColor: colors.brand,
    borderRadius: radius.pill,
  },
  eyebrowText: {
    fontSize: 10,
    letterSpacing: 1.8,
    color: colors.secondary,
    fontWeight: '700',
  },
  title: {
    fontSize: 42,
    lineHeight: 46,
    fontWeight: '800',
    letterSpacing: -1.4,
    color: colors.text,
  },
  compactTitle: { fontSize: 32, lineHeight: 38, letterSpacing: -0.8 },
  form: {
    paddingTop: space.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
