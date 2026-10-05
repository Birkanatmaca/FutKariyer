import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ArrowUpRight, MapPin } from 'lucide-react-native';
import { useAuth } from '../features/auth';
import { Screen } from '../shared/ui/Screen';
import { Brand } from '../shared/ui/Brand';
import { PitchArt } from '../shared/ui/PitchArt';
import { Button } from '../shared/ui/Button';
import { copy } from '../shared/lib/copy';
import { colors, radius, space } from '../styles/tokens';
export function HomeScreen({
  onProfile,
  onDiscover,
}: {
  onProfile(): void;
  onDiscover(): void;
}) {
  const { user } = useAuth();
  return (
    <Screen>
      <View style={styles.top}>
        <Brand />
        <View style={styles.pin}>
          <MapPin size={16} color={colors.brand} />
        </View>
      </View>
      <View style={styles.welcome}>
        <Text style={styles.eyebrow}>{copy.home.greeting}</Text>
        <Text style={styles.name}>
          {user?.fullName.split(' ')[0]}
          <Text style={styles.dot}>.</Text>
        </Text>
      </View>
      <View style={styles.hero}>
        <View style={styles.art}>
          <PitchArt width={185} height={214} />
        </View>
        <View style={styles.tag}>
          <Text style={styles.tagText}>{copy.home.tag}</Text>
          <ArrowUpRight color={colors.brand} size={15} />
        </View>
        <Text style={styles.title}>{copy.home.title}</Text>
        <Text style={styles.body}>{copy.home.body}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{copy.home.profileTitle}</Text>
        <Text style={styles.cardBody}>{copy.home.profileBody}</Text>
        <Button label={copy.home.profileButton} onPress={onProfile} />
      </View>
      <View style={styles.network}>
        <Text style={styles.cardTitle}>{copy.home.networkTitle}</Text>
        <Text style={styles.cardBody}>{copy.home.networkBody}</Text>
        <Button
          label={copy.home.networkButton}
          onPress={onDiscover}
          secondary
        />
      </View>
    </Screen>
  );
}
const styles = StyleSheet.create({
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pin: {
    padding: space.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  welcome: { gap: space.sm },
  eyebrow: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2,
    color: colors.muted,
  },
  name: {
    fontSize: 38,
    color: colors.text,
    fontWeight: '800',
    letterSpacing: -1.1,
  },
  dot: { color: colors.brand },
  hero: {
    padding: space.xl,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    minHeight: 242,
    gap: space.lg,
  },
  art: {
    position: 'absolute',
    right: -60,
    bottom: -24,
    transform: [{ rotate: '14deg' }],
  },
  tag: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  tagText: {
    fontSize: 9,
    color: colors.brand,
    letterSpacing: 1.5,
    fontWeight: '700',
  },
  title: {
    fontSize: 31,
    lineHeight: 37,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -1,
  },
  body: {
    fontSize: 13,
    lineHeight: 21,
    color: colors.secondary,
    maxWidth: 245,
  },
  card: {
    gap: space.lg,
    padding: space.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.brandWash,
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  cardBody: { fontSize: 13, lineHeight: 21, color: colors.secondary },
  network: { gap: space.lg },
});
