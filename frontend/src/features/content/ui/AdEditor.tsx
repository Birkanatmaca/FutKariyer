import { useState, type FormEvent } from 'react';
import { ApiError } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import { Button } from '../../../shared/ui/Button';
import { Feedback } from '../../../shared/ui/Feedback';
import { Field } from '../../../shared/ui/Field';
import { ConfirmDialog, Modal } from '../../../shared/ui/Modal';
import { ToggleRow } from '../../../shared/ui/kit';
import type { ContentService } from '../application/content-service';
import {
  advertisementSize,
  defaultSeconds,
  type Advertisement,
  type ContentForm,
} from '../domain/models';
import {
  AdPhone,
  ImagePicker,
  ScheduleFields,
  StatePill,
  itemState,
  useObjectUrl,
} from './parts';

const text = copy.content;

export function adForm(item?: Advertisement, sortOrder = 0): ContentForm {
  return {
    title: item?.title ?? '',
    imageId: item?.imageId ?? '',
    active: item?.active ?? true,
    sortOrder: item?.sortOrder ?? sortOrder,
    summary: '',
    body: '',
    published: false,
    showOnHome: false,
    displaySeconds: item?.displaySeconds ?? defaultSeconds.ads,
    startsAt: item?.startsAt ?? null,
    endsAt: item?.endsAt ?? null,
  };
}

export function AdEditor({
  item,
  service,
  nextOrder,
  position,
  count,
  onClose,
  onDone,
}: {
  item?: Advertisement;
  service: ContentService;
  nextOrder: number;
  position: number;
  count: number;
  onClose(): void;
  onDone(message: string): void;
}) {
  const [form, setForm] = useState<ContentForm>(() => adForm(item, nextOrder));
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState(false);
  const fileUrl = useObjectUrl(file);
  const imageSrc =
    fileUrl || (form.imageId ? service.imageUrl(form.imageId) : null);
  const change = (patch: Partial<ContentForm>) =>
    setForm(current => ({ ...current, ...patch }));

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setFields({});
    try {
      let imageId = form.imageId;
      if (file) {
        imageId = await service.upload(file);
        change({ imageId });
        setFile(null);
      }
      await service.save('ads', { ...form, imageId }, item?.id);
      onDone(item ? text.saved : text.adCreated);
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
        title={item ? text.editAd : text.newAd}
        eyebrow={text.adsEyebrow}
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
                {text.remove}
              </Button>
            )}
            <Button variant="secondary" disabled={busy} onClick={onClose}>
              {copy.form.cancel}
            </Button>
            <Button type="submit" form="ad-editor" busy={busy}>
              {item ? text.saveChanges : text.addAd}
            </Button>
          </>
        }
      >
        <div className="ct-editor">
          <form id="ad-editor" className="kit-form" onSubmit={save}>
            <Field
              label={text.adTitle}
              hint={text.adTitleHint}
              value={form.title}
              maxLength={120}
              required
              disabled={busy}
              error={fields.title}
              onChange={event => change({ title: event.target.value })}
            />
            <ImagePicker
              label={text.image}
              hint={text.adImageHint(
                advertisementSize.width,
                advertisementSize.height,
              )}
              src={imageSrc}
              aspect={
                advertisementSize.width + ' / ' + advertisementSize.height
              }
              busy={busy}
              error={fields.image}
              onFile={setFile}
            />
            <p className="kit-form-title">{text.publishing}</p>
            <ToggleRow
              label={text.activeAd}
              hint={text.activeAdHint}
              checked={form.active}
              disabled={busy}
              onChange={active => change({ active })}
            />
            <div className="field">
              <label htmlFor="ad-order">{text.order}</label>
              <input
                id="ad-order"
                type="number"
                min={0}
                max={10000}
                value={form.sortOrder}
                disabled={busy}
                onChange={event =>
                  change({ sortOrder: Number(event.target.value) })
                }
              />
              <p className="hint">{text.orderHint}</p>
              {fields.sortOrder && (
                <p className="field-error" role="alert">
                  {fields.sortOrder}
                </p>
              )}
            </div>
            <p className="kit-form-title">{text.timing}</p>
            <ScheduleFields
              value={form}
              onChange={schedule => change(schedule)}
              busy={busy}
              errors={fields}
              secondsHint={text.adSecondsHint}
            />
            <Feedback message={error} />
          </form>
          <aside className="ct-preview">
            <div className="ct-preview-head">
              <span className="kit-form-title">{text.preview}</span>
              <StatePill ad state={itemState(form.active, form)} />
            </div>
            <AdPhone
              imageSrc={imageSrc}
              seconds={form.displaySeconds}
              index={Math.max(0, position)}
              count={Math.max(1, count)}
              caption={
                position >= 0
                  ? text.loopPosition(position + 1, count)
                  : text.notInLoop
              }
            />
          </aside>
        </div>
      </Modal>
      {confirm && item && (
        <ConfirmDialog
          title={text.deleteAdTitle}
          message={text.deleteConfirm}
          confirm={text.remove}
          onClose={() => setConfirm(false)}
          onConfirm={async () => {
            await service.remove('ads', item.id);
            setConfirm(false);
            onDone(text.deleted);
          }}
        />
      )}
    </>
  );
}
