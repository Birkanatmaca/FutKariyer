import React, { useEffect, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space } from '../../../styles/tokens';
import type { ContentService } from '../application/content-service';
import { popupFormats, type PopupAd } from '../domain/models';

const text = copy.popupAd;

// Asks once, when the signed-in app starts, whether a popup ad is due for
// this account. It opens only after its image has loaded, and is counted as
// shown at that moment; how often and how many times is the server's call.
export function LaunchPopup({
  token,
  service,
  enabled = true,
}: {
  token: string | null;
  service: ContentService;
  // Off while a coach runs a club account.
  enabled?: boolean;
}) {
  const [popup, setPopup] = useState<PopupAd | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!token || !enabled) return;
    let current = true;
    service
      .popup(token)
      .then(async value => {
        if (!value || !current) return;
        const loaded = await Image.prefetch(service.imageUrl(value.imageId));
        if (!loaded || !current) return;
        setPopup(value);
        setOpen(true);
        service.popupViewed(token, value.id).catch(() => undefined);
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [service, token, enabled]);
  if (!popup) return null;
  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => setOpen(false)}
    >
      {popup.format === 'story' ? (
        <Story popup={popup} service={service} onClose={() => setOpen(false)} />
      ) : (
        <Card popup={popup} service={service} onClose={() => setOpen(false)} />
      )}
    </Modal>
  );
}

type Props = { popup: PopupAd; service: ContentService; onClose(): void };

function Close({ onClose, style }: { onClose(): void; style?: object }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={text.close}
      onPress={onClose}
      hitSlop={10}
      style={({ pressed }) => [styles.close, style, pressed && styles.pressed]}
    >
      <X size={20} color={colors.text} strokeWidth={2.4} />
    </Pressable>
  );
}

// Square and portrait popups: a card in the middle of a dimmed screen.
function Card({ popup, service, onClose }: Props) {
  const { width, height } = useWindowDimensions();
  const size = popupFormats[popup.format];
  const ratio = size.height / size.width;
  const cardWidth = Math.min(
    width - space.xl * 2,
    420,
    (height * 0.72) / ratio,
  );
  return (
    <View style={styles.centre}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={text.close}
        onPress={onClose}
        style={StyleSheet.absoluteFill}
      />
      <View style={{ width: cardWidth }}>
        <Close onClose={onClose} style={styles.cardClose} />
        <View
          style={[styles.card, { width: cardWidth, height: cardWidth * ratio }]}
        >
          <Image
            source={{ uri: service.imageUrl(popup.imageId) }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            accessibilityLabel={text.label}
          />
          <Text style={styles.tag}>{copy.home.adTag}</Text>
        </View>
      </View>
    </View>
  );
}

// Story popups fill the screen like a story, with the close button on top.
function Story({ popup, service, onClose }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.story}>
      <Image
        source={{ uri: service.imageUrl(popup.imageId) }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        accessibilityLabel={text.label}
      />
      <Text style={[styles.tag, { top: insets.top + space.lg }]}>
        {copy.home.adTag}
      </Text>
      <Close
        onClose={onClose}
        style={[styles.storyClose, { top: insets.top + space.md }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.scrim,
  },
  card: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  close: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  cardClose: { alignSelf: 'flex-end', marginBottom: space.sm },
  pressed: { opacity: 0.8 },
  tag: {
    position: 'absolute',
    top: space.md,
    left: space.md,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    overflow: 'hidden',
    backgroundColor: colors.scrim,
    color: colors.text,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  story: { flex: 1, backgroundColor: colors.bg },
  storyClose: { position: 'absolute', right: space.lg },
});
