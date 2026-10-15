import React, { useEffect, useState } from 'react';
import { Keyboard, Text, View } from 'react-native';
import { ErrorBanner } from '../../../../shared/ui/ErrorBanner';
import { Field } from '../../../../shared/ui/Field';
import { ApiError } from '../../../../shared/api/client';
import { copy } from '../../../../shared/lib/copy';
import { errorMessage } from '../../application/hooks';
import {
  priceText,
  toCatalogUpdate,
  type CatalogDraft,
  type FieldErrors,
} from '../../application/validation';
import type { CatalogUpdate, StoreProductIds } from '../../domain/models';
import {
  Card,
  SmallButton,
  SuccessNotice,
  Tag,
  ToggleRow,
  adminStyles,
} from '../parts/AdminParts';

const text = copy.admin.payments;

type Saved = StoreProductIds & { amountMinor: number; active: boolean };
function draftOf(saved: Omit<Saved, 'active'>): CatalogDraft {
  return {
    price: priceText(saved.amountMinor),
    appleProductId: saved.appleProductId,
    googleProductId: saved.googleProductId,
  };
}

// Reporting amount, store product ids and on-sale state of one package or the
// Pro plan. Every save sends both store ids; the toggle resends the saved ones.
export function CatalogEditor({
  title,
  saved,
  priceLabel,
  onSaleHint,
  saveLabel,
  savedNotice,
  onSave,
}: {
  title: string;
  saved: Saved;
  priceLabel: string;
  onSaleHint: string;
  saveLabel: string;
  savedNotice: string;
  onSave(update: CatalogUpdate): Promise<void>;
}) {
  const [draft, setDraft] = useState(() => draftOf(saved));
  const [fields, setFields] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { amountMinor, appleProductId, googleProductId } = saved;
  useEffect(() => {
    setDraft(draftOf({ amountMinor, appleProductId, googleProductId }));
  }, [amountMinor, appleProductId, googleProductId]);
  const change = (key: keyof CatalogDraft) => (value: string) =>
    setDraft(current => ({ ...current, [key]: value }));
  async function submit(source: CatalogDraft, active: boolean) {
    if (busy) return;
    setError(null);
    setNotice(null);
    const result = toCatalogUpdate(source, active);
    if ('fields' in result) {
      setFields(result.fields);
      return;
    }
    setFields({});
    Keyboard.dismiss();
    setBusy(true);
    try {
      await onSave(result.update);
      setNotice(savedNotice);
    } catch (failure) {
      if (failure instanceof ApiError) setFields(failure.fields);
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <View style={adminStyles.row}>
        <Text style={[adminStyles.rowTitle, adminStyles.flex]}>{title}</Text>
        <Tag
          label={saved.active ? text.onSale : text.offSale}
          tone={saved.active ? 'success' : 'neutral'}
        />
      </View>
      <Field
        label={priceLabel}
        value={draft.price}
        onChangeText={change('price')}
        error={fields.amountMinor}
        hint={text.priceHint}
        keyboardType="decimal-pad"
        maxLength={10}
        editable={!busy}
      />
      <Field
        label={text.appleProductId}
        value={draft.appleProductId}
        onChangeText={change('appleProductId')}
        error={fields.appleProductId}
        hint={text.appleProductHint}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={100}
        editable={!busy}
      />
      <Field
        label={text.googleProductId}
        value={draft.googleProductId}
        onChangeText={change('googleProductId')}
        error={fields.googleProductId}
        hint={text.googleProductHint}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={100}
        editable={!busy}
      />
      <ToggleRow
        label={text.onSale}
        hint={onSaleHint}
        value={saved.active}
        onChange={value => submit(draftOf(saved), value)}
        disabled={busy}
      />
      <SuccessNotice message={notice} />
      <ErrorBanner message={error} />
      <SmallButton
        label={saveLabel}
        tone="brand"
        accessibilityLabel={title + ', ' + saveLabel}
        onPress={() => submit(draft, saved.active)}
        loading={busy}
      />
    </Card>
  );
}
