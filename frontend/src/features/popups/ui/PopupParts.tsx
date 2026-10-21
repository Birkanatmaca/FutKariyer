import { copy } from '../../../shared/lib/copy';
import { PhoneFrame, windowState, type Tone } from '../../../shared/ui/kit';
import { popupSizes, type PopupFormat } from '../domain/models';

const text = copy.popups;

export type PopupState = 'live' | 'scheduled' | 'expired' | 'off';

export function popupState(popup: {
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
}): PopupState {
  if (!popup.active) return 'off';
  return windowState(popup.startsAt, popup.endsAt);
}

export const stateTone: Record<PopupState, Tone> = {
  live: 'accent',
  scheduled: 'info',
  expired: 'danger',
  off: 'muted',
};

// The app at launch with the popup laid over a dimmed home screen.
export function PopupPhone({
  imageSrc,
  format,
  caption,
}: {
  imageSrc: string | null;
  format: PopupFormat | null;
  caption?: string;
}) {
  const size = popupSizes[format ?? 'square'];
  return (
    <PhoneFrame caption={caption}>
      <div className="pp-stage">
        <div className="pp-home" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div
          className={'pp-popup pp-' + (format ?? 'square')}
          style={{ aspectRatio: size.width + ' / ' + size.height }}
        >
          {imageSrc ? (
            <img src={imageSrc} alt="" />
          ) : (
            <span className="muted">{text.noImage}</span>
          )}
          <span className="pp-close" aria-hidden="true">
            ×
          </span>
        </div>
      </div>
    </PhoneFrame>
  );
}
