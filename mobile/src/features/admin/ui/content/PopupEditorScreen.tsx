import React, { useState } from 'react';
import { Keyboard, StyleSheet, Text, View } from 'react-native';
import { ImagePlus, Trash } from 'lucide-react-native';
import { BackLink } from '../../../../shared/ui/BackLink';
import { Button } from '../../../../shared/ui/Button';
import { ErrorBanner } from '../../../../shared/ui/ErrorBanner';
import { Field } from '../../../../shared/ui/Field';
import { PageHeader } from '../../../../shared/ui/PageHeader';
import { Screen } from '../../../../shared/ui/Screen';
import { ApiError } from '../../../../shared/api/client';
import { copy } from '../../../../shared/lib/copy';
import { colors } from '../../../../styles/tokens';
import type { AdminServices } from '../../application/admin-services';
import { errorMessage } from '../../application/hooks';
import { parseWhole, type FieldErrors } from '../../application/validation';
import type { PickedImage, PopupAd } from '../../domain/models';
import {
  AdminImage,
  Choices,
  SmallButton,
  ToggleRow,
  adminStyles,
} from '../parts/AdminParts';
import { confirm } from '../parts/confirm';

const text = copy.admin.popups;
type Unit = 'minutes' | 'hours' | 'days';
const unitMinutes: Record<Unit, number> = { minutes: 1, hours: 60, days: 1440 };
// Shows a stored interval in its largest whole unit.
function split(minutes: number): { value: number; unit: Unit } {
  if (minutes % 1440 === 0) return { value: minutes / 1440, unit: 'days' };
  if (minutes % 60 === 0) return { value: minutes / 60, unit: 'hours' };
  return { value: minutes, unit: 'minutes' };
}

export function PopupEditorScreen({
  services,
  item,
  onBack,
  onDone,
}: {
  services: AdminServices;
  item?: PopupAd;
  onBack(): void;
  onDone(message: string): void;
}) {
  const initial = split(item?.intervalMinutes ?? 1440);
  const [title, setTitle] = useState(item?.title ?? '');
  const [imageId, setImageId] = useState(item?.imageId ?? '');
  const [image, setImage] = useState<PickedImage | null>(null);
  const [intervalText, setIntervalText] = useState(String(initial.value));
  const [unit, setUnit] = useState<Unit>(initial.unit);
  const [maxViews, setMaxViews] = useState(String(item?.maxViews ?? 3));
  const [active, setActive] = useState(item?.active ?? false);
  const [fields, setFields] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'save' | 'delete' | null>(null);
  async function choose() {
    setFields(current => ({ ...current, image: '' }));
    try {
      const picked = await services.popups.pickImage();
      if (picked) setImage(picked);
    } catch (failure) {
      setFields(current => ({ ...current, image: errorMessage(failure) }));
    }
  }
  async function save() {
    if (busy) return;
    const local: FieldErrors = {};
    const value = parseWhole(intervalText);
    const minutes = value === null ? null : value * unitMinutes[unit];
    const views = parseWhole(maxViews);
    if (minutes === null || minutes < 1 || minutes > 43200)
      local.intervalMinutes = text.intervalError;
    if (views === null || views < 1 || views > 100)
      local.maxViews = text.maxViewsError;
    if (!imageId && !image) local.image = text.imageRequired;
    setFields(local);
    setError(null);
    if (Object.keys(local).length) return;
    Keyboard.dismiss();
    setBusy('save');
    try {
      let id = imageId;
      if (image) {
        id = await services.content.upload(image);
        setImageId(id);
        setImage(null);
      }
      await services.popups.save(
        {
          title,
          imageId: id,
          active,
          intervalMinutes: minutes as number,
          maxViews: views as number,
        },
        item?.id,
      );
      onDone(text.saved);
    } catch (failure) {
      if (failure instanceof ApiError) setFields(failure.fields);
      setError(errorMessage(failure));
    } finally {
      setBusy(null);
    }
  }
  async function remove() {
    if (!item || busy) return;
    if (!(await confirm(text.deleteTitle, text.deleteBody, text.remove)))
      return;
    setBusy('delete');
    setError(null);
    try {
      await services.popups.remove(item.id);
      onDone(text.deleted);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(null);
    }
  }
  const disabled = !!busy;
  const preview = image
    ? { uri: image.uri }
    : imageId
    ? services.content.imageSource(imageId)
    : null;
  return (
    <Screen>
      <BackLink label={copy.admin.common.back} onPress={onBack} />
      <PageHeader
        eyebrow={copy.admin.content.eyebrow}
        title={item ? text.editTitle : text.createTitle}
      />
      <View style={adminStyles.form}>
        <Field
          label={copy.admin.content.titleField}
          value={title}
          onChangeText={setTitle}
          error={fields.title}
          maxLength={120}
          editable={!disabled}
        />
        <View style={adminStyles.form}>
          <Text style={styles.label}>{copy.admin.content.image}</Text>
          {preview ? (
            <AdminImage
              source={preview}
              label={title || copy.admin.content.image}
              style={styles.preview}
            />
          ) : null}
          <SmallButton
            label={
              preview
                ? copy.admin.content.changeImage
                : copy.admin.content.chooseImage
            }
            icon={ImagePlus}
            onPress={choose}
            disabled={disabled}
          />
          {fields.image ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {fields.image}
            </Text>
          ) : (
            <Text style={adminStyles.rowMeta}>
              {image
                ? copy.admin.content.newImage
                : item && !image
                ? text.formats[item.format] + ' · ' + text.sizes
                : text.sizes}
            </Text>
          )}
        </View>
        <Field
          label={text.interval}
          value={intervalText}
          onChangeText={setIntervalText}
          error={fields.intervalMinutes}
          keyboardType="number-pad"
          maxLength={5}
          editable={!disabled}
        />
        <Choices<Unit>
          label={text.unit}
          value={unit}
          onChange={setUnit}
          disabled={disabled}
          options={(Object.keys(unitMinutes) as Unit[]).map(value => ({
            value,
            label: text.units[value],
          }))}
        />
        <Field
          label={text.maxViews}
          value={maxViews}
          onChangeText={setMaxViews}
          error={fields.maxViews}
          keyboardType="number-pad"
          maxLength={3}
          editable={!disabled}
        />
        <ToggleRow
          label={text.active}
          value={active}
          onChange={setActive}
          disabled={disabled}
        />
        <ErrorBanner message={error} />
        <Button
          label={copy.admin.common.save}
          onPress={save}
          loading={busy === 'save'}
          disabled={busy === 'delete'}
        />
        {item ? (
          <SmallButton
            label={text.remove}
            tone="danger"
            icon={Trash}
            onPress={remove}
            loading={busy === 'delete'}
            disabled={busy === 'save'}
          />
        ) : null}
      </View>
    </Screen>
  );
}
const styles = StyleSheet.create({
  label: { fontSize: 12, fontWeight: '600', color: colors.secondary },
  preview: { width: 160, height: 200, alignSelf: 'center' },
  error: { fontSize: 12, lineHeight: 18, color: colors.danger },
});
