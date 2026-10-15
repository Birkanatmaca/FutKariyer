import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ArrowLeft, Settings } from 'lucide-react-native';
import { Screen } from '../../../shared/ui/Screen';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { Button } from '../../../shared/ui/Button';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space } from '../../../styles/tokens';
import type { PlayerProfileService } from '../application/profile-service';
import { usePlayerProfile } from '../application/usePlayerProfile';
import { PlayerProfileContent } from './PlayerProfileContent';

export function PlayerOverviewScreen({
  fullName,
  token,
  service,
  onEdit,
  onAccount,
  onBack,
  isPro = false,
}: {
  fullName: string;
  isPro?: boolean;
  token: string | null;
  service: PlayerProfileService;
  onEdit(): void;
  onAccount(): void;
  onBack?(): void;
}) {
  const { profile, error, loading, retry } = usePlayerProfile(service, token);
  return (
    <Screen>
      <View style={styles.toolbar}>
        {onBack && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.form.back}
            style={styles.settings}
            onPress={onBack}
          >
            <ArrowLeft color={colors.text} size={20} />
          </Pressable>
        )}
        <Text accessibilityRole="header" style={styles.title}>
          {copy.profile.title}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.playerOverview.settings}
          onPress={onAccount}
          style={styles.settings}
        >
          <Settings color={colors.text} size={22} />
        </Pressable>
      </View>
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.helper}>{copy.playerProfile.loading}</Text>
        </View>
      ) : error ? (
        <>
          <ErrorBanner message={error} />
          <Button label={copy.form.retry} onPress={retry} />
        </>
      ) : (
        profile && (
          <PlayerProfileContent
            fullName={fullName}
            profile={profile}
            onEdit={onEdit}
            isPro={isPro}
          />
        )
      )}
    </Screen>
  );
}
const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.lg,
  },
  title: { color: colors.text, fontSize: 23, fontWeight: '800', flex: 1 },
  settings: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loading: {
    minHeight: 200,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
  },
  helper: { color: colors.secondary, fontSize: 13 },
});
