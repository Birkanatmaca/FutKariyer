import React, { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  ChevronDown,
  ExternalLink,
  File,
  FileImage,
  FileSpreadsheet,
  FileText,
  Gavel,
  Inbox,
  LayoutList,
  Megaphone,
  type LucideIcon,
} from 'lucide-react-native';
import { copy } from '../../../shared/lib/copy';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { colors, radius, space, type } from '../../../styles/tokens';
import type { FootballError } from '../application/useFootballResource';
import type {
  AnkaraAttachment,
  AnkaraAttachmentType,
  AnkaraPost,
  AnkaraPostKind,
} from '../domain/models';
import {
  filterAnkaraPosts,
  isAnkaraLink,
  postAgeDays,
  turkeyToday,
  type AnkaraPostFilter,
} from '../domain/rules';
import { Chip, ChipRow } from './AnkaraChips';
import { ErrorBlock, LoadingBlock } from './FootballStates';

const text = copy.footballData;
const filters: AnkaraPostFilter[] = ['all', 'discipline', 'bulletin', 'news'];
const kindIcon: Record<AnkaraPostFilter, LucideIcon> = {
  all: LayoutList,
  discipline: Gavel,
  bulletin: FileSpreadsheet,
  news: Megaphone,
};
const kindTone: Record<AnkaraPostKind, string> = {
  discipline: colors.warning,
  bulletin: colors.info,
  news: colors.brand,
};
const fileIcon: Record<AnkaraAttachmentType, LucideIcon> = {
  pdf: FileText,
  excel: FileSpreadsheet,
  word: File,
  image: FileImage,
};

// Validation already drops foreign links; the check is repeated right before
// leaving the app so nothing else is ever opened.
export function openAnkaraLink(url: string) {
  if (!isAnkaraLink(url)) return;
  Linking.openURL(url).catch(() => undefined);
}

// "Bugün", "Dün", "3 gün önce", else "8 Eki" (with the year when it differs).
export function postDateLabel(date: string, now: Date) {
  const age = postAgeDays(date, now);
  if (age === null) return '';
  if (age === 0) return text.today;
  if (age === 1) return text.yesterday;
  if (age < 7) return text.daysAgo(age);
  const [year, month, day] = date.slice(0, 10).split('-').map(Number);
  const label = day + ' ' + text.monthsShort[month - 1];
  return String(year) === turkeyToday(now).slice(0, 4)
    ? label
    : label + ' ' + year;
}

export function AnkaraPostsTab({
  items,
  error,
  loading,
  retry,
  hasMore,
  loadingMore,
  moreError,
  loadMore,
  now = new Date(),
}: {
  items: AnkaraPost[];
  error: FootballError | null;
  loading: boolean;
  retry(): void;
  hasMore: boolean;
  loadingMore: boolean;
  moreError: FootballError | null;
  loadMore(): void;
  now?: Date;
}) {
  const [kind, setKind] = useState<AnkaraPostFilter>('all');
  if (loading && !items.length) return <LoadingBlock />;
  if (error) return <ErrorBlock error={error} onRetry={retry} />;
  const shown = filterAnkaraPosts(items, kind);
  return (
    <>
      <ChipRow>
        {filters.map(value => (
          <Chip
            key={value}
            label={text.postKinds[value]}
            icon={kindIcon[value]}
            tone={value === 'all' ? undefined : kindTone[value]}
            selected={kind === value}
            onPress={() => setKind(value)}
          />
        ))}
      </ChipRow>
      {shown.length ? (
        <View style={styles.list}>
          {shown.map(post => (
            <PostCard key={post.id} post={post} now={now} />
          ))}
        </View>
      ) : hasMore ? null : (
        <EmptyState icon={Inbox} title={text.postsEmpty} />
      )}
      {moreError ? <ErrorBanner message={moreError.message} /> : null}
      {hasMore ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ busy: loadingMore, disabled: loadingMore }}
          disabled={loadingMore}
          onPress={loadMore}
          style={({ pressed }) => [styles.more, pressed && styles.pressed]}
        >
          {loadingMore ? (
            <ActivityIndicator color={colors.brand} />
          ) : (
            <ChevronDown size={18} color={colors.brand} />
          )}
          <Text style={styles.moreText}>{text.loadMore}</Text>
        </Pressable>
      ) : null}
    </>
  );
}

function PostCard({ post, now }: { post: AnkaraPost; now: Date }) {
  const Icon = kindIcon[post.kind];
  const tone = kindTone[post.kind];
  const date = postDateLabel(post.date, now);
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={[text.postKinds[post.kind], post.title, date]
        .filter(Boolean)
        .join(', ')}
      accessibilityHint={text.openPostHint}
      onPress={() => openAnkaraLink(post.url)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.cardHead}>
        <View style={[styles.kind, { borderColor: tone }]}>
          <Icon size={18} color={tone} />
        </View>
        <View style={styles.cardBody}>
          <Text numberOfLines={3} style={styles.title}>
            {post.title}
          </Text>
          <View style={styles.meta}>
            <Text style={styles.date}>{date}</Text>
            <ExternalLink size={13} color={colors.muted} />
          </View>
        </View>
      </View>
      {post.attachments.length ? (
        <View style={styles.files}>
          {post.attachments.map((file, index) => (
            <AttachmentButton key={file.url + index} file={file} />
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

function AttachmentButton({ file }: { file: AnkaraAttachment }) {
  const Icon = fileIcon[file.type];
  const name = file.name || text.attachmentTypes[file.type];
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={text.openAttachment(name)}
      accessibilityHint={text.attachmentTypes[file.type]}
      onPress={() => openAnkaraLink(file.url)}
      style={({ pressed }) => [styles.file, pressed && styles.pressed]}
    >
      <Icon size={15} color={colors.brand} />
      <Text numberOfLines={1} style={styles.fileName}>
        {name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.md },
  card: {
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  pressed: { opacity: 0.85 },
  cardHead: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  kind: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: colors.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, minWidth: 0, gap: space.xs + 2 },
  title: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700',
  },
  meta: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  date: { ...type.caption, color: colors.muted },
  files: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  file: {
    maxWidth: '100%',
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.brandSoft,
  },
  fileName: {
    flexShrink: 1,
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  more: {
    minHeight: 48,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  moreText: { color: colors.text, fontSize: 13, fontWeight: '800' },
});
