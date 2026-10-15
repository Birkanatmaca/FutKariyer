import React, { useState } from 'react';
import { Keyboard, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../../shared/api/client';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { Field } from '../../../shared/ui/Field';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { Screen } from '../../../shared/ui/Screen';
import { copy } from '../../../shared/lib/copy';
import { space, colors } from '../../../styles/tokens';
import { clubArticleLimits, type ClubArticleInput } from '../domain/models';
import type { ClubService } from '../application/club-service';
import {
  clubArticleFields,
  mapServerFields,
  textLength,
  validateClubArticle,
  type FormErrors,
} from '../application/validation';
import { BackLink } from './ClubPrimitives';

const emptyInput: ClubArticleInput = { title: '', summary: '', body: '' };

const labels: Record<keyof ClubArticleInput, string> = {
  title: copy.clubNews.title,
  summary: copy.clubNews.summary,
  body: copy.clubNews.body,
};

export function ClubNewsComposeScreen({
  token,
  service,
  onBack,
  onMine,
}: {
  token: string;
  service: ClubService;
  onBack(): void;
  onMine(): void;
}) {
  const [values, setValues] = useState<ClubArticleInput>(emptyInput);
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  function change(field: keyof ClubArticleInput, value: string) {
    setValues(current => ({ ...current, [field]: value }));
    setErrors(current => {
      const next = { ...current };
      delete next[field];
      return next;
    });
    setNotice('');
  }

  async function submit() {
    if (busy) return;
    const validation = validateClubArticle(values);
    setErrors(validation);
    setFormError('');
    setNotice('');
    if (Object.keys(validation).length) return;
    Keyboard.dismiss();
    setBusy(true);
    try {
      await service.createNews(token, values);
      setValues(emptyInput);
      setNotice(copy.clubNews.submitted);
    } catch (failure) {
      if (failure instanceof ApiError) {
        setErrors(mapServerFields(failure.fields, clubArticleFields));
      }
      setFormError(
        failure instanceof Error ? failure.message : copy.form.unexpected,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <BackLink label={copy.form.back} onPress={onBack} />
      <PageHeader
        eyebrow={copy.clubNews.eyebrow}
        title={copy.clubNews.composeTitle}
        hint={copy.clubNews.composeDescription}
      />
      <View style={styles.form}>
        {clubArticleFields.map(field => {
          const { max } = clubArticleLimits[field];
          return (
            <Field
              key={field}
              label={labels[field]}
              value={values[field]}
              onChangeText={text => change(field, text)}
              multiline={field !== 'title'}
              editable={!busy}
              error={errors[field]}
              hint={copy.clubNews.counter(textLength(values[field]), max)}
            />
          );
        })}
        {formError ? <ErrorBanner message={formError} /> : null}
        {notice ? (
          <Text accessibilityRole="alert" style={styles.notice}>
            {notice}
          </Text>
        ) : null}
        <Button label={copy.clubNews.submit} loading={busy} onPress={submit} />
        <Button label={copy.clubNews.mineTitle} secondary onPress={onMine} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.lg },
  notice: { color: colors.success, fontSize: 13, lineHeight: 19 },
});
