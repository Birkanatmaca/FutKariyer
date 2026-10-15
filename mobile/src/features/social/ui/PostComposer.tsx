import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Send } from 'lucide-react-native';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space } from '../../../styles/tokens';
import { maxPostLength } from '../domain/models';

export function PostComposer({
  name,
  reply,
  busy,
  onSubmit,
}: {
  name: string;
  reply?: boolean;
  busy: boolean;
  onSubmit(body: string): Promise<void>;
}) {
  const [body, setBody] = useState('');
  const count = Array.from(body.trim()).length;
  const disabled = busy || count === 0 || count > maxPostLength;
  async function submit() {
    if (disabled) return;
    try {
      await onSubmit(body);
      setBody('');
    } catch {
      /* The parent displays the error and the draft stays intact. */
    }
  }
  return (
    <View style={styles.composer}>
      <View style={styles.heading}>
        <View style={styles.avatar}>
          <Text style={styles.initial}>
            {Array.from(name)[0]?.toLocaleUpperCase('tr-TR') || 'F'}
          </Text>
        </View>
        <View style={styles.headingText}>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.audience}>
            {reply ? copy.social.replyAudience : copy.social.audience}
          </Text>
        </View>
      </View>
      <TextInput
        accessibilityLabel={
          reply ? copy.social.replyPlaceholder : copy.social.placeholder
        }
        placeholder={
          reply ? copy.social.replyPlaceholder : copy.social.placeholder
        }
        placeholderTextColor={colors.muted}
        value={body}
        onChangeText={setBody}
        multiline
        editable={!busy}
        maxLength={maxPostLength * 2}
        textAlignVertical="top"
        style={styles.input}
      />
      <View style={styles.footer}>
        <Text style={[styles.count, count > maxPostLength && styles.overLimit]}>
          {count} / {maxPostLength}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            reply ? copy.social.replySend : copy.social.publish
          }
          accessibilityState={{ disabled, busy }}
          aria-disabled={disabled}
          aria-busy={busy}
          disabled={disabled}
          onPress={submit}
          style={({ pressed }) => [
            styles.send,
            disabled && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          {busy ? (
            <ActivityIndicator size="small" color={colors.brandInk} />
          ) : (
            <Send size={16} color={colors.brandInk} />
          )}
          <Text style={styles.sendLabel}>
            {reply ? copy.social.replySend : copy.social.publish}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  composer: {
    padding: space.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: space.md,
  },
  heading: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brandWash,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initial: { color: colors.brand, fontSize: 17, fontWeight: '800' },
  headingText: { flex: 1, gap: space.xs },
  name: { color: colors.text, fontSize: 14, fontWeight: '700' },
  audience: { color: colors.muted, fontSize: 11 },
  input: {
    minHeight: 94,
    color: colors.text,
    fontSize: 15,
    lineHeight: 23,
    padding: 0,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: space.md,
    gap: space.sm,
  },
  count: { color: colors.muted, fontSize: 12 },
  overLimit: { color: colors.danger },
  send: {
    minHeight: 44,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  sendLabel: { color: colors.brandInk, fontSize: 13, fontWeight: '800' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.8 },
});
