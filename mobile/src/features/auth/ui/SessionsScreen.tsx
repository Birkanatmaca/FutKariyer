import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Building2, LogOut, Smartphone } from 'lucide-react-native';
import { Screen } from '../../../shared/ui/Screen';
import { TopBar } from '../../../shared/ui/TopBar';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space, type } from '../../../styles/tokens';
import { useAuth } from '../application/AuthProvider';
import { lastSeenLabel } from '../application/session-time';
import type { SessionInfo } from '../domain/models';

const text = copy.security;

// Aktif oturumlar (20 Oct 2026): every device the account is signed in on,
// with this one first; any other can be signed out, or all at once.
export function SessionsScreen({ onBack }: { onBack(): void }) {
  const { sessions, endSession, endOtherSessions } = useAuth();
  const [items, setItems] = useState<SessionInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    try {
      const list = await sessions();
      setItems([...list].sort((a, b) => Number(b.current) - Number(a.current)));
      setError(null);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : copy.form.unexpected,
      );
    }
    // sessions changes identity on every render of the provider.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function run(key: string, action: () => Promise<void>) {
    if (busy) return;
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      await action();
      await load();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : copy.form.unexpected,
      );
    } finally {
      setBusy('');
    }
  }

  const others = items?.filter(item => !item.current).length ?? 0;
  return (
    <Screen>
      <TopBar title={text.sessionsTitle} onBack={onBack} />
      <Text style={styles.hint}>{text.sessionsHint}</Text>
      <ErrorBanner message={error} />
      {notice ? (
        <Text accessibilityRole="alert" style={styles.notice}>
          {notice}
        </Text>
      ) : null}
      {items === null && !error ? (
        <ActivityIndicator
          color={colors.brand}
          accessibilityLabel={text.loadingSessions}
        />
      ) : null}
      {items?.map(item => {
        const device = item.device || text.unknownDevice;
        const Icon = item.club ? Building2 : Smartphone;
        return (
          <View key={item.id} style={styles.row}>
            <View style={[styles.icon, item.current && styles.iconCurrent]}>
              <Icon
                size={18}
                color={item.current ? colors.brandInk : colors.text}
              />
            </View>
            <View style={styles.body}>
              <Text style={styles.device} numberOfLines={1}>
                {device}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {item.current
                  ? text.thisDevice
                  : (item.club ? text.clubSession + ' · ' : '') +
                    text.lastSeen(lastSeenLabel(item.lastSeenAt))}
              </Text>
            </View>
            {item.current ? null : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={text.endSessionLabel(device)}
                onPress={() => run(item.id, () => endSession(item.id))}
                disabled={!!busy}
                hitSlop={8}
                style={styles.end}
              >
                {busy === item.id ? (
                  <ActivityIndicator size="small" color={colors.danger} />
                ) : (
                  <LogOut size={16} color={colors.danger} />
                )}
              </Pressable>
            )}
          </View>
        );
      })}
      {items && others === 0 ? (
        <Text style={styles.hint}>{text.onlyThisDevice}</Text>
      ) : null}
      {others > 0 ? (
        <Button
          label={text.endOthers}
          secondary
          loading={busy === 'all'}
          onPress={() =>
            run('all', async () => {
              await endOtherSessions();
              setNotice(text.endedOthers);
            })
          }
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: { ...type.caption, color: colors.secondary, lineHeight: 19 },
  notice: { color: colors.success, fontSize: 13 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.raised,
  },
  iconCurrent: { backgroundColor: colors.brand },
  body: { flex: 1, gap: 2 },
  device: { color: colors.text, fontSize: 15, fontWeight: '700' },
  meta: { ...type.caption, color: colors.muted },
  end: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dangerWash,
  },
});
