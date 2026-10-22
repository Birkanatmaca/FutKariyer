import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Camera,
  Film,
  Grid3X3,
  ImageOff,
  Newspaper,
  Play,
  Plus,
  Trash2,
  X,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { VideoPlayer } from '../../../shared/ui/VideoPlayer';
import { copy } from '../../../shared/lib/copy';
import type { MediaKind, MediaSource } from '../../../shared/domain/media';
import { colors, radius, space, type } from '../../../styles/tokens';
import type { PlayerMediaService } from '../application/media-service';
import { usePlayerGallery } from '../application/usePlayerGallery';
import type { PlayerMediaItem } from '../domain/media';

type Tab = 'posts' | 'photos' | 'videos';
type MediaTab = Exclude<Tab, 'posts'>;

// Posts slot filled by the app shell: the Gönderiler tab content and the
// post photos/videos the owner chose to show on the profile.
export type ProfilePostsSlot = {
  postsTab: React.ReactNode;
  media: { id: string; kind: MediaKind; createdAt: string }[];
  renderMedia(item: { id: string; kind: MediaKind }): React.ReactNode;
  onOpenMedia(id: string): void;
};
const text = copy.playerOverview;

export type GalleryProps = {
  token: string;
  ownerId: string;
  service: PlayerMediaService;
  // The owner can add and delete items.
  editable?: boolean;
};

// Instagram-like gallery: Fotoğraflar then Videolar, three square tiles a row.
// Without gallery props (no session) it shows the empty state only.
export function PlayerMediaGallery({
  posts,
  ...props
}: Partial<GalleryProps> & { posts?: ProfilePostsSlot }) {
  return props.token && props.ownerId && props.service ? (
    <LoadedGallery {...(props as GalleryProps)} posts={posts} />
  ) : posts ? (
    <PostsGallery posts={posts} />
  ) : (
    <GalleryFrame selected="photos" onSelect={() => {}}>
      <Empty tab="photos" />
    </GalleryFrame>
  );
}

// Someone whose gallery the viewer cannot open (a club, a coach, a player
// hidden from discovery): the same tabs, filled from their posts only.
function PostsGallery({ posts }: { posts: ProfilePostsSlot }) {
  const [selected, setSelected] = useState<Tab>('posts');
  if (selected === 'posts')
    return (
      <GalleryFrame selected={selected} onSelect={setSelected} withPosts>
        {posts.postsTab}
      </GalleryFrame>
    );
  const tab: MediaTab = selected === 'videos' ? 'videos' : 'photos';
  const kind = tab === 'photos' ? 'image' : 'video';
  const tiles = posts.media.filter(item => item.kind === kind);
  return (
    <GalleryFrame selected={tab} onSelect={setSelected} withPosts>
      {tiles.length ? (
        <View style={styles.grid}>
          {tiles.map(tile => (
            <Pressable
              key={'post' + tile.id}
              accessibilityRole="button"
              accessibilityLabel={text.openPost}
              onPress={() => posts.onOpenMedia(tile.id)}
              style={styles.tile}
            >
              {posts.renderMedia(tile)}
            </Pressable>
          ))}
        </View>
      ) : (
        <Empty tab={tab} />
      )}
    </GalleryFrame>
  );
}

function LoadedGallery({
  token,
  ownerId,
  service,
  editable,
  posts,
}: GalleryProps & { posts?: ProfilePostsSlot }) {
  const gallery = usePlayerGallery(service, token, ownerId);
  const [selected, setSelected] = useState<Tab>(posts ? 'posts' : 'photos');
  const [open, setOpen] = useState<PlayerMediaItem | null>(null);
  if (selected === 'posts' && posts)
    return (
      <GalleryFrame selected={selected} onSelect={setSelected} withPosts>
        {posts.postsTab}
      </GalleryFrame>
    );
  const tab: MediaTab = selected === 'videos' ? 'videos' : 'photos';
  const kind = tab === 'photos' ? 'image' : 'video';
  const items = gallery.items.filter(item => item.kind === kind);
  // Uploaded gallery items and shared post media, newest first.
  const tiles = [
    ...items.map(item => ({ upload: item, createdAt: item.createdAt })),
    ...(posts?.media ?? [])
      .filter(item => item.kind === kind)
      .map(item => ({ post: item, createdAt: item.createdAt })),
  ].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const limit = gallery.limits?.[tab];
  const full = limit !== undefined && items.length >= limit;
  return (
    <GalleryFrame selected={tab} onSelect={setSelected} withPosts={!!posts}>
      {editable ? (
        <View style={styles.toolbar}>
          <Text style={[styles.count, type.number]}>
            {limit !== undefined ? items.length + ' / ' + limit : ''}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{
              disabled: full || !!gallery.busy,
              busy: gallery.busy === kind,
            }}
            disabled={full || !!gallery.busy}
            onPress={() => gallery.add(kind)}
            style={[styles.add, (full || !!gallery.busy) && styles.disabled]}
          >
            {gallery.busy === kind ? (
              <ActivityIndicator color={colors.brandInk} size="small" />
            ) : (
              <Plus size={16} color={colors.brandInk} />
            )}
            <Text style={styles.addText}>
              {gallery.busy === kind
                ? text.uploading
                : tab === 'photos'
                ? text.addPhoto
                : text.addVideo}
            </Text>
          </Pressable>
        </View>
      ) : null}
      {editable && full ? (
        <Text style={styles.hint}>{text.galleryFull}</Text>
      ) : null}
      {gallery.actionError ? (
        <View style={styles.padded}>
          <ErrorBanner message={gallery.actionError} />
        </View>
      ) : null}
      {gallery.loading ? (
        <ActivityIndicator color={colors.brand} style={styles.loader} />
      ) : gallery.error ? (
        <View style={styles.padded}>
          <ErrorBanner message={gallery.error} />
          <Button label={copy.form.retry} secondary onPress={gallery.retry} />
        </View>
      ) : tiles.length ? (
        <View style={styles.grid}>
          {tiles.map(tile =>
            'upload' in tile && tile.upload ? (
              <Tile
                key={tile.upload.id}
                item={tile.upload}
                token={token}
                service={service}
                onOpen={() => setOpen(tile.upload)}
              />
            ) : 'post' in tile && tile.post && posts ? (
              <Pressable
                key={'post' + tile.post.id}
                accessibilityRole="button"
                accessibilityLabel={text.openPost}
                onPress={() => posts.onOpenMedia(tile.post.id)}
                style={styles.tile}
              >
                {posts.renderMedia(tile.post)}
              </Pressable>
            ) : null,
          )}
        </View>
      ) : (
        <Empty tab={tab} />
      )}
      <Viewer
        item={open}
        token={token}
        service={service}
        deleting={!!open && gallery.busy === open.id}
        onDelete={
          editable && open
            ? async () => {
                if (await gallery.remove(open.id)) setOpen(null);
              }
            : undefined
        }
        onClose={() => setOpen(null)}
      />
    </GalleryFrame>
  );
}

function GalleryFrame({
  selected,
  onSelect,
  children,
  withPosts = false,
}: {
  selected: Tab;
  onSelect(tab: Tab): void;
  children: React.ReactNode;
  withPosts?: boolean;
}) {
  const tabs: Tab[] = withPosts
    ? ['posts', 'photos', 'videos']
    : ['photos', 'videos'];
  return (
    <View style={styles.gallery}>
      <View accessibilityRole="tablist" style={styles.tabs}>
        {tabs.map(tab => {
          const Icon =
            tab === 'posts' ? Newspaper : tab === 'photos' ? Grid3X3 : Film;
          const active = selected === tab;
          return (
            <Pressable
              key={tab}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => onSelect(tab)}
              style={[styles.tab, active && styles.activeTab]}
            >
              <Icon size={20} color={active ? colors.text : colors.muted} />
              <Text style={[styles.tabLabel, active && styles.activeLabel]}>
                {text[tab]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {children}
    </View>
  );
}

function Empty({ tab }: { tab: MediaTab }) {
  const Icon = tab === 'photos' ? Camera : Film;
  return (
    <View accessibilityLiveRegion="polite" style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon size={29} color={colors.secondary} />
      </View>
      <Text style={styles.emptyTitle}>
        {tab === 'photos' ? text.noPhotos : text.noVideos}
      </Text>
      <Text style={styles.emptyBody}>
        {tab === 'photos' ? text.photosHint : text.videosHint}
      </Text>
    </View>
  );
}

// Loads an authorised media source and releases it on unmount.
function useMediaSource(
  service: PlayerMediaService,
  token: string,
  item: PlayerMediaItem | null,
) {
  const [source, setSource] = useState<MediaSource | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let current = true;
    let loaded: MediaSource | undefined;
    setSource(null);
    setFailed(false);
    if (item)
      service
        .source(token, item)
        .then(value => {
          if (!current) return value.dispose?.();
          loaded = value;
          setSource(value);
        })
        .catch(() => current && setFailed(true));
    return () => {
      current = false;
      loaded?.dispose?.();
    };
  }, [service, token, item]);
  return { source, failed, fail: () => setFailed(true) };
}

function Tile({
  item,
  token,
  service,
  onOpen,
}: {
  item: PlayerMediaItem;
  token: string;
  service: PlayerMediaService;
  onOpen(): void;
}) {
  const video = item.kind === 'video';
  // Videos are not prefetched; the tile shows a play mark until opened.
  const media = useMediaSource(service, token, video ? null : item);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={video ? text.openVideo : text.openPhoto}
      onPress={onOpen}
      style={styles.tile}
    >
      <View style={styles.thumbnail}>
        {video ? (
          <View style={styles.play}>
            <Play size={18} color={colors.brandInk} fill={colors.brandInk} />
          </View>
        ) : media.failed ? (
          <ImageOff color={colors.muted} size={24} />
        ) : media.source ? (
          <Image
            source={media.source}
            onError={media.fail}
            resizeMode="cover"
            style={styles.image}
          />
        ) : (
          <ActivityIndicator color={colors.muted} />
        )}
      </View>
    </Pressable>
  );
}

function Viewer({
  item,
  token,
  service,
  deleting,
  onDelete,
  onClose,
}: {
  item: PlayerMediaItem | null;
  token: string;
  service: PlayerMediaService;
  deleting: boolean;
  onDelete?: () => void;
  onClose(): void;
}) {
  const media = useMediaSource(service, token, item);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => setConfirming(false), [item]);
  if (!item) return null;
  return (
    <Modal visible animationType="fade" onRequestClose={onClose}>
      <SafeAreaView style={styles.viewer}>
        <View style={styles.viewerTop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={text.closeMedia}
            onPress={onClose}
            style={styles.iconButton}
          >
            <X size={20} color={colors.text} />
          </Pressable>
          {onDelete ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                confirming ? text.confirmDelete : text.deleteMedia
              }
              accessibilityState={{ busy: deleting, disabled: deleting }}
              disabled={deleting}
              onPress={() => (confirming ? onDelete() : setConfirming(true))}
              style={[styles.deleteButton, confirming && styles.deleteConfirm]}
            >
              {deleting ? (
                <ActivityIndicator color={colors.danger} size="small" />
              ) : (
                <Trash2 size={18} color={colors.danger} />
              )}
              <Text style={styles.deleteText}>
                {confirming ? text.confirmDelete : text.deleteMedia}
              </Text>
            </Pressable>
          ) : null}
        </View>
        <View style={styles.stage}>
          {media.failed ? (
            <View style={styles.stageMessage}>
              <ImageOff color={colors.muted} size={32} />
              <Text style={styles.emptyBody}>{text.mediaFailed}</Text>
            </View>
          ) : !media.source ? (
            <ActivityIndicator color={colors.brand} />
          ) : item.kind === 'image' ? (
            <Image
              source={media.source}
              accessibilityLabel={text.openPhoto}
              resizeMode="contain"
              onError={media.fail}
              style={styles.full}
            />
          ) : (
            <VideoPlayer source={media.source} onError={media.fail} autoPlay />
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  gallery: { marginHorizontal: -space.xl },
  tabs: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  tab: {
    flex: 1,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    borderBottomWidth: 2,
    borderBottomColor: colors.transparent,
  },
  activeTab: { borderBottomColor: colors.brand },
  tabLabel: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  activeLabel: { color: colors.text },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
  },
  count: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  add: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
  },
  addText: { color: colors.brandInk, fontSize: 13, fontWeight: '800' },
  disabled: { opacity: 0.45 },
  hint: {
    color: colors.muted,
    fontSize: 12,
    paddingHorizontal: space.xl,
    paddingBottom: space.sm,
  },
  padded: { paddingHorizontal: space.xl, gap: space.md },
  loader: { paddingVertical: space.xxl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingTop: 2 },
  tile: { width: '33.333333%', aspectRatio: 1, padding: 1 },
  thumbnail: {
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
  play: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    paddingHorizontal: space.xxl,
    paddingVertical: space.xxxl,
    alignItems: 'center',
    gap: space.md,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyBody: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 21,
    textAlign: 'center',
    maxWidth: 280,
  },
  viewer: { flex: 1, backgroundColor: colors.bg },
  viewerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: space.lg,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  deleteButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  deleteConfirm: { backgroundColor: colors.dangerWash },
  deleteText: { color: colors.danger, fontSize: 13, fontWeight: '700' },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  stageMessage: { alignItems: 'center', gap: space.md },
  full: { width: '100%', height: '100%' },
});
