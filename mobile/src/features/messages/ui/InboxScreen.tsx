import React, { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MessageCircle } from 'lucide-react-native';
import { Screen } from '../../../shared/ui/Screen';
import { TopBar } from '../../../shared/ui/TopBar';
import { Avatar } from '../../../shared/ui/Avatar';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { avatarUrl } from '../../../shared/lib/avatar';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space } from '../../../styles/tokens';
import type { MessagesService } from '../application/messages-service';
import type { Inbox } from '../domain/models';

const text = copy.messages;
const REFRESH_MS = 15000;

// Mesajlar (23 Oct 2026): conversations, latest first, with unread counts.
export function InboxScreen({
  token,
  service,
  onBack,
  onOpen,
}: {
  token: string;
  service: MessagesService;
  onBack(): void;
  onOpen(partnerId: string): void;
}) {
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [error, setError] = useState('');
  const [focused, setFocused] = useState(false);
  const load = useCallback(() => {
    let current = true;
    service
      .inbox(token)
      .then(value => {
        if (!current) return;
        setInbox(value);
        setError('');
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
  }, [service, token]);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      const stop = load();
      return () => {
        setFocused(false);
        stop();
      };
    }, [load]),
  );
  // New messages show up while the list is open.
  useEffect(() => {
    if (!focused) return;
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [focused, load]);
  return (
    <Screen>
      <TopBar title={text.title} onBack={onBack} />
      {error && !inbox ? (
        <>
          <ErrorBanner message={error} />
          <Button label={copy.form.retry} onPress={() => load()} />
        </>
      ) : !inbox ? (
        <ActivityIndicator color={colors.brand} />
      ) : inbox.items.length ? (
        <View style={styles.list}>
          {inbox.items.map(item => (
            <Pressable
              key={item.partner.id}
              accessibilityRole="button"
              accessibilityLabel={
                item.partner.fullName +
                (item.unread ? ', ' + text.unread(item.unread) : '')
              }
              onPress={() => onOpen(item.partner.id)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <Avatar
                name={item.partner.fullName}
                uri={avatarUrl(item.partner.id, item.partner.avatarVersion)}
                size={52}
                square={item.partner.role === 'club'}
              />
              <View style={styles.body}>
                <View style={styles.top}>
                  <Text
                    numberOfLines={1}
                    style={[styles.name, item.unread > 0 && styles.strong]}
                  >
                    {item.partner.fullName}
                  </Text>
                  <Text style={styles.time}>{text.time(item.updatedAt)}</Text>
                </View>
                <View style={styles.top}>
                  <Text
                    numberOfLines={1}
                    style={[styles.preview, item.unread > 0 && styles.strong]}
                  >
                    {item.lastMessage
                      ? (item.lastMessage.mine ? text.you : '') +
                        item.lastMessage.body
                      : ''}
                  </Text>
                  {item.unread > 0 ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>
                        {item.unread > 99 ? '99+' : item.unread}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      ) : (
        <EmptyState
          icon={MessageCircle}
          title={text.emptyTitle}
          body={text.emptyBody}
        />
      )}
      {inbox && !inbox.items.length ? (
        <Text style={styles.hint}>{text.emptyBody}</Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
  },
  pressed: { backgroundColor: colors.overlay },
  body: { flex: 1, gap: 3 },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  name: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '600' },
  strong: { color: colors.text, fontWeight: '800' },
  time: { color: colors.muted, fontSize: 12 },
  preview: { flex: 1, color: colors.secondary, fontSize: 13 },
  badge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.brandInk, fontSize: 11, fontWeight: '800' },
  hint: { color: colors.secondary, fontSize: 13, textAlign: 'center' },
});
