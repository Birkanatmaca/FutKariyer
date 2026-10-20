import React, { useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { Hash, MailCheck } from 'lucide-react-native';
import { Field } from '../../../shared/ui/Field';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space, type } from '../../../styles/tokens';
import { useAuth } from '../application/AuthProvider';

const text = copy.security;

// E-postanı doğrula (20 Oct 2026): shown on Home while a new player or coach
// has not entered the code sent at sign-up. Until then posting, applying and
// introductions are refused by the server.
export function VerifyEmailCard() {
  const { user, delegate, verifyEmail, resendVerification } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!user || delegate || user.emailVerified !== false) return null;

  async function run(action: () => Promise<void>) {
    if (busy) return;
    Keyboard.dismiss();
    setBusy(true);
    setError(null);
    setNotice(null);
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
  function verify() {
    if (!/^\d{6}$/.test(code)) {
      setError(text.codeError);
      return;
    }
    run(() => verifyEmail(code));
  }

  return (
    <View style={styles.card} accessibilityRole="summary">
      <View style={styles.head}>
        <View style={styles.icon}>
          <MailCheck size={18} color={colors.brandInk} />
        </View>
        <Text accessibilityRole="header" style={styles.title}>
          {text.verifyTitle}
        </Text>
      </View>
      <Text style={styles.body}>{text.verifyBody(user.email)}</Text>
      <Field
        label={text.code}
        icon={Hash}
        value={code}
        onChangeText={value => setCode(value.replace(/\D/g, ''))}
        placeholder={text.codePlaceholder}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={6}
        editable={!busy}
        returnKeyType="done"
        onSubmitEditing={verify}
      />
      <ErrorBanner message={error} />
      {notice ? (
        <Text accessibilityRole="alert" style={styles.notice}>
          {notice}
        </Text>
      ) : null}
      <Button
        label={text.verifyButton}
        onPress={verify}
        loading={busy}
        compact
      />
      <Pressable
        accessibilityRole="button"
        onPress={() =>
          run(async () => {
            await resendVerification();
            setNotice(text.resent);
          })
        }
        disabled={busy}
        hitSlop={10}
        style={styles.resend}
      >
        <Text style={styles.resendText}>{text.resend}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.brandSoft,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
  },
  title: { color: colors.text, fontSize: 17, fontWeight: '800' },
  body: { ...type.caption, color: colors.secondary, lineHeight: 19 },
  notice: { color: colors.success, fontSize: 13 },
  resend: { alignSelf: 'center', paddingVertical: space.xs },
  resendText: { color: colors.brand, fontSize: 14, fontWeight: '700' },
});
