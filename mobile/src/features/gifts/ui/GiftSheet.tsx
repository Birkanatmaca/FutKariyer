import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gift, X } from 'lucide-react-native';
import { colors, radius, space } from '../../../styles/tokens';
import { copy } from '../../../shared/lib/copy';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import type { Gift as GiftItem } from '../domain/models';
import { GiftCard } from './GiftCard';

export function GiftSheet({
  visible,
  onClose,
  items,
  availableCount,
  loading,
  claimingId,
  notice,
  error,
  onClaim,
}: {
  visible: boolean;
  onClose(): void;
  items: GiftItem[];
  availableCount: number;
  loading: boolean;
  claimingId: string;
  notice: string;
  error: string;
  onClaim(id: string): void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.form.back}
          onPress={onClose}
          style={styles.backdrop}
        />
        <View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, space.xl) },
          ]}
        >
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text accessibilityRole="header" style={styles.title}>
                {copy.gifts.sheetTitle}
              </Text>
              <Text style={styles.body}>{copy.gifts.sheetBody}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={copy.form.back}
              onPress={onClose}
              style={styles.close}
            >
              <X size={18} color={colors.text} />
            </Pressable>
          </View>
          {notice ? (
            <Text accessibilityRole="alert" style={styles.notice}>
              {notice}
            </Text>
          ) : null}
          <ErrorBanner message={error} />
          {loading ? (
            <ActivityIndicator color={colors.brand} />
          ) : availableCount > 0 ? (
            <ScrollView
              style={styles.list}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            >
              {items.map(gift => (
                <GiftCard
                  key={gift.id}
                  gift={gift}
                  claiming={claimingId === gift.id}
                  disabled={!!claimingId}
                  onClaim={() => onClaim(gift.id)}
                />
              ))}
            </ScrollView>
          ) : (
            <EmptyState
              icon={Gift}
              title={copy.gifts.emptyTitle}
              body={copy.gifts.emptyBody}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg,
    opacity: 0.82,
  },
  sheet: {
    maxHeight: '82%',
    gap: space.lg,
    padding: space.xl,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  headerText: { flex: 1, gap: space.sm },
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  body: { color: colors.secondary, fontSize: 13, lineHeight: 20 },
  close: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.raised,
  },
  notice: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 20,
  },
  list: { flexGrow: 0 },
  listContent: { gap: space.md, paddingBottom: space.xs },
});
