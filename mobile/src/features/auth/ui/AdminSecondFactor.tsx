import React, { useState } from 'react';
import {
  Keyboard,
  Linking,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Hash } from 'lucide-react-native';
import { Field } from '../../../shared/ui/Field';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space, type } from '../../../styles/tokens';
import { useAuth } from '../application/AuthProvider';

const text = copy.security;

// The admin's second sign-in step on the phone (20 Oct 2026): set up the
// authenticator on first sign-in, then a 6-digit or recovery code; right
// after setup the recovery codes are shown once.
export function AdminSecondFactor() {
  const {
    adminChallenge,
    adminRecoveryCodes,
    verifyAdmin,
    cancelAdminChallenge,
    acceptAdmin,
  } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<void>) {
    if (busy) return;
    Keyboard.dismiss();
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : copy.form.unexpected,
      );
    } finally {
      setBusy(false);
    }
  }

  if (adminRecoveryCodes.length) {
    return (
      <View style={styles.form}>
        <Text accessibilityRole="header" style={styles.title}>
          {text.adminRecoveryTitle}
        </Text>
        <Text style={styles.hint}>{text.adminRecoveryHint}</Text>
        <View style={styles.codes}>
          {adminRecoveryCodes.map(item => (
            <Text key={item} selectable style={styles.code}>
              {item}
            </Text>
          ))}
        </View>
        <Button
          label={text.adminRecoveryShare}
          secondary
          onPress={() =>
            Share.share({
              title: text.adminRecoveryShareTitle,
              message:
                text.adminRecoveryShareTitle +
                '\n' +
                adminRecoveryCodes.join('\n'),
            }).catch(() => {})
          }
        />
        <ErrorBanner message={error} />
        <Button
          label={text.adminRecoveryDone}
          loading={busy}
          compact
          onPress={() => run(acceptAdmin)}
        />
      </View>
    );
  }
  if (!adminChallenge) return null;
  const setup = adminChallenge.setup;
  const grouped = (adminChallenge.secret ?? '')
    .replace(/(.{4})/g, '$1 ')
    .trim();
  return (
    <View style={styles.form}>
      <Text accessibilityRole="header" style={styles.title}>
        {setup ? text.adminSetupTitle : text.adminTitle}
      </Text>
      <Text style={styles.hint}>
        {setup ? text.adminSetupHint : text.adminHint}
      </Text>
      {setup && adminChallenge.secret ? (
        <View style={styles.key}>
          <Text style={styles.keyLabel}>{text.adminKey}</Text>
          <Text selectable style={styles.keyValue}>
            {grouped}
          </Text>
          {adminChallenge.otpauthUri ? (
            <Pressable
              accessibilityRole="link"
              onPress={() =>
                Linking.openURL(adminChallenge.otpauthUri ?? '').catch(() => {})
              }
              hitSlop={8}
            >
              <Text style={styles.link}>{text.adminOpenApp}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <Field
        label={setup ? text.adminCode : text.adminCodeOrRecovery}
        icon={Hash}
        value={code}
        onChangeText={setCode}
        keyboardType={setup ? 'number-pad' : 'default'}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={setup ? 6 : 12}
        editable={!busy}
        returnKeyType="go"
        onSubmitEditing={() => run(() => verifyAdmin(code))}
      />
      <ErrorBanner message={error} />
      <Button
        label={text.adminVerify}
        loading={busy}
        compact
        onPress={() => run(() => verifyAdmin(code))}
      />
      <Pressable
        accessibilityRole="button"
        onPress={cancelAdminChallenge}
        disabled={busy}
        hitSlop={10}
        style={styles.back}
      >
        <Text style={styles.link}>{text.adminBack}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.lg },
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  hint: { ...type.caption, color: colors.secondary, lineHeight: 19 },
  key: {
    gap: space.sm,
    padding: space.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  keyLabel: { ...type.caption, color: colors.muted, fontWeight: '700' },
  keyValue: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
  codes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  code: {
    width: '45%',
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
  link: { color: colors.brand, fontSize: 14, fontWeight: '700' },
  back: { alignSelf: 'center', paddingVertical: space.xs },
});
