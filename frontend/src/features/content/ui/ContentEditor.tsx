import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiError } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import { Button } from '../../../shared/ui/Button';
import { Field } from '../../../shared/ui/Field';
import { Feedback } from '../../../shared/ui/Feedback';
import type {
  ContentForm,
  ContentItem,
  ContentSection,
} from '../domain/models';
import type { ContentService } from '../application/content-service';
export function ContentEditor({
  section,
  item,
  service,
  onClose,
  onDone,
}: {
  section: ContentSection;
  item?: ContentItem;
  service: ContentService;
  onClose(): void;
  onDone(): void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState<ContentForm>({
    title: item?.title || '',
    imageId: item?.imageId || '',
    active: item && 'active' in item ? item.active : false,
    sortOrder: item && 'sortOrder' in item ? item.sortOrder : 0,
    summary: item && 'summary' in item ? item.summary : '',
    body: item && 'body' in item ? item.body : '',
    published: item && 'published' in item ? item.published : false,
    showOnHome: item && 'showOnHome' in item ? item.showOnHome : false,
  });
  const [file, setFile] = useState<File | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [fields, setFields] = useState<Record<string, string>>({}),
    [confirm, setConfirm] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  function change<K extends keyof ContentForm>(key: K, value: ContentForm[K]) {
    setForm(current => ({ ...current, [key]: value }));
  }
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
        change('imageId', imageId);
        setFile(null);
        if (fileInput.current) fileInput.current.value = '';
      }
      await service.save(section, { ...form, imageId }, item?.id);
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
      await service.remove(section, item.id);
      onDone();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : copy.form.unexpected,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="editor"
      aria-labelledby="content-editor-title"
      onCancel={event => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <header className="editor-header">
        <h2 id="content-editor-title">
          {item ? copy.content.edit : copy.content.create} {copy.panel[section]}
        </h2>
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
            value={form.title}
            maxLength={120}
            required
            disabled={busy}
            error={fields.title}
            onChange={e => change('title', e.target.value)}
          />
          <div className="field">
            <label htmlFor="content-image">{copy.content.image}</label>
            <input
              ref={fileInput}
              id="content-image"
              type="file"
              accept="image/jpeg,image/png"
              disabled={busy}
              onChange={e => setFile(e.target.files?.[0] || null)}
            />
            <p className="hint">{copy.content.imageHint}</p>
            {fields.image && (
              <p className="field-error" role="alert">
                {fields.image}
              </p>
            )}
          </div>
          {file && (
            <p className="hint">{copy.content.selectedFile(file.name)}</p>
          )}
          {form.imageId && !file && (
            <img
              className="content-preview"
              src={service.imageUrl(form.imageId)}
              alt={form.title || copy.content.image}
            />
          )}
          {section === 'ads' ? (
            <>
              <Field
                label={copy.content.order}
                type="number"
                min={0}
                max={10000}
                required
                value={form.sortOrder}
                disabled={busy}
                error={fields.sortOrder}
                onChange={e => change('sortOrder', Number(e.target.value))}
              />
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={form.active}
                  disabled={busy}
                  onChange={e => change('active', e.target.checked)}
                />
                {copy.content.activeAd}
              </label>
            </>
          ) : (
            <>
              <label className="field">
                {copy.content.summary}
                <textarea
                  value={form.summary}
                  maxLength={300}
                  required
                  disabled={busy}
                  onChange={e => change('summary', e.target.value)}
                  rows={3}
                  aria-invalid={!!fields.summary}
                />
                {fields.summary && (
                  <span className="field-error" role="alert">
                    {fields.summary}
                  </span>
                )}
              </label>
              <label className="field">
                {copy.content.body}
                <textarea
                  value={form.body}
                  maxLength={20000}
                  required
                  disabled={busy}
                  onChange={e => change('body', e.target.value)}
                  rows={7}
                  aria-invalid={!!fields.body}
                />
                {fields.body && (
                  <span className="field-error" role="alert">
                    {fields.body}
                  </span>
                )}
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={form.published}
                  disabled={busy}
                  onChange={e => change('published', e.target.checked)}
                />
                {copy.content.published}
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={form.showOnHome}
                  disabled={busy}
                  onChange={e => change('showOnHome', e.target.checked)}
                />
                {copy.content.showOnHome}
              </label>
              <p className="hint">{copy.content.homeHint}</p>
              {(form.imageId || file) && (
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => {
                    setFile(null);
                    change('imageId', '');
                    if (fileInput.current) fileInput.current.value = '';
                  }}
                >
                  {copy.content.removeImage}
                </Button>
              )}
            </>
          )}
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
                <p>{copy.content.deleteConfirm}</p>
                <div className="action-row">
                  <Button variant="danger" busy={busy} onClick={remove}>
                    {copy.content.remove}
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
                {copy.content.remove}
              </Button>
            )}
          </div>
        )}
      </div>
    </dialog>
  );
}
