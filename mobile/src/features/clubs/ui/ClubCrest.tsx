import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { avatarUrl } from '../../../shared/lib/avatar';
import { colors, radius } from '../../../styles/tokens';
import { monogram } from '../application/club-center';
import type { ClubUpcomingFixture } from '../domain/models';

// A club crest: the account photo when there is one, otherwise the initials.
// The club's own crest is ringed in the brand colour.
export function ClubCrest({
  name,
  uri,
  own,
  size = 52,
}: {
  name: string;
  uri?: string;
  own: boolean;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <View
      style={[
        styles.crest,
        { width: size, height: size },
        own && styles.crestOwn,
      ]}
    >
      {uri && !failed ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <Text
          style={[
            styles.text,
            { fontSize: Math.round(size / 3) },
            own && styles.textOwn,
          ]}
        >
          {monogram(name)}
        </Text>
      )}
    </View>
  );
}

// The rival's crest in Fut Career leagues; TFF teams have no account.
export function rivalCrest(
  fixture: Pick<ClubUpcomingFixture, 'opponentId' | 'opponentAvatarVersion'>,
) {
  return fixture.opponentId
    ? avatarUrl(fixture.opponentId, fixture.opponentAvatarVersion) || undefined
    : undefined;
}

const styles = StyleSheet.create({
  crest: {
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  crestOwn: { backgroundColor: colors.brandSoft, borderColor: colors.brand },
  text: { color: colors.secondary, fontWeight: '800' },
  textOwn: { color: colors.brand },
});
