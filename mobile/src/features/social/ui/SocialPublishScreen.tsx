import React, { useEffect, useRef, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  useNavigation,
  usePreventRemove,
  type NavigationAction,
} from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Globe2, ImagePlus, Video, X } from 'lucide-react-native';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space } from '../../../styles/tokens';
import { maxPostLength, type SelectedMedia } from '../domain/models';
import type { SocialService } from '../application/social-service';
import { VideoPlayer } from '../../../shared/ui/VideoPlayer';

export function SocialPublishScreen({
  token,
  name,
  service,
  onBack,
  onPublished,
  profileOption = false,
}: {
  token: string;
  name: string;
  service: SocialService;
  onBack(): void;
  onPublished(): void;
  // Players can also list a post's photo or video in their profile tabs.
  profileOption?: boolean;
}) {
  const navigation = useNavigation();
  const [body, setBody] = useState('');
  const [media, setMedia] = useState<SelectedMedia | null>(null);
  const [showOnProfile, setShowOnProfile] = useState(false);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState('');
  const [previewError, setPreviewError] = useState(false);
  const [pending, setPending] = useState<NavigationAction | null>(null);
  const selected = useRef<SelectedMedia | null>(null);
  const alive = useRef(true);
  const published = useRef(false);
  const locked = useRef(false);
  const count = Array.from(body.trim()).length;
  const dirty = !!body.trim() || !!media;
  usePreventRemove(dirty || busy || picking, ({ data }) => {
    if (published.current) {
      navigation.dispatch(data.action);
      return;
    }
    if (!locked.current) setPending(data.action);
  });
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (selected.current) service.releaseMedia(selected.current);
    };
  }, [service]);
  function changeMedia(value: SelectedMedia | null) {
    if (selected.current) service.releaseMedia(selected.current);
    selected.current = value;
    setMedia(value);
    setPreviewError(false);
  }
  async function choose(kind: 'image' | 'video') {
    if (locked.current) return;
    locked.current = true;
    setPicking(true);
    setError('');
    try {
      const value = await service.pickMedia(kind);
      if (!alive.current) {
        if (value) service.releaseMedia(value);
        return;
      }
      if (value) changeMedia(value);
    } catch (failure) {
      if (alive.current)
        setError(
          failure instanceof Error ? failure.message : copy.form.unexpected,
        );
    } finally {
      locked.current = false;
      if (alive.current) setPicking(false);
    }
  }
  async function publish() {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError('');
    try {
      await service.createPost(
        token,
        body,
        media || undefined,
        profileOption && showOnProfile,
      );
      published.current = true;
      if (alive.current) onPublished();
    } catch (failure) {
      if (alive.current)
        setError(
          failure instanceof Error ? failure.message : copy.form.unexpected,
        );
    } finally {
      locked.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.safe}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <View style={styles.header}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={copy.social.back}
              disabled={busy || picking}
              onPress={onBack}
              style={styles.back}
            >
              <ArrowLeft size={22} color={colors.text} />
            </Pressable>
            <Text style={styles.title}>{copy.social.composeTitle}</Text>
          </View>
          <View style={styles.identity}>
            <View style={styles.avatar}>
              <Text style={styles.initials}>
                {Array.from(name.trim())[0]?.toLocaleUpperCase('tr-TR')}
              </Text>
            </View>
            <View style={styles.identityText}>
              <Text style={styles.name}>{name}</Text>
              <View style={styles.audience}>
                <Globe2 size={13} color={colors.muted} />
                <Text style={styles.caption}>{copy.social.audience}</Text>
              </View>
            </View>
          </View>
          {error ? <ErrorBanner message={error} /> : null}
          <TextInput
            accessibilityLabel={copy.social.placeholder}
            placeholder={copy.social.placeholder}
            placeholderTextColor={colors.muted}
            multiline
            maxLength={maxPostLength * 2}
            value={body}
            editable={!busy && !picking}
            onChangeText={setBody}
            style={styles.input}
            textAlignVertical="top"
          />
          <View style={styles.counterRow}>
            <Text style={styles.hint}>{copy.social.textHint}</Text>
            <Text
              style={[styles.counter, count > maxPostLength && styles.invalid]}
            >
              {count}/{maxPostLength}
            </Text>
          </View>
          {media ? (
            <View style={styles.media}>
              <View style={styles.mediaHeader}>
                <Text numberOfLines={1} style={styles.file}>
                  {media.name}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={copy.social.removeMedia}
                  disabled={busy || picking}
                  onPress={() => changeMedia(null)}
                  style={styles.back}
                >
                  <X size={19} color={colors.secondary} />
                </Pressable>
              </View>
              {previewError ? (
                <Text style={styles.mediaError}>{copy.social.mediaFailed}</Text>
              ) : media.kind === 'image' ? (
                <Image
                  source={{ uri: media.uri }}
                  accessibilityLabel={copy.social.imagePreview}
                  resizeMode="contain"
                  onError={() => setPreviewError(true)}
                  style={styles.image}
                />
              ) : (
                <VideoPlayer
                  source={{ uri: media.uri }}
                  onError={() => setPreviewError(true)}
                />
              )}
              <Text style={styles.mediaHint}>
                {media.kind === 'image'
                  ? copy.social.imageHint
                  : copy.social.videoHint}
              </Text>
            </View>
          ) : null}
          {media && profileOption ? (
            <View style={styles.profileRow}>
              <View style={styles.profileText}>
                <Text style={styles.profileTitle}>
                  {copy.social.showOnProfile}
                </Text>
                <Text style={styles.hint}>
                  {media.kind === 'image'
                    ? copy.social.showOnProfileImage
                    : copy.social.showOnProfileVideo}
                </Text>
              </View>
              <Switch
                accessibilityLabel={copy.social.showOnProfile}
                value={showOnProfile}
                disabled={busy || picking}
                onValueChange={setShowOnProfile}
                trackColor={{ false: colors.overlay, true: colors.brand }}
                thumbColor={colors.text}
              />
            </View>
          ) : null}
          <View style={styles.tools}>
            <Pressable
              accessibilityRole="button"
              disabled={busy || picking}
              accessibilityState={{ disabled: busy || picking }}
              onPress={() => choose('image')}
              style={styles.tool}
            >
              <ImagePlus size={22} color={colors.brand} />
              <Text style={styles.toolText}>{copy.social.addImage}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={busy || picking}
              accessibilityState={{ disabled: busy || picking }}
              onPress={() => choose('video')}
              style={styles.tool}
            >
              <Video size={22} color={colors.brand} />
              <Text style={styles.toolText}>{copy.social.addVideo}</Text>
            </Pressable>
          </View>
          <Button
            label={copy.social.publish}
            loading={busy}
            disabled={picking || !dirty || count > maxPostLength}
            onPress={() => publish()}
          />
          {busy ? (
            <Text accessibilityRole="alert" style={styles.caption}>
              {copy.social.uploading}
            </Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
      <Modal
        visible={!!pending}
        transparent
        animationType="fade"
        onRequestClose={() => setPending(null)}
      >
        <View style={styles.scrim}>
          <View accessibilityViewIsModal style={styles.dialog}>
            <Text style={styles.title}>{copy.social.draftTitle}</Text>
            <Text style={styles.hint}>{copy.social.draftBody}</Text>
            <Button
              label={copy.social.keepEditing}
              onPress={() => setPending(null)}
            />
            <Button
              secondary
              label={copy.social.discard}
              onPress={() => {
                if (pending) navigation.dispatch(pending);
                setPending(null);
              }}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    padding: space.xl,
    paddingBottom: 150,
    gap: space.lg,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  profileText: { flex: 1, gap: space.xs },
  profileTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  back: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: colors.text, fontSize: 21, fontWeight: '800', flexShrink: 1 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  identityText: { flex: 1, gap: space.xs },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { color: colors.text, fontSize: 17, fontWeight: '800' },
  name: { color: colors.text, fontSize: 15, fontWeight: '700' },
  audience: { flexDirection: 'row', gap: space.xs, alignItems: 'center' },
  caption: { color: colors.muted, fontSize: 11 },
  input: {
    minHeight: 150,
    color: colors.text,
    fontSize: 17,
    lineHeight: 26,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  counterRow: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  hint: {
    color: colors.secondary,
    fontSize: 12,
    lineHeight: 19,
    flexShrink: 1,
  },
  counter: { color: colors.muted, fontSize: 12 },
  invalid: { color: colors.danger },
  media: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  mediaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: space.md,
  },
  file: { flex: 1, color: colors.secondary, fontSize: 12 },
  image: { width: '100%', aspectRatio: 4 / 3 },
  mediaHint: { color: colors.muted, fontSize: 11, padding: space.md },
  mediaError: { color: colors.danger, fontSize: 12, padding: space.lg },
  tools: { flexDirection: 'row', gap: space.md },
  tool: {
    flex: 1,
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  toolText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  scrim: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    padding: space.xl,
  },
  dialog: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: space.xl,
    gap: space.lg,
  },
});
