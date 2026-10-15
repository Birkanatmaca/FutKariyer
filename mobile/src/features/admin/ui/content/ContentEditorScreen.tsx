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
import type { AdminServices } from '../../application/admin-services';
import { errorMessage } from '../../application/hooks';
import { parseWhole, type FieldErrors } from '../../application/validation';
import type {
  ContentForm,
  ContentItem,
  ContentSection,
  PickedImage,
} from '../../domain/models';
import {
  AdminImage,
  SmallButton,
  ToggleRow,
  adminStyles,
} from '../parts/AdminParts';
import { confirm } from '../parts/confirm';
import { colors } from '../../../../styles/tokens';

const text = copy.admin.content;

export function ContentEditorScreen({
  services,
  section,
  item,
  onBack,
  onDone,
}: {
  services: AdminServices;
  section: ContentSection;
  item?: ContentItem;
  onBack(): void;
  onDone(message: string): void;
}) {
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
  const [order, setOrder] = useState(String(form.sortOrder));
  const [image, setImage] = useState<PickedImage | null>(null);
  const [fields, setFields] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'save' | 'delete' | null>(null);
  function change<K extends keyof ContentForm>(key: K, value: ContentForm[K]) {
    setForm(current => ({ ...current, [key]: value }));
  }
  async function choose() {
    setFields(current => ({ ...current, image: '' }));
    try {
      const picked = await services.content.pickImage();
      if (picked) setImage(picked);
    } catch (failure) {
      setFields(current => ({ ...current, image: errorMessage(failure) }));
    }
  }
  async function save() {
    if (busy) return;
    const local: FieldErrors = {};
    const sortOrder = parseWhole(order);
    if (section === 'ads' && (sortOrder === null || sortOrder > 10000))
      local.sortOrder = text.orderError;
    if (section === 'ads' && !form.imageId && !image)
      local.image = text.imageRequired;
    setFields(local);
    setError(null);
    if (Object.keys(local).length) return;
    Keyboard.dismiss();
    setBusy('save');
    try {
      let imageId = form.imageId;
      if (image) {
        imageId = await services.content.upload(image);
        change('imageId', imageId);
        setImage(null);
      }
      await services.content.save(
        section,
        { ...form, imageId, sortOrder: sortOrder ?? 0 },
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
      await services.content.remove(section, item.id);
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
    : form.imageId
    ? services.content.imageSource(form.imageId)
    : null;
  return (
    <Screen>
      <BackLink label={copy.admin.common.back} onPress={onBack} />
      <PageHeader
        eyebrow={text.eyebrow}
        title={
          section === 'ads'
            ? item
              ? text.editAd
              : text.createAd
            : item
            ? text.editNews
            : text.createNews
        }
      />
      <View style={adminStyles.form}>
        <Field
          label={text.titleField}
          value={form.title}
          onChangeText={value => change('title', value)}
          error={fields.title}
          maxLength={120}
          editable={!disabled}
        />
        <View style={adminStyles.form}>
          <Text style={styles.label}>{text.image}</Text>
          {preview ? (
            <AdminImage
              source={preview}
              label={form.title || text.image}
              style={styles.preview}
            />
          ) : null}
          <View style={adminStyles.wrap}>
            <SmallButton
              label={preview ? text.changeImage : text.chooseImage}
              icon={ImagePlus}
              onPress={choose}
              disabled={disabled}
            />
            {section === 'news' && preview ? (
              <SmallButton
                label={text.removeImage}
                tone="danger"
                onPress={() => {
                  setImage(null);
                  change('imageId', '');
                }}
                disabled={disabled}
              />
            ) : null}
          </View>
          {fields.image ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {fields.image}
            </Text>
          ) : (
            <Text style={adminStyles.rowMeta}>
              {image ? text.newImage : text.imageHint}
            </Text>
          )}
        </View>
        {section === 'ads' ? (
          <>
            <Field
              label={text.order}
              value={order}
              onChangeText={setOrder}
              error={fields.sortOrder}
              keyboardType="number-pad"
              maxLength={5}
              editable={!disabled}
            />
            <ToggleRow
              label={text.activeAd}
              value={form.active}
              onChange={value => change('active', value)}
              error={fields.active}
              disabled={disabled}
            />
          </>
        ) : (
          <>
            <Field
              label={text.summary}
              value={form.summary}
              onChangeText={value => change('summary', value)}
              error={fields.summary}
              maxLength={300}
              multiline
              editable={!disabled}
            />
            <Field
              label={text.body}
              value={form.body}
              onChangeText={value => change('body', value)}
              error={fields.body}
              maxLength={20000}
              multiline
              editable={!disabled}
            />
            <ToggleRow
              label={text.published}
              value={form.published}
              onChange={value => change('published', value)}
              error={fields.published}
              disabled={disabled}
            />
            <ToggleRow
              label={text.showOnHome}
              hint={text.homeHint}
              value={form.showOnHome}
              onChange={value => change('showOnHome', value)}
              error={fields.showOnHome}
              disabled={disabled}
            />
          </>
        )}
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
  preview: { width: '100%', height: 180 },
  error: { fontSize: 12, lineHeight: 18, color: colors.danger },
});
