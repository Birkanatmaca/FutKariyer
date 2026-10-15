import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '../../../shared/ui/Button';
import { Field } from '../../../shared/ui/Field';
import { copy } from '../../../shared/lib/copy';
import {
  catalogDraft,
  maxAmountMinor,
  toCatalogUpdate,
  type CatalogDraft,
  type CatalogFieldErrors,
} from '../application/catalog-form';
import type { CatalogUpdate, StoreProductIds } from '../domain/models';

type Saved = StoreProductIds & { amountMinor: number; active: boolean };

// Reporting amount, store product ids and on-sale state of one package or the
// Pro plan. Every save sends both store ids; the toggle resends the saved ones.
export function CatalogEditor({
  title,
  saved,
  priceLabel,
  saveLabel,
  busy,
  onSave,
  onInvalid,
}: {
  title: string;
  saved: Saved;
  priceLabel: string;
  saveLabel: string;
  busy: boolean;
  onSave(update: CatalogUpdate): void;
  onInvalid(): void;
}) {
  const [draft, setDraft] = useState<CatalogDraft>(() => catalogDraft(saved));
  const [fields, setFields] = useState<CatalogFieldErrors>({});
  const { amountMinor, appleProductId, googleProductId } = saved;
  useEffect(() => {
    setDraft(catalogDraft({ amountMinor, appleProductId, googleProductId }));
    setFields({});
  }, [amountMinor, appleProductId, googleProductId]);

  const change = (key: keyof CatalogDraft) => (value: string) =>
    setDraft(current => ({ ...current, [key]: value }));

  function submit(source: CatalogDraft, active: boolean) {
    if (busy) return;
    const result = toCatalogUpdate(source, active);
    if ('fields' in result) {
      setFields(result.fields);
      onInvalid();
      return;
    }
    setFields({});
    onSave(result.update);
  }

  function save(event: FormEvent) {
    event.preventDefault();
    submit(draft, saved.active);
  }

  return (
    <form className="payment-package" onSubmit={save} noValidate>
      <div>
        <h3>{title}</h3>
        <span
          className={'league-status ' + (saved.active ? 'active' : 'neutral')}
        >
          {saved.active ? copy.payments.active : copy.payments.inactive}
        </span>
      </div>
      <Field
        label={priceLabel}
        type="number"
        min="1"
        max={maxAmountMinor / 100}
        step="0.01"
        inputMode="decimal"
        value={draft.price}
        onChange={event => change('price')(event.target.value)}
        error={fields.amountMinor}
        hint={copy.payments.priceHint}
        disabled={busy}
      />
      <Field
        label={copy.payments.appleProductId}
        value={draft.appleProductId}
        onChange={event => change('appleProductId')(event.target.value)}
        error={fields.appleProductId}
        hint={copy.payments.appleProductHint}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        maxLength={100}
        disabled={busy}
      />
      <Field
        label={copy.payments.googleProductId}
        value={draft.googleProductId}
        onChange={event => change('googleProductId')(event.target.value)}
        error={fields.googleProductId}
        hint={copy.payments.googleProductHint}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        maxLength={100}
        disabled={busy}
      />
      <div className="payment-package-actions">
        <label className="payment-active-toggle">
          <input
            type="checkbox"
            checked={saved.active}
            disabled={busy}
            onChange={event =>
              submit(catalogDraft(saved), event.target.checked)
            }
          />
          {copy.payments.active}
        </label>
        <Button
          type="submit"
          className="button-small"
          busy={busy}
          aria-label={title + ', ' + saveLabel}
        >
          {saveLabel}
        </Button>
      </div>
    </form>
  );
}
