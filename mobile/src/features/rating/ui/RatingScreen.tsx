import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  ArrowLeft,
  Check,
  Flame,
  Gamepad2,
  Goal,
  MessageSquarePlus,
  Shield,
  Target,
  UserPlus,
  type LucideIcon,
} from 'lucide-react-native';
import { useAuth } from '../../auth';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space, type } from '../../../styles/tokens';
import type {
  Prize,
  RatingBoard,
  RatingTask,
  TaskKind,
} from '../domain/models';
import { Countdown } from './Countdown';
import { RatingTrophy } from './RatingTrophy';

const taskIcons: Record<TaskKind, LucideIcon> = {
  play_games: Gamepad2,
  share_post: MessageSquarePlus,
  follow_accounts: UserPlus,
  h2h_streak: Flame,
};
const howIcons: LucideIcon[] = [Shield, Goal, Target];
const medals = ['🥇', '🥈', '🥉'];

// Full global rating page: hero countdown, the top-three prizes as a podium,
// how points are earned, tasks and the leaderboard.
export function RatingScreen({
  board,
  loading,
  error,
  remaining,
  claiming,
  onClaim,
  onReload,
  onBack,
}: {
  board: RatingBoard | null;
  loading: boolean;
  error: string;
  remaining: number;
  claiming: TaskKind | null;
  onClaim(kind: TaskKind): void;
  onReload(): void;
  onBack(): void;
}) {
  const { user } = useAuth();
  const text = copy.rating;
  const season = board?.season ?? null;
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.content}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={text.back}
        onPress={onBack}
        style={styles.back}
      >
        <ArrowLeft size={19} color={colors.text} />
        <Text style={styles.backText}>{text.back}</Text>
      </Pressable>

      <View style={styles.hero}>
        <RatingTrophy size={180} />
        <Text style={styles.eyebrow}>{text.eyebrow}</Text>
        <Text accessibilityRole="header" style={styles.title}>
          {season ? season.title : text.noSeasonTitle}
        </Text>
        <Text style={styles.body}>
          {season?.description || (season ? text.pitch : text.noSeasonBody)}
        </Text>
        {season && season.status !== 'finished' ? (
          <View style={styles.timer}>
            <Text style={styles.timerLabel}>
              {season.status === 'upcoming' ? text.startsIn : text.endsIn}
            </Text>
            <Countdown seconds={remaining} large />
          </View>
        ) : season ? (
          <Text style={styles.finished}>{text.finished}</Text>
        ) : null}
      </View>

      {loading && !board ? <ActivityIndicator color={colors.brand} /> : null}
      <ErrorBanner message={error} />
      {error && !board ? (
        <Button label={copy.form.retry} onPress={onReload} />
      ) : null}

      {season && board?.me && season.status !== 'upcoming' ? (
        <View style={styles.meCard}>
          <View style={styles.meCell}>
            <Text style={styles.meLabel}>{text.rankLabel}</Text>
            <Text style={styles.meValue}>
              {board.me.rank ? '#' + board.me.rank : '—'}
            </Text>
          </View>
          <View style={[styles.meCell, styles.meDivider]}>
            <Text style={styles.meLabel}>{text.pointsLabel}</Text>
            <Text style={styles.meValue}>
              {board.me.points.toLocaleString('tr-TR')}
            </Text>
          </View>
        </View>
      ) : null}

      {season ? <Podium prizes={season.prizes} board={board} /> : null}

      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          {text.howTitle}
        </Text>
        {text.how.map((item, index) => {
          const Icon = howIcons[index];
          return (
            <View key={item.title} style={styles.howRow}>
              <View style={styles.howIcon}>
                <Icon size={18} color={colors.brand} />
              </View>
              <View style={styles.howBody}>
                <Text style={styles.howTitle}>{item.title}</Text>
                <Text style={styles.howText}>{item.body}</Text>
              </View>
              <Text style={styles.howPoints}>+1</Text>
            </View>
          );
        })}
        <Text style={styles.note}>{text.dailyPlays}</Text>
      </View>

      {board?.tasks.length ? (
        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            {text.tasksTitle}
          </Text>
          <Text style={styles.note}>{text.tasksHint}</Text>
          {board.tasks.map(task => (
            <TaskRow
              key={task.kind}
              task={task}
              running={season?.status === 'active'}
              busy={claiming === task.kind}
              onClaim={() => onClaim(task.kind)}
            />
          ))}
        </View>
      ) : null}

      {season && season.status !== 'upcoming' ? (
        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            {season.status === 'finished' ? text.winners : text.leaderboard}
          </Text>
          {board?.leaderboard.length ? (
            <View style={styles.board}>
              {board.leaderboard.map(row => {
                const me = row.userId === user?.id;
                return (
                  <View
                    key={row.userId}
                    style={[styles.boardRow, me && styles.boardMe]}
                  >
                    <Text style={styles.boardRank}>
                      {row.rank <= 3 ? medals[row.rank - 1] : row.rank}
                    </Text>
                    <View style={styles.boardName}>
                      <Text numberOfLines={1} style={styles.boardTitle}>
                        {row.fullName}
                        {me ? ' · ' + text.you : ''}
                      </Text>
                      <Text style={styles.boardRole}>
                        {copy.roles[row.role]}
                      </Text>
                    </View>
                    <Text style={styles.boardPoints}>
                      {row.points.toLocaleString('tr-TR')}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={styles.note}>{text.leaderboardEmpty}</Text>
          )}
        </View>
      ) : null}
    </ScrollView>
  );
}

// 2 · 1 · 3 podium; each step shows its prize and, once someone holds the
// place, the account's name.
function Podium({
  prizes,
  board,
}: {
  prizes: Prize[];
  board: RatingBoard | null;
}) {
  const text = copy.rating;
  const order = [2, 1, 3] as const;
  const heights = { 1: 112, 2: 84, 3: 64 };
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>
        {text.prizes}
      </Text>
      <View style={styles.podium}>
        {order.map(place => {
          const prize = prizes.find(p => p.place === place);
          const holder = board?.leaderboard.find(row => row.rank === place);
          return (
            <View
              key={place}
              style={styles.podiumColumn}
              accessible
              accessibilityLabel={text.prizeLabel(
                place,
                prize?.title ?? text.prizeSoon,
              )}
            >
              <Text style={styles.medal}>{medals[place - 1]}</Text>
              <Text numberOfLines={2} style={styles.prizeTitle}>
                {prize?.title ?? text.prizeSoon}
              </Text>
              {holder ? (
                <Text numberOfLines={1} style={styles.holder}>
                  {holder.fullName}
                </Text>
              ) : null}
              <View
                style={[
                  styles.step,
                  { height: heights[place] },
                  place === 1 && styles.stepFirst,
                ]}
              >
                <Text
                  style={[
                    styles.stepNumber,
                    place === 1 && styles.stepNumberFirst,
                  ]}
                >
                  {place}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function TaskRow({
  task,
  running,
  busy,
  onClaim,
}: {
  task: RatingTask;
  running: boolean;
  busy: boolean;
  onClaim(): void;
}) {
  const text = copy.rating;
  const Icon = taskIcons[task.kind];
  const done = task.progress >= task.target;
  const ratio = Math.min(1, task.progress / task.target);
  return (
    <View style={styles.task}>
      <View style={styles.taskIcon}>
        <Icon size={18} color={task.claimed ? colors.muted : colors.brand} />
      </View>
      <View style={styles.taskBody}>
        <View style={styles.taskTop}>
          <Text style={styles.taskTitle}>
            {text.taskTitles[task.kind](task.target)}
          </Text>
          <Text style={styles.taskPoints}>{text.taskPoints(task.points)}</Text>
        </View>
        <View style={styles.bar}>
          <View style={[styles.barFill, { width: `${ratio * 100}%` }]} />
        </View>
        <View style={styles.taskBottom}>
          <Text style={styles.taskProgress}>
            {text.progress(Math.min(task.progress, task.target), task.target)}
          </Text>
          {task.claimed ? (
            <View style={styles.claimed}>
              <Check size={13} color={colors.success} />
              <Text style={styles.claimedText}>{text.claimed}</Text>
            </View>
          ) : done && running ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                text.claim + ': ' + text.taskTitles[task.kind](task.target)
              }
              disabled={busy}
              onPress={onClaim}
              style={({ pressed }) => [styles.claim, pressed && styles.pressed]}
            >
              {busy ? (
                <ActivityIndicator size="small" color={colors.brandInk} />
              ) : (
                <Text style={styles.claimText}>{text.claim}</Text>
              )}
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: space.lg,
    paddingBottom: 180,
    gap: space.xl,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  back: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  backText: { color: colors.secondary, fontSize: 11, fontWeight: '700' },
  hero: { alignItems: 'center', gap: space.sm },
  eyebrow: {
    color: colors.brand,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 3,
  },
  title: {
    color: colors.text,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
    letterSpacing: -0.8,
    textAlign: 'center',
  },
  body: {
    color: colors.secondary,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  timer: { alignSelf: 'stretch', gap: space.sm, marginTop: space.md },
  timerLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  finished: { color: colors.warning, fontSize: 13, fontWeight: '800' },
  meCard: {
    flexDirection: 'row',
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.brandSoft,
    paddingVertical: space.lg,
  },
  meCell: { flex: 1, alignItems: 'center', gap: space.xs },
  meDivider: { borderLeftWidth: 1, borderLeftColor: colors.hairline },
  meLabel: { ...type.caption, color: colors.muted },
  meValue: { color: colors.text, fontSize: 26, fontWeight: '800' },
  section: { gap: space.md },
  sectionTitle: { color: colors.text, fontSize: 19, fontWeight: '800' },
  note: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  podium: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.sm,
  },
  podiumColumn: { flex: 1, alignItems: 'center', gap: space.xs },
  medal: { fontSize: 30 },
  prizeTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
    minHeight: 34,
  },
  holder: { color: colors.secondary, fontSize: 11, fontWeight: '600' },
  step: {
    alignSelf: 'stretch',
    marginTop: space.xs,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    paddingTop: space.sm,
  },
  stepFirst: { backgroundColor: colors.brandSoft, borderColor: colors.brand },
  stepNumber: { color: colors.secondary, fontSize: 22, fontWeight: '800' },
  stepNumberFirst: { color: colors.brand },
  howRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  howIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandWash,
  },
  howBody: { flex: 1, gap: 2 },
  howTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  howText: { color: colors.secondary, fontSize: 12 },
  howPoints: { color: colors.brand, fontSize: 16, fontWeight: '800' },
  task: {
    flexDirection: 'row',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  taskIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.raised,
  },
  taskBody: { flex: 1, gap: space.sm },
  taskTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  taskTitle: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '700' },
  taskPoints: { color: colors.brand, fontSize: 14, fontWeight: '800' },
  bar: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.raised,
    overflow: 'hidden',
  },
  barFill: { height: '100%', backgroundColor: colors.brand },
  taskBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 32,
  },
  taskProgress: {
    color: colors.muted,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  claimed: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  claimedText: { color: colors.success, fontSize: 12, fontWeight: '700' },
  claim: {
    minHeight: 32,
    minWidth: 88,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  claimText: { color: colors.brandInk, fontSize: 12, fontWeight: '800' },
  pressed: { opacity: 0.85 },
  board: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    overflow: 'hidden',
  },
  boardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  boardMe: { backgroundColor: colors.brandWash },
  boardRank: {
    width: 32,
    textAlign: 'center',
    color: colors.secondary,
    fontSize: 15,
    fontWeight: '800',
  },
  boardName: { flex: 1, gap: 2 },
  boardTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  boardRole: { ...type.caption, color: colors.muted },
  boardPoints: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
});
