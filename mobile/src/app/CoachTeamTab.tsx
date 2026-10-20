import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Shield, Trophy } from 'lucide-react-native';
import { CoachTeamView, type ClubService } from '../features/clubs';
import { TeamsScreen } from '../features/teams';
import { Brand } from '../shared/ui/Brand';
import { Screen } from '../shared/ui/Screen';
import { copy } from '../shared/lib/copy';
import { colors, radius, space } from '../styles/tokens';

type Tab = 'mine' | 'teams';
const tabs: { key: Tab; icon: typeof Shield }[] = [
  { key: 'mine', icon: Shield },
  { key: 'teams', icon: Trophy },
];

// The Saha hub's team page for a coach on a club's staff (20 Oct 2026):
// Takımım first, the usual Takımlar directory one tap away.
export function CoachTeamTab({
  token,
  clubService,
  onSwitch,
  onInvitations,
  onLeagues,
}: {
  token: string;
  clubService: ClubService;
  onSwitch(clubId: string): Promise<void>;
  onInvitations(): void;
  onLeagues(): void;
}) {
  const [tab, setTab] = useState<Tab>('mine');
  const switcher = (
    <View style={styles.segments} accessibilityRole="tablist">
      {tabs.map(({ key, icon: Icon }) => {
        const selected = key === tab;
        return (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityHint={copy.coachTeam.tabHints[key]}
            onPress={() => setTab(key)}
            style={({ pressed }) => [
              styles.segment,
              selected && styles.segmentOn,
              pressed && styles.pressed,
            ]}
          >
            <Icon size={17} color={selected ? colors.brand : colors.muted} />
            <Text style={[styles.text, selected && styles.textOn]}>
              {copy.coachTeam.tabs[key]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
  if (tab === 'teams') return <TeamsScreen header={switcher} />;
  return (
    <Screen>
      <Brand mark={false} />
      {switcher}
      <CoachTeamView
        token={token}
        service={clubService}
        onSwitch={onSwitch}
        onInvitations={onInvitations}
        onLeagues={onLeagues}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  segments: {
    flexDirection: 'row',
    padding: space.xs,
    gap: space.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.transparent,
  },
  segmentOn: { backgroundColor: colors.overlay, borderColor: colors.brandSoft },
  pressed: { opacity: 0.85 },
  text: { color: colors.muted, fontSize: 14, fontWeight: '700' },
  textOn: { color: colors.text },
});
