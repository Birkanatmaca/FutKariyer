import React, { useState } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { Field } from '../../../shared/ui/Field';
import { copy } from '../../../shared/lib/copy';
import { space } from '../../../styles/tokens';
import type { ListingsService } from '../application/listings-service';
import {
  listingFieldErrors,
  listingFields,
  textLength,
  validateListing,
  type ListingErrors,
} from '../application/validation';
import {
  listingLimits,
  type CreatedListing,
  type ListingInput,
} from '../domain/models';

const emptyInput: ListingInput = { title: '', position: '', description: '' };

const labels: Record<keyof ListingInput, string> = {
  title: copy.listings.formTitle,
  position: copy.listings.formPosition,
  description: copy.listings.formDescription,
};

export function ListingForm({
  token,
  service,
  onCreated,
  onCancel,
}: {
  token: string;
  service: ListingsService;
  onCreated(result: CreatedListing): void;
  onCancel(): void;
}) {
  const [values, setValues] = useState<ListingInput>(emptyInput);
  const [errors, setErrors] = useState<ListingErrors>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  function change(field: keyof ListingInput, value: string) {
    setValues(current => ({ ...current, [field]: value }));
    setErrors(current => ({ ...current, [field]: undefined }));
  }

  async function submit() {
    if (busy) return;
    const validation = validateListing(values);
    setErrors(validation);
    setFormError('');
    if (Object.keys(validation).length) return;
    Keyboard.dismiss();
    setBusy(true);
    try {
      const result = await service.create(token, values);
      setValues(emptyInput);
      onCreated(result);
    } catch (failure) {
      setErrors(listingFieldErrors(failure));
      setFormError(
        failure instanceof Error ? failure.message : copy.form.unexpected,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.form}>
      {listingFields.map(field => (
        <Field
          key={field}
          label={labels[field]}
          value={values[field]}
          onChangeText={value => change(field, value)}
          multiline={field === 'description'}
          editable={!busy}
          error={errors[field]}
          hint={copy.listings.counter(
            textLength(values[field]),
            listingLimits[field].max,
          )}
        />
      ))}
      <ErrorBanner message={formError} />
      <Button label={copy.listings.publish} loading={busy} onPress={submit} />
      <Button
        label={copy.listings.closeForm}
        secondary
        disabled={busy}
        onPress={onCancel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.lg },
});
