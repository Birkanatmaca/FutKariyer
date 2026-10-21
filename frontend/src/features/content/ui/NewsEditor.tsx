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
  defaultSeconds,
  type Article,
  type ContentForm,
} from '../domain/models';
import {
  ImagePicker,
  NewsPhone,
  ScheduleFields,
  itemState,
  StatePill,
  useObjectUrl,
} from './parts';

const text = copy.content;

export function articleForm(item?: Article, sortOrder = 100): ContentForm {
  return {
    title: item?.title ?? '',
    imageId: item?.imageId ?? '',
    active: false,
    sortOrder: item?.sortOrder ?? sortOrder,
    summary: item?.summary ?? '',
    body: item?.body ?? '',
    published: item?.published ?? true,
    showOnHome: item?.showOnHome ?? true,
    displaySeconds: item?.displaySeconds ?? defaultSeconds.news,
    startsAt: item?.startsAt ?? null,
    endsAt: item?.endsAt ?? null,
  };
}

export function NewsEditor({
  item,
  service,
  firstOrder,
  position,
  count,
  onClose,
  onDone,
}: {
  item?: Article;
  service: ContentService;
  // The priority that puts an article before every other one.
  firstOrder: number;
  position: number;
  count: number;
  onClose(): void;
  onDone(message: string): void;
}) {
  const [form, setForm] = useState<ContentForm>(() => articleForm(item));
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
  const club = !!item?.authorName;
  const pendingReview = item?.reviewStatus === 'pending';

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
      await service.save('news', { ...form, imageId }, item?.id);
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
        title={item ? text.editNews : text.newNews}
        eyebrow={text.newsEyebrow}
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
            <Button type="submit" form="news-editor" busy={busy}>
              {item ? text.saveChanges : text.publishNews}
            </Button>
          </>
        }
      >
        <div className="ct-editor">
          <form id="news-editor" className="kit-form" onSubmit={save}>
            {club && (
              <p className="notice">
                {text.club(item.authorName || '')}
                {pendingReview ? ' · ' + text.reviewStatus.pending : ''}
              </p>
            )}
            <Field
              label={text.title}
              value={form.title}
              maxLength={120}
              required
              disabled={busy}
              error={fields.title}
              onChange={event => change({ title: event.target.value })}
            />
            <div className="field">
              <label htmlFor="news-summary">{text.summary}</label>
              <textarea
                id="news-summary"
                rows={2}
                maxLength={300}
                required
                disabled={busy}
                value={form.summary}
                onChange={event => change({ summary: event.target.value })}
              />
              {fields.summary && (
                <p className="field-error" role="alert">
                  {fields.summary}
                </p>
              )}
            </div>
            <div className="field">
              <label htmlFor="news-body">{text.body}</label>
              <textarea
                id="news-body"
                rows={6}
                maxLength={20000}
                required
                disabled={busy}
                value={form.body}
                onChange={event => change({ body: event.target.value })}
              />
              {fields.body && (
                <p className="field-error" role="alert">
                  {fields.body}
                </p>
              )}
            </div>
            {!club && (
              <ImagePicker
                label={text.cover}
                hint={text.coverHint}
                src={imageSrc}
                aspect="16 / 10"
                busy={busy}
                error={fields.image}
                onFile={setFile}
                onRemove={() => {
                  setFile(null);
                  change({ imageId: '' });
                }}
              />
            )}
            <p className="kit-form-title">{text.publishing}</p>
            <ToggleRow
              label={text.published}
              hint={pendingReview ? text.reviewFirst : text.publishedHint}
              checked={form.published}
              disabled={busy || pendingReview}
              onChange={published => change({ published })}
            />
            <ToggleRow
              label={text.showOnHome}
              hint={text.homeHint}
              checked={form.showOnHome}
              disabled={busy}
              onChange={showOnHome => change({ showOnHome })}
            />
            <div className="field">
              <label htmlFor="news-order">{text.priority}</label>
              <div className="ct-inline">
                <input
                  id="news-order"
                  type="number"
                  min={0}
                  max={10000}
                  value={form.sortOrder}
                  disabled={busy}
                  onChange={event =>
                    change({ sortOrder: Number(event.target.value) })
                  }
                />
                <button
                  type="button"
                  className="kit-action kit-action-primary"
                  disabled={busy}
                  onClick={() => change({ sortOrder: firstOrder })}
                >
                  {text.toFront}
                </button>
              </div>
              <p className="hint">{text.priorityHint}</p>
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
              secondsHint={text.newsSecondsHint}
            />
            <Feedback message={error} />
          </form>
          <aside className="ct-preview">
            <div className="ct-preview-head">
              <span className="kit-form-title">{text.preview}</span>
              <StatePill state={itemState(form.published, form)} />
            </div>
            <NewsPhone
              title={form.title}
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
          title={text.deleteNewsTitle}
          message={text.deleteConfirm}
          confirm={text.remove}
          onClose={() => setConfirm(false)}
          onConfirm={async () => {
            await service.remove('news', item.id);
            setConfirm(false);
            onDone(text.deleted);
          }}
        />
      )}
    </>
  );
}
