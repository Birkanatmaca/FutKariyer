import React, { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { ErrorBanner } from '../../../../shared/ui/ErrorBanner';
import { copy } from '../../../../shared/lib/copy';
import type { AdminServices } from '../../application/admin-services';
import { errorMessage, useResource } from '../../application/hooks';
import {
  Card,
  LoadState,
  SectionTitle,
  SmallButton,
  SuccessNotice,
  Tag,
  adminStyles,
  formatDate,
} from '../parts/AdminParts';
import { confirm } from '../parts/confirm';

const text = copy.admin.editor;

// Manual Pro grant/revoke for testing and support (player, club and coach accounts).
export function AccountProActions({
  services,
  accountId,
  disabled,
  onBusy,
}: {
  services: AdminServices;
  accountId: string;
  disabled: boolean;
  onBusy(value: boolean): void;
}) {
  const load = useCallback(
    () => services.accounts.proStatus(accountId),
    [services, accountId],
  );
  const status = useResource(load);
  const [action, setAction] = useState<'grant' | 'revoke' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  async function run(next: 'grant' | 'revoke') {
    if (disabled || action) return;
    const ok =
      next === 'grant'
        ? await confirm(text.grantProTitle, text.grantProBody, text.grantPro)
        : await confirm(
            text.revokeProTitle,
            text.revokeProBody,
            text.revokePro,
          );
    if (!ok) return;
    setError(null);
    setNotice(null);
    setAction(next);
    onBusy(true);
    try {
      status.setData(
        next === 'grant'
          ? await services.accounts.grantPro(accountId)
          : await services.accounts.revokePro(accountId),
      );
      setNotice(next === 'grant' ? text.proGranted : text.proRevoked);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setAction(null);
      onBusy(false);
    }
  }
  const pro = status.data;
  return (
    <Card>
      <SectionTitle title={text.proTitle} hint={text.proHelp} />
      {pro ? (
        <>
          <View style={adminStyles.wrap}>
            <Tag
              label={
                pro.active && pro.expiresAt
                  ? text.proActive(formatDate(pro.expiresAt))
                  : text.proInactive
              }
              tone={pro.active ? 'success' : 'neutral'}
            />
          </View>
          <Text style={adminStyles.rowMeta}>
            {text.proRights(pro.bonusCredits)}
          </Text>
          <View style={adminStyles.wrap}>
            <SmallButton
              label={text.grantPro}
              tone="brand"
              onPress={() => run('grant')}
              loading={action === 'grant'}
              disabled={disabled && action !== 'grant'}
            />
            <SmallButton
              label={text.revokePro}
              tone="danger"
              onPress={() => run('revoke')}
              loading={action === 'revoke'}
              disabled={!pro.active || (disabled && action !== 'revoke')}
            />
          </View>
        </>
      ) : (
        <LoadState
          loading={status.loading}
          error={status.error}
          onRetry={status.retry}
        />
      )}
      <SuccessNotice message={notice} />
      <ErrorBanner message={error} />
    </Card>
  );
}
