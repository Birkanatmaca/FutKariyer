import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ban, Check, Flag, type LucideIcon } from 'lucide-react-native';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { Field } from '../../../shared/ui/Field';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space, type } from '../../../styles/tokens';
import type { ModerationService } from '../application/moderation-service';
import {
  reportNoteLimit,
  reportReasons,
  type ModerationTarget,
  type ReportReason,
} from '../domain/models';

type Step = 'menu' | 'report' | 'block' | 'reported' | 'blocked';
const text = copy.moderation;

// Report or block from a post, reply or profile. The sheet walks through
// a short menu, the report form or block confirmation, and a result.
export function ModerationSheet({
  target,
  token,
  service,
  onClose,
  onBlocked,
}: {
  target: ModerationTarget | null;
  token: string;
  service: ModerationService;
  onClose(): void;
  onBlocked?(userId: string): void;
}) {
  const [step, setStep] = useState<Step>('menu');
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    setStep('menu');
    setReason(null);
    setNote('');
    setError('');
  }, [target]);
  if (!target) return null;
  const current = target;
  function close() {
    if (!busy) onClose();
  }
  async function run(action: () => Promise<void>, next: Step) {
    setBusy(true);
    setError('');
    try {
      await action();
      setStep(next);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : copy.form.unexpected,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View style={styles.backdrop}>
        <View accessibilityViewIsModal style={styles.sheet}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
          >
            {step === 'menu' ? (
              <>
                <Text accessibilityRole="header" style={styles.title}>
                  {current.name}
                </Text>
                <MenuRow
                  icon={Flag}
                  label={text.report[current.kind]}
                  onPress={() => setStep('report')}
                />
                <MenuRow
                  icon={Ban}
                  label={text.block(current.name)}
                  danger
                  onPress={() => setStep('block')}
                />
                <Button label={text.cancel} secondary onPress={close} />
              </>
            ) : step === 'report' ? (
              <>
                <Text accessibilityRole="header" style={styles.title}>
                  {text.report[current.kind]}
                </Text>
                <View accessibilityRole="radiogroup" style={styles.reasons}>
                  {reportReasons.map(value => (
                    <Pressable
                      key={value}
                      accessibilityRole="radio"
                      accessibilityState={{
                        checked: reason === value,
                        disabled: busy,
                      }}
                      disabled={busy}
                      onPress={() => setReason(value)}
                      style={[
                        styles.reason,
                        reason === value && styles.reasonSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.reasonText,
                          reason === value && styles.reasonTextSelected,
                        ]}
                      >
                        {text.reasons[value]}
                      </Text>
                      {reason === value ? (
                        <Check size={18} color={colors.brand} />
                      ) : null}
                    </Pressable>
                  ))}
                </View>
                <Field
                  label={text.note}
                  value={note}
                  onChangeText={setNote}
                  placeholder={text.notePlaceholder}
                  multiline
                  maxLength={reportNoteLimit}
                  editable={!busy}
                />
                <ErrorBanner message={error} />
                <Button
                  label={text.send}
                  loading={busy}
                  disabled={!reason}
                  onPress={() =>
                    reason &&
                    run(
                      () => service.report(token, current, reason, note),
                      'reported',
                    )
                  }
                />
                <Button label={text.cancel} secondary onPress={close} />
              </>
            ) : step === 'block' ? (
              <>
                <Text accessibilityRole="header" style={styles.title}>
                  {text.blockTitle(current.name)}
                </Text>
                <Text style={styles.body}>{text.blockBody}</Text>
                <ErrorBanner message={error} />
                <Button
                  label={text.blockConfirm}
                  loading={busy}
                  onPress={() =>
                    run(async () => {
                      await service.block(token, current.userId);
                      onBlocked?.(current.userId);
                    }, 'blocked')
                  }
                />
                <Button label={text.cancel} secondary onPress={close} />
              </>
            ) : (
              <>
                <View style={styles.doneIcon}>
                  <Check size={28} color={colors.brand} />
                </View>
                <Text
                  accessibilityRole="header"
                  accessibilityLiveRegion="polite"
                  style={styles.title}
                >
                  {step === 'reported'
                    ? text.reported
                    : text.blocked(current.name)}
                </Text>
                <Text style={styles.body}>
                  {step === 'reported' ? text.reportedBody : text.blockedBody}
                </Text>
                <Button label={text.done} onPress={onClose} />
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function MenuRow({
  icon: Icon,
  label,
  danger,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  danger?: boolean;
  onPress(): void;
}) {
  const color = danger ? colors.danger : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Icon size={20} color={color} />
      <Text style={[styles.rowText, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.scrim,
  },
  sheet: {
    maxHeight: '88%',
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  content: { padding: space.xl, gap: space.md },
  title: { ...type.headline, fontSize: 19, color: colors.text },
  body: { ...type.body, color: colors.secondary },
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    backgroundColor: colors.raised,
  },
  pressed: { opacity: 0.85 },
  rowText: { fontSize: 15, fontWeight: '700' },
  reasons: { gap: space.sm },
  reason: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reasonSelected: {
    borderColor: colors.brand,
    backgroundColor: colors.brandWash,
  },
  reasonText: { color: colors.secondary, fontSize: 14, fontWeight: '600' },
  reasonTextSelected: { color: colors.text },
  doneIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandWash,
    borderWidth: 1,
    borderColor: colors.brandSoft,
  },
});
