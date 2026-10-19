import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ArrowLeftRight, ChevronRight } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '../../../shared/ui/Avatar';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { avatarUrl } from '../../../shared/lib/avatar';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, shadow, space, type } from '../../../styles/tokens';
import type { CoachMembership, CoachRepository } from '../domain/models';

const text = copy.coaches;

// The coach's "Geçiş yap" header button. Hidden without an active club; with
// several clubs it asks which one.
export function SwitchClubButton({
  token,
  service,
  onSwitch,
}: {
  token: string;
  service: CoachRepository;
  onSwitch(clubId: string): Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const [clubs, setClubs] = useState<CoachMembership[]>([]);
  const [choosing, setChoosing] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  useFocusEffect(
    useCallback(() => {
      let current = true;
      service
        .memberships(token)
        .then(items => {
          if (current) setClubs(items.filter(m => m.status === 'active'));
        })
        .catch(() => undefined);
      return () => {
        current = false;
      };
    }, [service, token]),
  );
  async function go(clubId: string) {
    if (busy) return;
    setBusy(clubId);
    setError('');
    try {
      await onSwitch(clubId);
      setChoosing(false);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : text.switchFailed);
    } finally {
      setBusy('');
    }
  }
  if (!clubs.length) return null;
  const only = clubs.length === 1 ? clubs[0] : null;
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          only ? text.switchTo(only.club.fullName) : text.switch
        }
        accessibilityState={{ busy: !!busy }}
        onPress={() => (only ? go(only.club.id) : setChoosing(true))}
        style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
      >
        {busy && only ? (
          <ActivityIndicator size="small" color={colors.brandInk} />
        ) : (
          <ArrowLeftRight size={16} color={colors.brandInk} strokeWidth={2.4} />
        )}
        <Text style={styles.pillText}>{text.switch}</Text>
      </Pressable>
      {error && only ? (
        <View style={styles.inlineError}>
          <ErrorBanner message={error} />
        </View>
      ) : null}
      <Modal
        visible={choosing}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setChoosing(false)}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.profileShare.close}
          onPress={() => setChoosing(false)}
          style={styles.scrim}
        />
        <View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, space.xl) + space.md },
          ]}
        >
          <View style={styles.handle} />
          <Text accessibilityRole="header" style={styles.title}>
            {text.switchTitle}
          </Text>
          {clubs.map(item => (
            <Pressable
              key={item.club.id}
              accessibilityRole="button"
              accessibilityLabel={text.switchTo(item.club.fullName)}
              disabled={!!busy}
              onPress={() => go(item.club.id)}
              style={({ pressed }) => [
                styles.row,
                pressed && styles.rowPressed,
              ]}
            >
              <Avatar
                name={item.club.fullName}
                uri={avatarUrl(item.club.id, item.club.avatarVersion)}
                size={44}
                square
              />
              <View style={styles.flex}>
                <Text numberOfLines={1} style={styles.name}>
                  {item.club.fullName}
                </Text>
                <Text numberOfLines={1} style={styles.meta}>
                  {text.specialties[item.role]} ·{' '}
                  {item.permissions.length
                    ? text.allowed(item.permissions.length)
                    : text.noPermissions}
                </Text>
              </View>
              {busy === item.club.id ? (
                <ActivityIndicator color={colors.brand} />
              ) : (
                <ChevronRight size={18} color={colors.muted} />
              )}
            </Pressable>
          ))}
          <ErrorBanner message={error} />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    ...shadow.glow,
  },
  pillText: { color: colors.brandInk, fontSize: 13, fontWeight: '800' },
  pressed: { opacity: 0.85 },
  inlineError: { position: 'absolute', top: 52, right: 0, width: 260 },
  scrim: { flex: 1, backgroundColor: colors.scrim },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: space.md,
    paddingTop: space.sm,
    paddingHorizontal: space.xl,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  title: { ...type.headline, color: colors.text },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.raised,
  },
  rowPressed: { backgroundColor: colors.overlay },
  flex: { flex: 1 },
  name: { color: colors.text, fontSize: 15, fontWeight: '800' },
  meta: { ...type.caption, color: colors.secondary },
});
