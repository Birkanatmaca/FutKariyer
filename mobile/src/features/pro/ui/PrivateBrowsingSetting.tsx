import React, { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { VenetianMask } from 'lucide-react-native';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space } from '../../../styles/tokens';
import type { ProService } from '../application/pro-service';
import { useProStatus } from '../application/useProStatus';

// Settings row for the Pro-only private browsing preference (default off).
// Non-Pro accounts see the row disabled with a link to the Pro screen.
export function PrivateBrowsingSetting({
  token,
  service,
  onUpgrade,
}: {
  token: string;
  service: ProService;
  onUpgrade(): void;
}) {
  const pro = useProStatus(service, token);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  if (!pro.status || !pro.eligible) return null;
  const enabled = pro.isPro;
  async function toggle(on: boolean) {
    if (busy || !enabled) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      pro.replace(await service.setPrivateBrowsing(token, on));
      setNotice(copy.pro.privateSaved(on));
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : copy.form.unexpected,
      );
      pro.refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <VenetianMask size={20} color={colors.brand} />
        <View style={styles.copy}>
          <Text style={styles.title}>{copy.pro.privateTitle}</Text>
          <Text style={styles.body}>
            {enabled ? copy.pro.privateBody : copy.pro.privateProOnly}
          </Text>
        </View>
        <Switch
          accessibilityLabel={copy.pro.privateTitle}
          accessibilityHint={
            enabled ? copy.pro.privateBody : copy.pro.privateProOnly
          }
          value={enabled && pro.status.privateBrowsing}
          disabled={!enabled || busy}
          onValueChange={toggle}
          trackColor={{ false: colors.overlay, true: colors.brand }}
          thumbColor={colors.text}
        />
      </View>
      {!enabled ? (
        <Pressable
          accessibilityRole="button"
          onPress={onUpgrade}
          style={styles.upgrade}
        >
          <Text style={styles.upgradeText}>{copy.pro.upgrade}</Text>
        </Pressable>
      ) : null}
      {notice ? (
        <Text accessibilityRole="alert" style={styles.notice}>
          {notice}
        </Text>
      ) : null}
      {error ? <ErrorBanner message={error} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  copy: { flex: 1, gap: space.xs },
  title: { color: colors.text, fontSize: 14, fontWeight: '700' },
  body: { color: colors.secondary, fontSize: 12, lineHeight: 18 },
  upgrade: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  upgradeText: { color: colors.brand, fontSize: 13, fontWeight: '800' },
  notice: { color: colors.success, fontSize: 12 },
});
