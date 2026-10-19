import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space } from '../../../styles/tokens';
import type { CoachCard, CoachRepository } from '../domain/models';
import { CoachFacts } from './CoachFacts';
import { Section } from './CoachPrimitives';

// A coach's football details on their discovery profile: what the coach
// chose to show (clubs see everything). Nothing renders while loading or when
// nothing is shared.
export function CoachPublicCard({
  token,
  coachId,
  service,
}: {
  token: string;
  coachId: string;
  service: CoachRepository;
}) {
  const [card, setCard] = useState<CoachCard | null>(null);
  useEffect(() => {
    let current = true;
    service
      .coachCard(token, coachId)
      .then(value => current && setCard(value))
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [service, token, coachId]);
  if (!card) return null;
  const facts = (
    <CoachFacts
      profile={card.profile}
      clubs={
        card.full || ('showClubs' in card.profile && card.profile.showClubs)
          ? card.clubs
          : []
      }
    />
  );
  return (
    <View style={styles.wrap}>
      <Section title={copy.coaches.profileTitle}>{facts}</Section>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.lg, backgroundColor: colors.bg, gap: space.md },
});
