import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { Screen } from '../../../shared/ui/Screen';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { Button } from '../../../shared/ui/Button';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space } from '../../../styles/tokens';
import type { ProfileCounts } from './PlayerProfileHeader';
import type { ProfilePostsSlot } from './PlayerMediaGallery';
import type { PlayerProfileService } from '../application/profile-service';
import type { PlayerMediaService } from '../application/media-service';
import { usePlayerProfile } from '../application/usePlayerProfile';
import { PlayerProfileContent } from './PlayerProfileContent';
import { ProfileShareSheet } from './ProfileShareSheet';
import type { ProfileSharer } from '../application/profile-share';

export function PlayerOverviewScreen({
  fullName,
  token,
  service,
  onEdit,
  onBack,
  counts,
  posts,
  isPro = false,
  userId,
  media,
  avatarUri,
  sharer,
}: {
  fullName: string;
  // The owner's id and gallery service enable uploads on the own profile.
  userId?: string;
  media?: PlayerMediaService;
  isPro?: boolean;
  token: string | null;
  service: PlayerProfileService;
  onEdit(): void;
  onBack?(): void;
  counts?: ProfileCounts | null;
  posts?: ProfilePostsSlot;
  avatarUri?: string;
  // Own profile only: shares the player card to other apps.
  sharer?: ProfileSharer;
}) {
  const { profile, error, loading, retry } = usePlayerProfile(service, token);
  const [sharing, setSharing] = useState(false);
  return (
    <Screen>
      {onBack && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.form.back}
          style={styles.back}
          onPress={onBack}
        >
          <ArrowLeft color={colors.text} size={20} />
        </Pressable>
      )}
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
            onShare={sharer ? () => setSharing(true) : undefined}
            avatarSource={avatarUri ? { uri: avatarUri } : undefined}
            counts={counts}
            posts={posts}
            isPro={isPro}
            gallery={
              token && userId && media
                ? { token, ownerId: userId, service: media, editable: true }
                : undefined
            }
          />
        )
      )}
      {profile && sharer ? (
        <ProfileShareSheet
          visible={sharing}
          onClose={() => setSharing(false)}
          sharer={sharer}
          fullName={fullName}
          profile={profile}
          counts={counts}
          avatarUri={avatarUri}
          isPro={isPro}
        />
      ) : null}
    </Screen>
  );
}
const styles = StyleSheet.create({
  back: {
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
