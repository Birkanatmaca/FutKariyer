import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '../../../shared/ui/Avatar';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { avatarUrl } from '../../../shared/lib/avatar';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space, type } from '../../../styles/tokens';
import { staffPermissions, type StaffPermission } from '../../auth';
import {
  coachSpecialties,
  type CoachProfile,
  type CoachSpecialty,
  type Person,
  type StaffGrant,
} from '../domain/models';
import { CoachFacts } from './CoachFacts';
import { Chip, Chips, Section, ToggleRow } from './CoachPrimitives';

const text = copy.coaches;

// Bottom sheet where a club sets a coach's role and the club sections they
// may run, while seeing everything the coach declared. Mount it with a key per
// coach so it starts from that coach's grant.
export function StaffGrantSheet({
  visible,
  coach,
  profile,
  initial,
  mode,
  busy,
  error,
  onClose,
  onSubmit,
  onRemove,
}: {
  visible: boolean;
  coach: Person | null;
  profile: CoachProfile | null;
  initial: StaffGrant;
  // invite: a new invitation; invited/active: editing an existing link.
  mode: 'invite' | 'invited' | 'active';
  busy: boolean;
  error: string;
  onClose(): void;
  onSubmit(grant: StaffGrant): void;
  onRemove?(): void;
}) {
  const insets = useSafeAreaInsets();
  const [role, setRole] = useState<CoachSpecialty>(initial.role);
  const [permissions, setPermissions] = useState<StaffPermission[]>(
    initial.permissions,
  );
  function toggle(permission: StaffPermission, on: boolean) {
    setPermissions(list =>
      on ? [...list, permission] : list.filter(p => p !== permission),
    );
  }
  return (
    <Modal
      visible={visible && !!coach}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copy.profileShare.close}
        onPress={busy ? undefined : onClose}
        style={styles.scrim}
      />
      {coach ? (
        <View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, space.xl) },
          ]}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <Avatar
              name={coach.fullName}
              uri={avatarUrl(coach.id, coach.avatarVersion)}
              size={52}
            />
            <View style={styles.flex}>
              <Text accessibilityRole="header" style={styles.name}>
                {coach.fullName}
              </Text>
              <Text style={styles.meta}>
                {[copy.coaches.role, coach.district]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={copy.profileShare.close}
              onPress={onClose}
              disabled={busy}
              hitSlop={8}
              style={styles.close}
            >
              <X size={20} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            {profile ? (
              <Section title={text.profileTitle}>
                <CoachFacts
                  profile={profile}
                  clubs={[]}
                  emptyText={text.notDeclared}
                />
              </Section>
            ) : null}
            <Section title={text.roleLabel}>
              <Chips>
                {coachSpecialties.map(item => (
                  <Chip
                    key={item}
                    label={text.specialties[item]}
                    selected={role === item}
                    disabled={busy}
                    onPress={() => setRole(item)}
                  />
                ))}
              </Chips>
            </Section>
            <Section title={text.permissionsLabel} hint={text.permissionsNote}>
              {staffPermissions.map(permission => (
                <ToggleRow
                  key={permission}
                  label={text.permissions[permission]}
                  hint={text.permissionHints[permission]}
                  value={permissions.includes(permission)}
                  disabled={busy}
                  onChange={on => toggle(permission, on)}
                />
              ))}
            </Section>
            <ErrorBanner message={error} />
            <Button
              label={mode === 'invite' ? text.sendInvite : text.saveGrant}
              loading={busy}
              onPress={() => onSubmit({ role, permissions })}
            />
            {onRemove ? (
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={onRemove}
                style={styles.remove}
              >
                <Text style={styles.removeText}>
                  {mode === 'invited' ? text.cancelInvite : text.remove}
                </Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </View>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: colors.scrim },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '88%',
    paddingTop: space.sm,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.bg,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: space.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.xl,
    paddingBottom: space.md,
  },
  flex: { flex: 1 },
  name: { ...type.headline, color: colors.text },
  meta: { ...type.caption, color: colors.secondary },
  close: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.raised,
  },
  scroll: { flexGrow: 0 },
  content: {
    gap: space.lg,
    paddingHorizontal: space.lg,
    paddingBottom: space.xl,
  },
  remove: { alignSelf: 'center', padding: space.sm },
  removeText: { color: colors.danger, fontSize: 14, fontWeight: '700' },
});
