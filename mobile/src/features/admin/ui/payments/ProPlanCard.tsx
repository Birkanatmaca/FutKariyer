import React, { useEffect, useState } from 'react';
import { Keyboard, Text, View } from 'react-native';
import { ErrorBanner } from '../../../../shared/ui/ErrorBanner';
import { Field } from '../../../../shared/ui/Field';
import { ApiError } from '../../../../shared/api/client';
import { copy } from '../../../../shared/lib/copy';
import type { AdminServices } from '../../application/admin-services';
import { errorMessage } from '../../application/hooks';
import { parsePrice, priceText } from '../../application/validation';
import type { ProPlan } from '../../domain/models';
import {
  Card,
  SmallButton,
  SuccessNotice,
  Tag,
  ToggleRow,
  adminStyles,
} from '../parts/AdminParts';

const text = copy.admin.payments;

// Same price / on-sale management as a team-right package, for the single Pro plan.
export function ProPlanCard({
  plan,
  services,
  onSaved,
}: {
  plan: ProPlan;
  services: AdminServices;
  onSaved(updated: ProPlan): void;
}) {
  const [price, setPrice] = useState(priceText(plan.amountMinor));
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setPrice(priceText(plan.amountMinor));
  }, [plan.amountMinor]);
  async function update(amountMinor: number | null, active: boolean) {
    if (busy) return;
    setError(null);
    setNotice(null);
    setFieldError(undefined);
    if (amountMinor === null) {
      setFieldError(text.priceError);
      return;
    }
    Keyboard.dismiss();
    setBusy(true);
    try {
      onSaved(
        await services.payments.updateProPlan(plan.id, amountMinor, active),
      );
      setNotice(text.proSaved);
    } catch (failure) {
      if (failure instanceof ApiError)
        setFieldError(failure.fields.amountMinor);
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <View style={adminStyles.row}>
        <Text style={[adminStyles.rowTitle, adminStyles.flex]}>
          {text.proPlanTitle(plan.days, plan.bonusCredits)}
        </Text>
        <Tag
          label={plan.active ? text.onSale : text.offSale}
          tone={plan.active ? 'success' : 'neutral'}
        />
      </View>
      <Field
        label={text.proPrice}
        value={price}
        onChangeText={setPrice}
        error={fieldError}
        keyboardType="decimal-pad"
        maxLength={10}
        editable={!busy}
      />
      <ToggleRow
        label={text.onSale}
        hint={text.proOnSaleHint}
        value={plan.active}
        onChange={value => update(plan.amountMinor, value)}
        disabled={busy}
      />
      <SuccessNotice message={notice} />
      <ErrorBanner message={error} />
      <SmallButton
        label={text.saveProPlan}
        tone="brand"
        accessibilityLabel={text.proPlan + ', ' + text.saveProPlan}
        onPress={() => update(parsePrice(price), plan.active)}
        loading={busy}
      />
    </Card>
  );
}
