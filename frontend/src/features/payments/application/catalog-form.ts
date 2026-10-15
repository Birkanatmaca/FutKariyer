import { copy } from '../../../shared/lib/copy';
import type { CatalogUpdate, StoreProductIds } from '../domain/models';

export type CatalogFieldErrors = Partial<
  Record<'amountMinor' | 'appleProductId' | 'googleProductId', string>
>;
// The package / Pro plan form: reporting amount in lira plus both store ids.
export type CatalogDraft = StoreProductIds & { price: string };

export const maxAmountMinor = 100000000;
// Store product ids mirror the server rules; '' means not sold in that store.
export const storeProductPatterns = {
  apple: /^[A-Za-z0-9._]{1,100}$/,
  google: /^[a-z0-9][a-z0-9._]{0,99}$/,
} as const;

export function normalizeStoreProductIds(
  ids: StoreProductIds,
): StoreProductIds {
  return {
    appleProductId: ids.appleProductId.trim(),
    googleProductId: ids.googleProductId.trim(),
  };
}

export function validateStoreProductIds(
  input: StoreProductIds,
): CatalogFieldErrors {
  const ids = normalizeStoreProductIds(input);
  const fields: CatalogFieldErrors = {};
  if (
    ids.appleProductId &&
    !storeProductPatterns.apple.test(ids.appleProductId)
  )
    fields.appleProductId = copy.payments.appleProductError;
  if (
    ids.googleProductId &&
    !storeProductPatterns.google.test(ids.googleProductId)
  )
    fields.googleProductId = copy.payments.googleProductError;
  return fields;
}

// Lira typed as "150", "149.90" or "149,90"; 1 TL to 1.000.000 TL.
export function parseAmount(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(normalized)) return null;
  const minor = Math.round(Number(normalized) * 100);
  return minor >= 100 && minor <= maxAmountMinor ? minor : null;
}

export function catalogDraft(
  saved: StoreProductIds & { amountMinor: number },
): CatalogDraft {
  return {
    price: (saved.amountMinor / 100).toFixed(2),
    appleProductId: saved.appleProductId,
    googleProductId: saved.googleProductId,
  };
}

export function toCatalogUpdate(
  draft: CatalogDraft,
  active: boolean,
): { update: CatalogUpdate } | { fields: CatalogFieldErrors } {
  const fields = validateStoreProductIds(draft);
  const amountMinor = parseAmount(draft.price);
  if (amountMinor === null) fields.amountMinor = copy.payments.priceRange;
  if (amountMinor === null || Object.keys(fields).length) return { fields };
  return {
    update: { amountMinor, active, ...normalizeStoreProductIds(draft) },
  };
}
