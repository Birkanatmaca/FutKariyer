import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ArrowLeftRight, Shield } from 'lucide-react-native';
import { Screen } from '../../../shared/ui/Screen';
import { TopBar } from '../../../shared/ui/TopBar';
import { Avatar } from '../../../shared/ui/Avatar';
import { Button } from '../../../shared/ui/Button';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { avatarUrl } from '../../../shared/lib/avatar';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space, type } from '../../../styles/tokens';
import { confirmAction } from '../../connections';
import type { CoachMembership, CoachRepository } from '../domain/models';
import { Tag } from './CoachPrimitives';

const text = copy.coaches;

// "Kulüplerim": the coach's club invitations and the clubs they can switch
// into.
export function CoachClubsScreen({
  token,
  service,
  onBack,
  onSwitch,
}: {
  token: string;
  service: CoachRepository;
  onBack(): void;
  onSwitch(clubId: string): Promise<void>;
}) {
  const [items, setItems] = useState<CoachMembership[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const fail = (failure: unknown) =>
    setError(failure instanceof Error ? failure.message : copy.form.unexpected);
  const load = useCallback(() => {
    setError('');
    service.memberships(token).then(setItems).catch(fail);
  }, [service, token]);
  useFocusEffect(load);
  async function run(key: string, action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(key);
    setError('');
    try {
      await action();
    } catch (failure) {
      fail(failure);
    } finally {
      setBusy('');
    }
  }
  const respond = (clubId: string, accept: boolean) =>
    run(clubId + accept, async () =>
      setItems(await service.respond(token, clubId, accept)),
    );
  const leave = (item: CoachMembership) =>
    run(item.club.id + 'leave', async () => {
      if (
        !(await confirmAction(
          text.leaveTitle,
          text.leaveBody(item.club.fullName),
          text.leave,
        ))
      )
        return;
      await service.leave(token, item.club.id);
      setItems(list => list?.filter(m => m.club.id !== item.club.id) ?? null);
    });
  const invitations = items?.filter(m => m.status === 'invited') ?? [];
  const clubs = items?.filter(m => m.status === 'active') ?? [];
  return (
    <Screen>
      <TopBar title={text.myClubs} onBack={onBack} />
      {error ? <ErrorBanner message={error} /> : null}
      {!items ? (
        error ? (
          <Button label={copy.form.retry} onPress={load} />
        ) : (
          <ActivityIndicator color={colors.brand} />
        )
      ) : !items.length ? (
        <EmptyState
          icon={Shield}
          title={text.noClubsTitle}
          body={text.noClubsBody}
        />
      ) : (
        <>
          {invitations.length ? (
            <View style={styles.group}>
              <Text accessibilityRole="header" style={styles.groupTitle}>
                {text.invitations}
              </Text>
              {invitations.map(item => (
                <View key={item.club.id} style={styles.card}>
                  <ClubHeader item={item} />
                  <Text style={styles.line}>
                    {item.permissions.length
                      ? text.inviteNote
                      : text.inviteViewOnly}
                  </Text>
                  <Permissions item={item} />
                  <View style={styles.row}>
                    <View style={styles.flex}>
                      <Button
                        secondary
                        label={text.decline}
                        loading={busy === item.club.id + false}
                        disabled={!!busy}
                        onPress={() => respond(item.club.id, false)}
                      />
                    </View>
                    <View style={styles.flex}>
                      <Button
                        label={text.accept}
                        loading={busy === item.club.id + true}
                        disabled={!!busy}
                        onPress={() => respond(item.club.id, true)}
                      />
                    </View>
                  </View>
                </View>
              ))}
            </View>
          ) : null}
          {clubs.length ? (
            <View style={styles.group}>
              <Text accessibilityRole="header" style={styles.groupTitle}>
                {text.activeClubs}
              </Text>
              {clubs.map(item => (
                <View key={item.club.id} style={styles.card}>
                  <ClubHeader item={item} />
                  <Permissions item={item} />
                  <Button
                    label={text.switchTo(item.club.fullName)}
                    loading={busy === item.club.id + 'switch'}
                    disabled={!!busy}
                    onPress={() =>
                      run(item.club.id + 'switch', () => onSwitch(item.club.id))
                    }
                  />
                  <Pressable
                    accessibilityRole="button"
                    disabled={!!busy}
                    onPress={() => leave(item)}
                    style={styles.leave}
                  >
                    <Text style={styles.leaveText}>{text.leave}</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}
        </>
      )}
    </Screen>
  );
}

function ClubHeader({ item }: { item: CoachMembership }) {
  return (
    <View style={styles.header}>
      <Avatar
        name={item.club.fullName}
        uri={avatarUrl(item.club.id, item.club.avatarVersion)}
        size={48}
        square
      />
      <View style={styles.flex}>
        <Text numberOfLines={1} style={styles.name}>
          {item.club.fullName}
        </Text>
        <Text numberOfLines={1} style={styles.meta}>
          {[text.specialties[item.role], item.club.district]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </View>
      {item.status === 'active' ? (
        <ArrowLeftRight size={18} color={colors.brand} />
      ) : null}
    </View>
  );
}

function Permissions({ item }: { item: CoachMembership }) {
  return (
    <View style={styles.tags}>
      {item.permissions.length ? (
        item.permissions.map(p => (
          <Tag key={p} label={text.permissions[p]} strong />
        ))
      ) : (
        <Tag label={text.noPermissions} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.md },
  groupTitle: { ...type.headline, color: colors.text },
  card: {
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1 },
  name: { color: colors.text, fontSize: 16, fontWeight: '800' },
  meta: { ...type.caption, color: colors.secondary },
  line: { ...type.caption, color: colors.secondary },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  row: { flexDirection: 'row', gap: space.sm },
  leave: { alignSelf: 'center', paddingVertical: space.xs },
  leaveText: { color: colors.danger, fontSize: 13, fontWeight: '600' },
});
