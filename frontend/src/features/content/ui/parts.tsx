import type { ReactNode } from 'react';
import { copy } from '../../../shared/lib/copy';
import {
  PhoneFrame,
  Pill,
  windowState,
  type Tone,
} from '../../../shared/ui/kit';
import { WindowFields } from '../../../shared/ui/media';
export {
  ImagePicker,
  WindowFields,
  useObjectUrl,
  windowLabel,
} from '../../../shared/ui/media';
import { displaySecondsRange, type Schedule } from '../domain/models';

const text = copy.content;

export type ItemState = 'live' | 'scheduled' | 'expired' | 'draft' | 'pending';

// Where an item stands for the app right now: switched off, waiting for its
// start, past its end, or live.
export function itemState(
  on: boolean,
  schedule: Schedule,
  now = Date.now(),
): ItemState {
  if (!on) return 'draft';
  return windowState(schedule.startsAt, schedule.endsAt, now);
}

const stateTone: Record<ItemState, Tone> = {
  live: 'accent',
  scheduled: 'info',
  expired: 'danger',
  draft: 'muted',
  pending: 'warning',
};

export function StatePill({
  state,
  ad = false,
}: {
  state: ItemState;
  ad?: boolean;
}) {
  const label =
    ad && state !== 'pending' ? text.adStates[state] : text.states[state];
  return <Pill tone={stateTone[state]}>{label}</Pill>;
}

// How long each item stays on screen and the window it is live in.
export function ScheduleFields({
  value,
  onChange,
  busy,
  errors,
  secondsHint,
}: {
  value: Schedule;
  onChange(value: Schedule): void;
  busy: boolean;
  errors: Record<string, string>;
  secondsHint: string;
}) {
  const set = (patch: Partial<Schedule>) => onChange({ ...value, ...patch });
  return (
    <div className="ct-schedule">
      <div className="field">
        <label htmlFor="ct-seconds">
          {text.displaySeconds}
          <strong className="ct-seconds-value">
            {copy.kit.seconds(value.displaySeconds)}
          </strong>
        </label>
        <input
          id="ct-seconds"
          type="range"
          className="ct-range"
          min={displaySecondsRange.min}
          max={displaySecondsRange.max}
          step={1}
          value={value.displaySeconds}
          disabled={busy}
          onChange={event =>
            set({ displaySeconds: Number(event.target.value) })
          }
        />
        <p className="hint">{secondsHint}</p>
        {errors.displaySeconds && (
          <p className="field-error" role="alert">
            {errors.displaySeconds}
          </p>
        )}
      </div>
      <WindowFields value={value} onChange={set} busy={busy} errors={errors} />
    </div>
  );
}

// A filling bar per item, like the app's story strip.
function Segments({ count, index }: { count: number; index: number }) {
  return (
    <div className="ct-segments" aria-hidden="true">
      {Array.from({ length: Math.max(1, count) }, (_, n) => (
        <span
          key={n}
          className={n < index ? 'done' : n === index ? 'now' : ''}
        />
      ))}
    </div>
  );
}

function PhoneTop() {
  return (
    <div className="ct-phone-top" aria-hidden="true">
      <strong>
        FUT<span>CAREER</span>
      </strong>
      <span className="ct-dot-row">
        <i />
        <i />
        <i />
      </span>
    </div>
  );
}

function Skeleton({ height }: { height: number }) {
  return <div className="ct-skeleton" style={{ height }} aria-hidden="true" />;
}

// The home screen with the news card in its place.
export function NewsPhone({
  title,
  imageSrc,
  seconds,
  index,
  count,
  caption,
}: {
  title: string;
  imageSrc: string | null;
  seconds: number;
  index: number;
  count: number;
  caption?: string;
}) {
  return (
    <PhoneFrame caption={caption}>
      <PhoneTop />
      <Skeleton height={64} />
      <Skeleton height={70} />
      <div className="ct-news-card">
        {imageSrc ? (
          <img src={imageSrc} alt="" />
        ) : (
          <div className="ct-news-art" aria-hidden="true" />
        )}
        <span className="ct-news-title">{title || text.untitled}</span>
        <Segments count={count} index={index} />
      </div>
      <p className="ct-phone-note">{text.onScreen(seconds)}</p>
      <Skeleton height={44} />
    </PhoneFrame>
  );
}

// The home screen with the banner slot at the top.
export function AdPhone({
  imageSrc,
  seconds,
  index,
  count,
  caption,
}: {
  imageSrc: string | null;
  seconds: number;
  index: number;
  count: number;
  caption?: string;
}) {
  return (
    <PhoneFrame caption={caption}>
      <PhoneTop />
      <Skeleton height={64} />
      <div className="ct-ad-slot">
        {imageSrc ? (
          <img src={imageSrc} alt="" />
        ) : (
          <span className="muted">{text.adSize}</span>
        )}
        <span className="ct-ad-badge">{text.adBadge}</span>
        <span className="ct-ad-dots" aria-hidden="true">
          {Array.from({ length: Math.max(1, count) }, (_, n) => (
            <i key={n} className={n === index ? 'on' : ''} />
          ))}
        </span>
      </div>
      <p className="ct-phone-note">{text.onScreen(seconds)}</p>
      <Skeleton height={120} />
    </PhoneFrame>
  );
}

// The ordered loop the app plays, with move buttons.
export function LoopList<T extends { id: string }>({
  items,
  render,
  selected,
  onSelect,
  onMove,
  busy,
}: {
  items: T[];
  render(item: T): ReactNode;
  selected: string | null;
  onSelect(item: T): void;
  onMove(from: number, to: number): void;
  busy: boolean;
}) {
  return (
    <ol className="ct-loop">
      {items.map((item, index) => (
        <li
          key={item.id}
          className={selected === item.id ? 'ct-loop-on' : undefined}
        >
          <button
            type="button"
            className="ct-loop-main"
            onClick={() => onSelect(item)}
          >
            <span className="ct-rank">{index + 1}</span>
            {render(item)}
          </button>
          <span className="ct-loop-moves">
            <button
              type="button"
              className="kit-page"
              aria-label={text.moveUp}
              disabled={busy || index === 0}
              onClick={() => onMove(index, index - 1)}
            >
              ↑
            </button>
            <button
              type="button"
              className="kit-page"
              aria-label={text.moveDown}
              disabled={busy || index === items.length - 1}
              onClick={() => onMove(index, index + 1)}
            >
              ↓
            </button>
          </span>
        </li>
      ))}
    </ol>
  );
}
