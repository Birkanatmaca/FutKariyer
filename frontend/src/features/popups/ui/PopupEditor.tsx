import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiError } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import { Button } from '../../../shared/ui/Button';
import { Field } from '../../../shared/ui/Field';
import { Feedback } from '../../../shared/ui/Feedback';
import type { PopupService } from '../application/popup-service';
import {
  popupFormats,
  popupLimits,
  popupSizes,
  type Popup,
  type PopupFormat,
} from '../domain/models';

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
  onDone(): void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const initial = split(item?.intervalMinutes ?? 1440);
  const [title, setTitle] = useState(item?.title ?? ''),
    [imageId, setImageId] = useState(item?.imageId ?? ''),
    [format, setFormat] = useState<PopupFormat | null>(item?.format ?? null),
    [file, setFile] = useState<File | null>(null),
    [intervalValue, setIntervalValue] = useState(initial.value),
    [unit, setUnit] = useState<Unit>(initial.unit),
    [maxViews, setMaxViews] = useState(item?.maxViews ?? 3),
    [active, setActive] = useState(item?.active ?? false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [fields, setFields] = useState<Record<string, string>>({}),
    [confirm, setConfirm] = useState(false);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  async function choose(next: File | null) {
    setFields(current => ({ ...current, image: '' }));
    setFile(null);
    if (!next) return;
    try {
      setFormat(await service.check(next));
      setFile(next);
    } catch (failure) {
      setFields(current => ({
        ...current,
        image: failure instanceof Error ? failure.message : text.sizeError,
      }));
      if (fileInput.current) fileInput.current.value = '';
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
        if (fileInput.current) fileInput.current.value = '';
      }
      await service.save(
        {
          title,
          imageId: id,
          active,
          intervalMinutes: intervalValue * unitMinutes[unit],
          maxViews,
        },
        item?.id,
      );
      onDone();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : copy.form.unexpected,
      );
      if (failure instanceof ApiError) setFields(failure.fields);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!item || busy) return;
    setBusy(true);
    setError(null);
    try {
      await service.remove(item.id);
      onDone();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : copy.form.unexpected,
      );
    } finally {
      setBusy(false);
    }
  }
  const minutes = intervalValue * unitMinutes[unit];
  return (
    <dialog
      ref={dialog}
      className="editor"
      aria-labelledby="popup-editor-title"
      onCancel={event => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <header className="editor-header">
        <h2 id="popup-editor-title">{item ? text.edit : text.create}</h2>
        <button
          className="icon-button"
          disabled={busy}
          onClick={onClose}
          aria-label={copy.form.close}
        >
          ×
        </button>
      </header>
      <div className="editor-body">
        <form className="form-stack" onSubmit={save}>
          <Field
            label={copy.content.title}
            value={title}
            maxLength={120}
            required
            disabled={busy}
            error={fields.title}
            onChange={e => setTitle(e.target.value)}
          />
          <div className="field">
            <label htmlFor="popup-image">{copy.content.image}</label>
            <input
              ref={fileInput}
              id="popup-image"
              type="file"
              accept="image/jpeg,image/png"
              disabled={busy}
              onChange={e => choose(e.target.files?.[0] ?? null)}
            />
            <ul className="hint popup-sizes">
              {popupFormats.map(value => (
                <li key={value}>
                  <strong>{text.formats[value]}</strong>{' '}
                  {popupSizes[value].width}×{popupSizes[value].height} px
                </li>
              ))}
            </ul>
            <p className="hint">{copy.content.imageHint}</p>
            {fields.image && (
              <p className="field-error" role="alert">
                {fields.image}
              </p>
            )}
          </div>
          {file && format && (
            <p className="hint">
              {text.selected(file.name, text.formats[format])}
            </p>
          )}
          {imageId && !file && format && (
            <figure className={'popup-preview ' + format}>
              <img
                src={service.imageUrl(imageId)}
                alt={title || text.preview}
              />
              <figcaption>{text.formats[format]}</figcaption>
            </figure>
          )}
          <div className="popup-interval">
            <Field
              label={text.interval}
              type="number"
              min={1}
              required
              value={intervalValue}
              disabled={busy}
              error={fields.intervalMinutes}
              onChange={e =>
                setIntervalValue(
                  Math.max(0, Math.floor(Number(e.target.value))),
                )
              }
            />
            <label className="field">
              <span>{text.unit}</span>
              <select
                value={unit}
                disabled={busy}
                onChange={e => setUnit(e.target.value as Unit)}
              >
                {(Object.keys(unitMinutes) as Unit[]).map(value => (
                  <option key={value} value={value}>
                    {text.units[value]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <Field
            label={text.maxViews}
            type="number"
            min={popupLimits.views.min}
            max={popupLimits.views.max}
            required
            value={maxViews}
            disabled={busy}
            error={fields.maxViews}
            onChange={e => setMaxViews(Math.floor(Number(e.target.value)))}
          />
          <p className="hint">
            {minutes >= popupLimits.interval.min &&
            minutes <= popupLimits.interval.max
              ? text.summary(minutes, maxViews)
              : text.intervalHint}
          </p>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={active}
              disabled={busy}
              onChange={e => setActive(e.target.checked)}
            />
            {text.active}
          </label>
          <Feedback message={error} />
          <div className="action-row">
            <Button type="submit" busy={busy}>
              {copy.editor.save}
            </Button>
            <Button variant="secondary" disabled={busy} onClick={onClose}>
              {copy.form.cancel}
            </Button>
          </div>
        </form>
        {item && (
          <div className="security-actions">
            {confirm ? (
              <div className="delete-confirm">
                <p>{text.deleteConfirm}</p>
                <div className="action-row">
                  <Button variant="danger" busy={busy} onClick={remove}>
                    {text.remove}
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => setConfirm(false)}
                  >
                    {copy.form.cancel}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="danger"
                disabled={busy}
                onClick={() => setConfirm(true)}
              >
                {text.remove}
              </Button>
            )}
          </div>
        )}
      </div>
    </dialog>
  );
}
