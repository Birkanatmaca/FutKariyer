import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, SendHorizontal } from 'lucide-react-native';
import { Avatar } from '../../../shared/ui/Avatar';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { KeyboardAvoidingView } from '../../../shared/ui/keyboard';
import { avatarUrl } from '../../../shared/lib/avatar';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space } from '../../../styles/tokens';
import type { MessagesService } from '../application/messages-service';
import {
  maxMessageLength,
  type ChatMessage,
  type Thread,
} from '../domain/models';

const text = copy.messages;
// While the chat is open new messages arrive by polling; there is no socket.
const POLL_MS = 5000;

// One conversation (23 Oct 2026): newest at the bottom, a composer that stays
// above the keyboard, "Görüldü" under the last own message once read.
export function ChatScreen({
  token,
  partnerId,
  service,
  onBack,
  onOpenProfile,
}: {
  token: string;
  partnerId: string;
  service: MessagesService;
  onBack(): void;
  onOpenProfile?(id: string): void;
}) {
  const [thread, setThread] = useState<Thread | null>(null);
  const [older, setOlder] = useState<ChatMessage[]>([]);
  const [cursor, setCursor] = useState('');
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [focused, setFocused] = useState(false);
  const lastSeen = useRef('');
  // The newest page is refreshed in place; older pages stay as loaded.
  const refresh = useCallback(() => {
    let current = true;
    service
      .thread(token, partnerId)
      .then(value => {
        if (!current) return;
        setThread(value);
        setError('');
        setCursor(previous => previous || value.nextCursor);
        const newest = value.items.find(item => !item.mine);
        if (newest && newest.id !== lastSeen.current) {
          lastSeen.current = newest.id;
          service.markRead(token, partnerId).catch(() => undefined);
        }
      })
      .catch(
        failure =>
          current &&
          setError(
            failure instanceof Error ? failure.message : copy.form.unexpected,
          ),
      );
    return () => {
      current = false;
    };
  }, [service, token, partnerId]);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      service.markRead(token, partnerId).catch(() => undefined);
      const stop = refresh();
      return () => {
        setFocused(false);
        stop();
      };
    }, [refresh, service, token, partnerId]),
  );
  useEffect(() => {
    if (!focused) return;
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [focused, refresh]);
  async function loadOlder() {
    if (!cursor || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const page = await service.thread(token, partnerId, cursor);
      setOlder(previous => [...previous, ...page.items]);
      setCursor(page.nextCursor);
    } catch {
      // The button stays; the next tap tries again.
    } finally {
      setLoadingOlder(false);
    }
  }
  async function send() {
    if (sending || !draft.trim()) return;
    setSending(true);
    setSendError('');
    try {
      const message = await service.send(token, partnerId, draft);
      setDraft('');
      setThread(value =>
        value ? { ...value, items: [message, ...value.items] } : value,
      );
    } catch (failure) {
      setSendError(
        failure instanceof Error ? failure.message : text.sendFailed,
      );
    } finally {
      setSending(false);
    }
  }
  const seen = new Set<string>();
  const items = [...(thread?.items ?? []), ...older].filter(item =>
    seen.has(item.id) ? false : (seen.add(item.id), true),
  );
  const lastMine = items.find(item => item.mine);
  const seenId =
    lastMine &&
    thread?.partnerReadAt &&
    Date.parse(thread.partnerReadAt) >= Date.parse(lastMine.createdAt)
      ? lastMine.id
      : '';
  const partner = thread?.partner;
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.form.back}
          onPress={onBack}
          hitSlop={8}
          style={styles.back}
        >
          <ArrowLeft size={20} color={colors.text} />
        </Pressable>
        {partner ? (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={text.openProfile(partner.fullName)}
            disabled={!onOpenProfile}
            onPress={() => onOpenProfile?.(partner.id)}
            style={styles.partner}
          >
            <Avatar
              name={partner.fullName}
              uri={avatarUrl(partner.id, partner.avatarVersion)}
              size={36}
              square={partner.role === 'club'}
            />
            <View style={styles.partnerText}>
              <Text numberOfLines={1} style={styles.partnerName}>
                {partner.fullName}
              </Text>
              <Text style={styles.partnerRole}>{copy.roles[partner.role]}</Text>
            </View>
          </Pressable>
        ) : null}
      </View>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        {error && !thread ? (
          <View style={styles.center}>
            <ErrorBanner message={error} />
            <Button label={copy.form.retry} onPress={() => refresh()} />
          </View>
        ) : !thread ? (
          <ActivityIndicator color={colors.brand} style={styles.center} />
        ) : (
          <FlatList
            inverted
            data={items}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <Text style={[styles.empty, styles.flip]}>{text.start}</Text>
            }
            ListFooterComponent={
              cursor ? (
                <Button
                  label={text.loadOlder}
                  secondary
                  loading={loadingOlder}
                  onPress={loadOlder}
                />
              ) : null
            }
            renderItem={({ item }) => (
              <View
                style={[styles.bubbleRow, item.mine && styles.bubbleRowMine]}
              >
                <View style={[styles.bubble, item.mine && styles.bubbleMine]}>
                  <Text
                    selectable
                    style={[styles.bubbleText, item.mine && styles.mineText]}
                  >
                    {item.body}
                  </Text>
                  <Text style={[styles.stamp, item.mine && styles.mineStamp]}>
                    {text.time(item.createdAt)}
                  </Text>
                </View>
                {item.id === seenId ? (
                  <Text style={styles.seen}>{text.seen}</Text>
                ) : null}
              </View>
            )}
          />
        )}
        {thread && !thread.canSend ? (
          <Text style={styles.readOnly}>{text.readOnly}</Text>
        ) : thread ? (
          <View style={styles.composerWrap}>
            {sendError ? <ErrorBanner message={sendError} /> : null}
            <View style={styles.composer}>
              <TextInput
                accessibilityLabel={text.placeholder}
                placeholder={text.placeholder}
                placeholderTextColor={colors.muted}
                value={draft}
                onChangeText={setDraft}
                multiline
                maxLength={maxMessageLength}
                style={styles.input}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={text.send}
                accessibilityState={{ disabled: sending || !draft.trim() }}
                disabled={sending || !draft.trim()}
                onPress={send}
                style={[
                  styles.send,
                  (sending || !draft.trim()) && styles.sendOff,
                ]}
              >
                {sending ? (
                  <ActivityIndicator size="small" color={colors.brandInk} />
                ) : (
                  <SendHorizontal size={18} color={colors.brandInk} />
                )}
              </Pressable>
            </View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  back: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  partner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  partnerText: { flex: 1 },
  partnerName: { color: colors.text, fontSize: 16, fontWeight: '700' },
  partnerRole: { color: colors.muted, fontSize: 12 },
  center: {
    flex: 1,
    padding: space.xl,
    gap: space.md,
    justifyContent: 'center',
  },
  list: { padding: space.lg, gap: space.sm, flexGrow: 1 },
  flip: { transform: [{ scaleY: -1 }] },
  empty: {
    color: colors.secondary,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: space.xxl,
  },
  bubbleRow: { alignItems: 'flex-start', gap: 2 },
  bubbleRowMine: { alignItems: 'flex-end' },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.lg,
    borderBottomLeftRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bubbleMine: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.sm,
  },
  bubbleText: { color: colors.text, fontSize: 15, lineHeight: 21 },
  mineText: { color: colors.brandInk },
  stamp: {
    color: colors.muted,
    fontSize: 10,
    marginTop: 2,
    textAlign: 'right',
  },
  mineStamp: { color: colors.brandInk, opacity: 0.7 },
  seen: { color: colors.muted, fontSize: 11 },
  readOnly: {
    color: colors.secondary,
    fontSize: 13,
    textAlign: 'center',
    padding: space.lg,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  composerWrap: {
    gap: space.sm,
    padding: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    backgroundColor: colors.bg,
  },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: space.md,
    paddingTop: 12,
    paddingBottom: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 15,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendOff: { opacity: 0.45 },
});
