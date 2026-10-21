import { useState, type FormEvent } from 'react';
import { ApiError } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import { Button } from '../../../shared/ui/Button';
import { Feedback } from '../../../shared/ui/Feedback';
import { Field } from '../../../shared/ui/Field';
import { ConfirmDialog, Modal } from '../../../shared/ui/Modal';
import { Pill, ToggleRow, windowState } from '../../../shared/ui/kit';
import {
  ImagePicker,
  WindowFields,
  useObjectUrl,
} from '../../../shared/ui/media';
import type { PopupService } from '../application/popup-service';
import {
  popupFormats,
  popupLimits,
  popupSizes,
  type Popup,
  type PopupFormat,
} from '../domain/models';
import { PopupPhone, popupState, stateTone } from './PopupParts';

const text = copy.popups;
type Unit = 'minutes' | 'hours' | 'days';
const unitMinutes: Record<Unit, number> = { minutes: 1, hours: 60, days: 1440 };
// Shows a stored interval in the largest whole unit.
function split(minutes: number): { value: number; unit: Unit } {
  if (minutes % 1440 === 0) return { value: minutes / 1440, unit: 'days' };
  if (minutes % 60 === 0) return { value: minutes / 60, unit: 'hours' };
  return { value: minutes, unit: 'minutes' };
}

export function PopupEditor({
  item,
  service,
  onClose,
  onDone,
}: {
  item?: Popup;
  service: PopupService;
  onClose(): void;
  onDone(message: string): void;
}) {
  const initial = split(item?.intervalMinutes ?? 1440);
  const [title, setTitle] = useState(item?.title ?? ''),
    [imageId, setImageId] = useState(item?.imageId ?? ''),
    [format, setFormat] = useState<PopupFormat | null>(item?.format ?? null),
    [file, setFile] = useState<File | null>(null),
    [intervalValue, setIntervalValue] = useState(initial.value),
    [unit, setUnit] = useState<Unit>(initial.unit),
    [maxViews, setMaxViews] = useState(item?.maxViews ?? 3),
    [active, setActive] = useState(item?.active ?? true),
    [range, setRange] = useState({
      startsAt: item?.startsAt ?? null,
      endsAt: item?.endsAt ?? null,
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [fields, setFields] = useState<Record<string, string>>({}),
    [confirm, setConfirm] = useState(false);
  const fileUrl = useObjectUrl(file);
  const imageSrc = fileUrl || (imageId ? service.imageUrl(imageId) : null);
  const minutes = intervalValue * unitMinutes[unit];
  const state = popupState({ active, ...range });

  async function choose(next: File | null) {
    setFields(current => ({ ...current, image: '' }));
    if (!next) return;
    try {
      setFormat(await service.check(next));
      setFile(next);
    } catch (failure) {
      setFields(current => ({
        ...current,
        image: failure instanceof Error ? failure.message : text.sizeError,
      }));
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setFields({});
    try {
      let id = imageId;
      if (file) {
        id = await service.upload(file);
        setImageId(id);
        setFile(null);
      }
      await service.save(
        {
          title,
          imageId: id,
          active,
          intervalMinutes: minutes,
          maxViews,
          ...range,
        },
        item?.id,
      );
      onDone(item ? text.saved : text.created);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : copy.form.unexpected,
      );
      if (failure instanceof ApiError) setFields(failure.fields);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Modal
        title={item ? text.edit : text.create}
        eyebrow={text.eyebrow}
        size="xl"
        busy={busy}
        onClose={onClose}
        footer={
          <>
            {item && (
              <Button
                variant="danger"
                className="modal-footer-start"
                disabled={busy}
                onClick={() => setConfirm(true)}
              >
                {copy.content.remove}
              </Button>
            )}
            <Button variant="secondary" disabled={busy} onClick={onClose}>
              {copy.form.cancel}
            </Button>
            <Button type="submit" form="popup-editor" busy={busy}>
              {item ? copy.content.saveChanges : text.create}
            </Button>
          </>
        }
      >
        <div className="ct-editor">
          <form id="popup-editor" className="kit-form" onSubmit={save}>
            <Field
              label={text.name}
              hint={text.nameHint}
              value={title}
              maxLength={120}
              required
              disabled={busy}
              error={fields.title}
              onChange={event => setTitle(event.target.value)}
            />
            <ImagePicker
              label={copy.content.image}
              hint={text.sizeError}
              src={imageSrc}
              aspect={
                format
                  ? popupSizes[format].width + ' / ' + popupSizes[format].height
                  : '1 / 1'
              }
              busy={busy}
              error={fields.image}
              onFile={choose}
            />
            <div className="pp-formats" aria-label={text.format}>
              {popupFormats.map(value => (
                <span
                  key={value}
                  className={'pp-format' + (format === value ? ' on' : '')}
                >
                  <i
                    style={{
                      aspectRatio:
                        popupSizes[value].width +
                        ' / ' +
                        popupSizes[value].height,
                    }}
                  />
                  <strong>{text.formats[value]}</strong>
                  <span className="muted">
                    {popupSizes[value].width}×{popupSizes[value].height}
                  </span>
                </span>
              ))}
            </div>
            <p className="kit-form-title">{copy.content.publishing}</p>
            <ToggleRow
              label={text.active}
              hint={text.activeHint}
              checked={active}
              disabled={busy}
              onChange={setActive}
            />
            <p className="kit-form-title">{text.frequency}</p>
            <div className="rt-form">
              <div className="field">
                <label htmlFor="popup-interval">{text.interval}</label>
                <div className="ct-inline">
                  <input
                    id="popup-interval"
                    type="number"
                    min={1}
                    max={Math.floor(
                      popupLimits.interval.max / unitMinutes[unit],
                    )}
                    value={intervalValue}
                    disabled={busy}
                    onChange={event =>
                      setIntervalValue(Number(event.target.value))
                    }
                  />
                  <select
                    aria-label={text.unit}
                    value={unit}
                    disabled={busy}
                    onChange={event => setUnit(event.target.value as Unit)}
                  >
                    {(['minutes', 'hours', 'days'] as Unit[]).map(value => (
                      <option key={value} value={value}>
                        {text.units[value]}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="hint">{text.intervalHint}</p>
                {fields.intervalMinutes && (
                  <p className="field-error" role="alert">
                    {fields.intervalMinutes}
                  </p>
                )}
              </div>
              <Field
                label={text.maxViews}
                type="number"
                min={popupLimits.views.min}
                max={popupLimits.views.max}
                value={String(maxViews)}
                disabled={busy}
                error={fields.maxViews}
                hint={text.maxViewsHint}
                onChange={event => setMaxViews(Number(event.target.value))}
              />
            </div>
            <p className="notice">{text.summary(minutes, maxViews)}</p>
            <p className="kit-form-title">{text.window}</p>
            <WindowFields
              value={range}
              onChange={patch =>
                setRange(current => ({ ...current, ...patch }))
              }
              busy={busy}
              errors={fields}
            />
            <Feedback message={error} />
          </form>
          <aside className="ct-preview">
            <div className="ct-preview-head">
              <span className="kit-form-title">{copy.content.preview}</span>
              <Pill tone={stateTone[state]}>{text.states[state]}</Pill>
            </div>
            <PopupPhone
              imageSrc={imageSrc}
              format={format}
              caption={
                windowState(range.startsAt, range.endsAt) === 'live'
                  ? text.previewCaption
                  : text.previewOutside
              }
            />
          </aside>
        </div>
      </Modal>
      {confirm && item && (
        <ConfirmDialog
          title={text.deleteTitle}
          message={text.deleteConfirm}
          confirm={copy.content.remove}
          onClose={() => setConfirm(false)}
          onConfirm={async () => {
            await service.remove(item.id);
            setConfirm(false);
            onDone(text.deleted);
          }}
        />
      )}
    </>
  );
}
