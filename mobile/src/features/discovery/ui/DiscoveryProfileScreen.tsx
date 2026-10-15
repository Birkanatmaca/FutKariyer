import React, { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ArrowLeft, Ellipsis } from 'lucide-react-native';
import { Screen } from '../../../shared/ui/Screen';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { Button } from '../../../shared/ui/Button';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space } from '../../../styles/tokens';
import type { DiscoveryKind, DiscoveryProfile } from '../domain/models';
import type { DiscoveryService } from '../application/discovery-service';
import { DiscoveryProfileCard } from './DiscoveryProfileCard';
import { PlayerProfileContent, playerMediaService } from '../../players';
import {
  ModerationSheet,
  moderationService,
  type ModerationTarget,
} from '../../moderation';
export function DiscoveryProfileScreen({
  service,
  token,
  kind,
  id,
  onBack,
  renderConnection,
}: {
  service: DiscoveryService;
  token: string | null;
  kind: DiscoveryKind;
  id: string;
  onBack(): void;
  // The app shell supplies the introduction-request panel for this profile.
  renderConnection?(profile: DiscoveryProfile): React.ReactNode;
}) {
  const [profile, setProfile] = useState<DiscoveryProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [loadedRevision, setLoadedRevision] = useState(-1);
  const operation = useRef(0);
  const [followingBusy, setFollowingBusy] = useState(false),
    [followError, setFollowError] = useState<string | null>(null),
    [moderating, setModerating] = useState<ModerationTarget | null>(null);
  useFocusEffect(
    useCallback(() => {
      let current = true;
      operation.current += 1;
      setFollowingBusy(false);
      setFollowError(null);
      setProfile(null);
      setError(null);
      setLoading(true);
      const pending = token
        ? service.get(token, kind, id)
        : Promise.reject(new Error(copy.playerProfile.sessionError));
      pending
        .then(value => {
          if (current) {
            setProfile(value);
          }
        })
        .catch(failure => {
          if (current) {
            setError(
              failure instanceof Error ? failure.message : copy.form.unexpected,
            );
          }
        })
        .finally(() => {
          if (current) {
            setLoading(false);
            setLoadedRevision(revision);
          }
        });
      return () => {
        current = false;
        operation.current += 1;
      };
    }, [service, token, kind, id, revision]),
  );
  async function follow() {
    if (!token || !profile || followingBusy) return;
    const current = operation.current;
    const next = !profile.isFollowing;
    setFollowingBusy(true);
    setFollowError(null);
    try {
      await service.follow(token, kind, id, next);
      if (operation.current === current)
        setProfile(value => (value ? { ...value, isFollowing: next } : value));
    } catch (failure) {
      if (operation.current === current)
        setFollowError(
          failure instanceof Error ? failure.message : copy.form.unexpected,
        );
    } finally {
      if (operation.current === current) setFollowingBusy(false);
    }
  }
  return (
    <Screen>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.form.back}
          onPress={onBack}
          style={styles.back}
        >
          <ArrowLeft color={colors.text} size={20} />
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>
          {copy.discover.profileTitle}
        </Text>
        {token && profile ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.moderation.more(profile.fullName)}
            onPress={() =>
              setModerating({
                kind: 'user',
                id: profile.id,
                userId: profile.id,
                name: profile.fullName,
              })
            }
            style={styles.back}
          >
            <Ellipsis color={colors.text} size={20} />
          </Pressable>
        ) : null}
      </View>
      {loading || loadedRevision !== revision ? (
        <ActivityIndicator color={colors.brand} />
      ) : error ? (
        <>
          <ErrorBanner message={error} />
          <Button
            label={copy.form.retry}
            onPress={() => setRevision(value => value + 1)}
          />
        </>
      ) : (
        profile && (
          <>
            <Button
              label={
                profile.isFollowing
                  ? copy.discover.unfollow
                  : copy.discover.follow
              }
              secondary={profile.isFollowing}
              loading={followingBusy}
              onPress={follow}
            />
            <ErrorBanner message={followError} />
            {renderConnection?.(profile)}
            {profile.playerProfile ? (
              <PlayerProfileContent
                fullName={profile.fullName}
                profile={profile.playerProfile}
                isPro={profile.isPro}
                gallery={
                  token
                    ? {
                        token,
                        ownerId: profile.id,
                        service: playerMediaService,
                      }
                    : undefined
                }
              />
            ) : (
              <DiscoveryProfileCard profile={profile} />
            )}
            <View style={styles.section}>
              <Text style={styles.label}>{copy.discover.privacyTitle}</Text>
              <Text style={styles.helper}>{copy.discover.privacy}</Text>
            </View>
          </>
        )
      )}
      {token ? (
        <ModerationSheet
          target={moderating}
          token={token}
          service={moderationService}
          onClose={() => {
            const blocked = moderating && !profile;
            setModerating(null);
            if (blocked) onBack();
          }}
          // A blocked profile is no longer reachable; leave it when the sheet closes.
          onBlocked={() => setProfile(null)}
        />
      ) : null}
    </Screen>
  );
}
const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  back: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: colors.text, fontSize: 24, fontWeight: '800', flex: 1 },
  section: {
    gap: space.md,
    padding: space.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: { color: colors.secondary, fontSize: 13, fontWeight: '600' },
  helper: { color: colors.secondary, fontSize: 13, lineHeight: 21 },
});
