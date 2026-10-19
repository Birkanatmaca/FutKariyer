import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  ChevronRight,
  Search,
  UserPlus,
  UsersRound,
} from 'lucide-react-native';
import { Screen } from '../../../shared/ui/Screen';
import { TopBar } from '../../../shared/ui/TopBar';
import { Avatar } from '../../../shared/ui/Avatar';
import { Button } from '../../../shared/ui/Button';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { ApiError } from '../../../shared/api/client';
import { avatarUrl } from '../../../shared/lib/avatar';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space, type } from '../../../styles/tokens';
import { confirmAction } from '../../connections';
import type {
  CoachRepository,
  Person,
  CoachProfile,
  StaffCandidate,
  StaffGrant,
  StaffList,
  StaffMember,
} from '../domain/models';
import { Tag } from './CoachPrimitives';
import { StaffGrantSheet } from './StaffGrantSheet';

const text = copy.coaches;
const newGrant: StaffGrant = { role: 'head_coach', permissions: [] };

type Editing = {
  coach: Person;
  profile: CoachProfile;
  grant: StaffGrant;
  mode: 'invite' | 'invited' | 'active';
};

// "Teknik ekip": a club invites coaches, sets their role and the club
// sections they may run after switching, and removes them.
export function StaffScreen({
  token,
  service,
  onBack,
}: {
  token: string;
  service: CoachRepository;
  onBack(): void;
}) {
  const [list, setList] = useState<StaffList | null>(null);
  const [error, setError] = useState('');
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StaffCandidate[] | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [busy, setBusy] = useState(false);
  const [sheetError, setSheetError] = useState('');
  const message = (failure: unknown) =>
    failure instanceof ApiError || failure instanceof Error
      ? failure.message
      : copy.form.unexpected;
  const load = useCallback(() => {
    setError('');
    service
      .staff(token)
      .then(setList)
      .catch(failure => setError(message(failure)));
  }, [service, token]);
  useFocusEffect(load);
  useEffect(() => {
    if (!searching) return;
    const term = query.trim();
    if (Array.from(term).length < 2) {
      setResults(null);
      return;
    }
    let current = true;
    const timer = setTimeout(() => {
      service
        .candidates(token, term)
        .then(items => current && setResults(items))
        .catch(failure => current && setError(message(failure)));
    }, 250);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [query, searching, service, token]);
  async function submit(grant: StaffGrant) {
    if (!editing) return;
    setBusy(true);
    setSheetError('');
    try {
      const next =
        editing.mode === 'invite'
          ? await service.invite(token, editing.coach.id, grant)
          : await service.update(token, editing.coach.id, grant);
      setList(next);
      setEditing(null);
      setSearching(false);
      setQuery('');
      setResults(null);
    } catch (failure) {
      setSheetError(message(failure));
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!editing) return;
    const coach = editing.coach;
    if (
      !(await confirmAction(
        text.removeTitle,
        text.removeBody(coach.fullName),
        editing.mode === 'invited' ? text.cancelInvite : text.remove,
      ))
    )
      return;
    setBusy(true);
    setSheetError('');
    try {
      await service.remove(token, coach.id);
      setList(value =>
        value
          ? {
              ...value,
              staff: value.staff.filter(m => m.coach.id !== coach.id),
            }
          : value,
      );
      setEditing(null);
    } catch (failure) {
      setSheetError(message(failure));
    } finally {
      setBusy(false);
    }
  }
  const openMember = (member: StaffMember) => {
    setSheetError('');
    setEditing({
      coach: member.coach,
      profile: member.profile,
      grant: { role: member.role, permissions: member.permissions },
      mode: member.status,
    });
  };
  const openCandidate = (candidate: StaffCandidate) => {
    setSheetError('');
    setEditing({
      coach: candidate.coach,
      profile: candidate.profile,
      grant: newGrant,
      mode: 'invite',
    });
  };
  const full = !!list && list.staff.length >= list.limit;
  return (
    <Screen>
      <TopBar
        title={text.staff}
        onBack={onBack}
        accessory={
          list ? (
            <Text style={styles.count}>
              {text.limit(list.staff.length, list.limit)}
            </Text>
          ) : null
        }
      />
      {error ? <ErrorBanner message={error} /> : null}
      {searching ? (
        <View style={styles.search}>
          <View style={styles.searchBox}>
            <Search size={18} color={colors.muted} />
            <TextInput
              autoFocus
              value={query}
              onChangeText={setQuery}
              placeholder={text.search}
              placeholderTextColor={colors.muted}
              accessibilityLabel={text.search}
              style={styles.input}
              returnKeyType="search"
            />
          </View>
          {results === null ? (
            <Text style={styles.hint}>{text.searchHint}</Text>
          ) : results.length === 0 ? (
            <Text style={styles.hint}>{text.noResults}</Text>
          ) : (
            results.map(candidate => (
              <PersonRow
                key={candidate.coach.id}
                person={candidate.coach}
                subtitle={[
                  candidate.profile.specialties
                    .map(s => text.specialties[s])
                    .join(', '),
                  candidate.profile.licenseLevel !== 'unknown'
                    ? text.licenses[candidate.profile.licenseLevel]
                    : '',
                ]
                  .filter(Boolean)
                  .join(' · ')}
                onPress={() => openCandidate(candidate)}
              />
            ))
          )}
          <Button
            secondary
            label={copy.profileShare.close}
            onPress={() => {
              setSearching(false);
              setQuery('');
              setResults(null);
            }}
          />
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          disabled={full}
          onPress={() => setSearching(true)}
          style={({ pressed }) => [
            styles.invite,
            full && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.inviteIcon}>
            <UserPlus size={20} color={colors.brandInk} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.inviteTitle}>{text.invite}</Text>
            <Text style={styles.hint}>{text.staffHint}</Text>
          </View>
        </Pressable>
      )}
      {!list ? (
        error ? (
          <Button label={copy.form.retry} onPress={load} />
        ) : (
          <ActivityIndicator color={colors.brand} />
        )
      ) : !list.staff.length ? (
        searching ? null : (
          <EmptyState
            icon={UsersRound}
            title={text.staffEmptyTitle}
            body={text.staffEmptyBody}
          />
        )
      ) : (
        <View style={styles.members}>
          {list.staff.map(member => (
            <Pressable
              key={member.coach.id}
              accessibilityRole="button"
              onPress={() => openMember(member)}
              style={({ pressed }) => [
                styles.member,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.memberTop}>
                <Avatar
                  name={member.coach.fullName}
                  uri={avatarUrl(member.coach.id, member.coach.avatarVersion)}
                  size={46}
                />
                <View style={styles.flex}>
                  <Text numberOfLines={1} style={styles.name}>
                    {member.coach.fullName}
                  </Text>
                  <Text numberOfLines={1} style={styles.meta}>
                    {text.specialties[member.role]}
                  </Text>
                </View>
                <Tag
                  label={
                    member.status === 'active' ? text.active : text.invited
                  }
                  strong={member.status === 'active'}
                />
                <ChevronRight size={18} color={colors.muted} />
              </View>
              <View style={styles.tags}>
                {member.permissions.length ? (
                  member.permissions.map(p => (
                    <Tag key={p} label={text.permissions[p]} />
                  ))
                ) : (
                  <Tag label={text.noPermissions} />
                )}
              </View>
            </Pressable>
          ))}
        </View>
      )}
      <StaffGrantSheet
        key={editing ? editing.coach.id + editing.mode : 'closed'}
        visible={!!editing}
        coach={editing?.coach ?? null}
        profile={editing?.profile ?? null}
        initial={editing?.grant ?? newGrant}
        mode={editing?.mode ?? 'invite'}
        busy={busy}
        error={sheetError}
        onClose={() => setEditing(null)}
        onSubmit={submit}
        onRemove={editing && editing.mode !== 'invite' ? remove : undefined}
      />
    </Screen>
  );
}

function PersonRow({
  person,
  subtitle,
  onPress,
}: {
  person: Person;
  subtitle: string;
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.person, pressed && styles.pressed]}
    >
      <Avatar
        name={person.fullName}
        uri={avatarUrl(person.id, person.avatarVersion)}
        size={42}
      />
      <View style={styles.flex}>
        <Text numberOfLines={1} style={styles.name}>
          {person.fullName}
        </Text>
        <Text numberOfLines={1} style={styles.meta}>
          {subtitle || copy.coaches.role}
        </Text>
      </View>
      <ChevronRight size={18} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  count: { ...type.caption, ...type.number, color: colors.secondary },
  flex: { flex: 1 },
  hint: { ...type.caption, color: colors.secondary },
  invite: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.brandSoft,
    backgroundColor: colors.brandWash,
  },
  inviteIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
  search: { gap: space.md },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 52,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.brand,
    backgroundColor: colors.surface,
  },
  input: { flex: 1, color: colors.text, fontSize: 15 },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  members: { gap: space.md },
  member: {
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  memberTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  name: { color: colors.text, fontSize: 15, fontWeight: '800' },
  meta: { ...type.caption, color: colors.secondary },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
