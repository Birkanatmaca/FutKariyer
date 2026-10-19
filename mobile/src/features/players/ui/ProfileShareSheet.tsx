import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space, type } from '../../../styles/tokens';
import type { PlayerProfile } from '../domain/profile';
import type { ProfileSharer, ShareTarget } from '../application/profile-share';
import type { ProfileCounts } from './PlayerProfileHeader';
import { ProfileShareCard, SHARE_CARD } from './ProfileShareCard';
import { ShareTargetIcon } from './ShareTargetIcon';

const labels: Record<ShareTarget, string> = {
  instagramStory: copy.profileShare.instagramStory,
  whatsapp: copy.profileShare.whatsapp,
  more: copy.profileShare.more,
};

// Bottom sheet with a live preview of the 9:16 profile card and one row of
// share targets. The card is drawn full size and scaled down for the
// preview, so the captured image keeps its full resolution.
export function ProfileShareSheet({
  visible,
  onClose,
  sharer,
  fullName,
  profile,
  counts,
  avatarUri,
  isPro,
}: {
  visible: boolean;
  onClose(): void;
  sharer: ProfileSharer;
  fullName: string;
  profile: PlayerProfile;
  counts?: ProfileCounts | null;
  avatarUri?: string;
  isPro?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const card = useRef<View>(null);
  const [busy, setBusy] = useState<ShareTarget | null>(null);
  const [error, setError] = useState('');
  const scale = Math.max(
    0.4,
    Math.min(0.62, (window.height - 340 - insets.bottom) / SHARE_CARD.height),
  );
  const close = () => {
    if (busy) return;
    setError('');
    onClose();
  };
  async function share(target: ShareTarget) {
    if (busy) return;
    setBusy(target);
    setError('');
    try {
      const outcome = await sharer.share(
        card,
        target,
        copy.profileShare.message(fullName),
        colors.bg,
      );
      if (outcome === 'unavailable')
        setError(copy.profileShare.unavailable(labels[target]));
      else if (outcome === 'shared') onClose();
    } catch {
      setError(copy.profileShare.failed);
    } finally {
      setBusy(null);
    }
  }
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={close}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copy.profileShare.close}
        onPress={close}
        style={styles.scrim}
      />
      <View
        style={[
          styles.sheet,
          { paddingBottom: Math.max(insets.bottom, space.xl) + space.lg },
        ]}
      >
        <View style={styles.handle} />
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text accessibilityRole="header" style={styles.title}>
              {copy.profileShare.title}
            </Text>
            <Text style={styles.hint}>{copy.profileShare.hint}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.profileShare.close}
            onPress={close}
            hitSlop={8}
            style={styles.close}
          >
            <X size={20} color={colors.text} />
          </Pressable>
        </View>
        <View
          accessible
          accessibilityLabel={copy.profileShare.preview}
          style={[
            styles.preview,
            {
              width: SHARE_CARD.width * scale,
              height: SHARE_CARD.height * scale,
            },
          ]}
        >
          <View
            style={{
              width: SHARE_CARD.width,
              height: SHARE_CARD.height,
              transform: [{ scale }],
              marginLeft: (-SHARE_CARD.width * (1 - scale)) / 2,
              marginTop: (-SHARE_CARD.height * (1 - scale)) / 2,
            }}
          >
            <ProfileShareCard
              ref={card}
              fullName={fullName}
              profile={profile}
              counts={counts}
              avatarUri={avatarUri}
              isPro={isPro}
            />
          </View>
        </View>
        <View style={styles.targets}>
          {sharer.targets.map(target => (
            <Pressable
              key={target}
              accessibilityRole="button"
              accessibilityLabel={labels[target]}
              accessibilityState={{ busy: busy === target, disabled: !!busy }}
              disabled={!!busy}
              onPress={() => share(target)}
              style={({ pressed }) => [
                styles.target,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.targetIcon}>
                {busy === target ? (
                  <ActivityIndicator
                    color={colors.brand}
                    accessibilityLabel={copy.profileShare.preparing}
                  />
                ) : (
                  <ShareTargetIcon target={target} size={44} />
                )}
              </View>
              <Text numberOfLines={1} style={styles.targetLabel}>
                {labels[target]}
              </Text>
            </Pressable>
          ))}
        </View>
        {error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        ) : null}
      </View>
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
    alignItems: 'center',
    gap: space.lg,
    paddingTop: space.sm,
    paddingHorizontal: space.xl,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  header: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
  },
  headerText: { flex: 1, gap: 2 },
  title: { ...type.headline, color: colors.text },
  hint: { ...type.caption, color: colors.secondary },
  close: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.raised,
  },
  preview: {
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  targets: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'space-evenly',
  },
  target: { width: 96, alignItems: 'center', gap: space.sm },
  targetIcon: {
    width: 60,
    height: 60,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  targetLabel: { ...type.caption, color: colors.text, fontWeight: '600' },
  pressed: { opacity: 0.75 },
  error: { ...type.caption, color: colors.danger, textAlign: 'center' },
});
