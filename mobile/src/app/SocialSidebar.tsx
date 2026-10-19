import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BadgeCheck, Search, UserSearch, X } from 'lucide-react-native';
import type {
  DiscoveryKind,
  DiscoveryProfile,
  DiscoveryService,
} from '../features/discovery';
import type { ProService, ProfileVisitors } from '../features/pro';
import type { AccountRole } from '../features/auth';
import { SidebarVisitors } from './SidebarVisitors';
import { useReducedMotion } from '../shared/lib/useReducedMotion';
import { copy } from '../shared/lib/copy';
import { KeyboardAwareScrollView, keyboardOffset } from '../shared/ui/keyboard';
import { Avatar } from '../shared/ui/Avatar';
import { avatarUrl } from '../shared/lib/avatar';
import { colors, radius, space, type } from '../styles/tokens';

const MAX_RESULTS = 5;
const MIN_LENGTH = 2;
type Person = { kind: DiscoveryKind; profile: DiscoveryProfile };

// Left panel of the Social screen (19 Oct 2026): a live people search showing
// at most five matches, and a profile visitors teaser whose identities stay
// hidden behind a Pro prompt for non-Pro accounts.
export function SocialSidebar({
  visible,
  token,
  role,
  discovery,
  pro,
  onClose,
  onOpenProfile,
  onVisitors,
  onUpgrade,
}: {
  visible: boolean;
  token: string;
  role: AccountRole;
  discovery: DiscoveryService;
  pro: ProService;
  onClose(): void;
  onOpenProfile(kind: DiscoveryKind, id: string): void;
  onVisitors(): void;
  onUpgrade(): void;
}) {
  const text = copy.social.sidebar;
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const panel = Math.min(340, width * 0.86);
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);
  const [value, setValue] = useState('');
  const [search, setSearch] = useState('');
  const [people, setPeople] = useState<Person[]>([]);
  const [searching, setSearching] = useState(false);
  const [visitors, setVisitors] = useState<ProfileVisitors | null>(null);
  const kinds: DiscoveryKind[] =
    role === 'player' ? ['players', 'clubs', 'coaches'] : ['players'];
  const kindKey = kinds.join(',');

  useEffect(() => {
    if (visible) setMounted(true);
    Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: reduced ? 0 : 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
  }, [visible, reduced, progress]);

  // Visitors are reloaded each time the panel opens; a failure hides the card.
  useEffect(() => {
    if (!visible) {
      // Cleared on close so the Pro card animates in again on the next open.
      setVisitors(null);
      return;
    }
    let current = true;
    pro.visitors(token).then(
      result => current && setVisitors(result),
      () => current && setVisitors(null),
    );
    return () => {
      current = false;
    };
  }, [visible, pro, token]);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(value.trim()), 300);
    return () => clearTimeout(timer);
  }, [value]);

  useEffect(() => {
    let current = true;
    if (search.length < MIN_LENGTH) {
      setPeople([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    Promise.allSettled(
      kindKey.split(',').map(kind =>
        discovery
          .list(token, {
            kind: kind as DiscoveryKind,
            search,
            position: '',
            dominantFoot: '',
            availability: '',
            footballType: '',
            licenseStatus: '',
            page: 1,
          })
          .then(page =>
            page.items.map(profile => ({
              kind: kind as DiscoveryKind,
              profile,
            })),
          ),
      ),
    ).then(settled => {
      if (!current) return;
      setPeople(
        settled
          .flatMap(item => (item.status === 'fulfilled' ? item.value : []))
          .slice(0, MAX_RESULTS),
      );
      setSearching(false);
    });
    return () => {
      current = false;
    };
  }, [discovery, token, search, kindKey]);

  // Close first, then navigate, so the next screen is not opened under the panel.
  const go = (action: () => void) => {
    onClose();
    action();
  };
  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.scrim, { opacity: progress }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel={text.close}
          onPress={onClose}
        />
      </Animated.View>
      <Animated.View
        style={[
          styles.panel,
          {
            width: panel,
            transform: [
              {
                translateX: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-panel, 0],
                }),
              },
            ],
          },
        ]}
      >
        <KeyboardAwareScrollView
          bottomOffset={keyboardOffset}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.inner,
            {
              paddingTop: insets.top + space.md,
              paddingBottom: insets.bottom + space.xl,
            },
          ]}
        >
          <View style={styles.header}>
            <Text accessibilityRole="header" style={styles.title}>
              {text.title}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={text.close}
              onPress={onClose}
              hitSlop={8}
              style={styles.close}
            >
              <X size={18} color={colors.text} />
            </Pressable>
          </View>

          <View style={styles.searchSection}>
            <View style={styles.sectionHead}>
              <View style={styles.sectionIcon}>
                <UserSearch size={18} color={colors.brand} />
              </View>
              <View style={styles.sectionTitles}>
                <Text accessibilityRole="header" style={styles.sectionTitle}>
                  {text.searchTitle}
                </Text>
                <Text style={styles.sectionHint}>
                  {role === 'player'
                    ? text.searchBodyAll
                    : text.searchBodyPlayers}
                </Text>
              </View>
            </View>
            <View style={styles.search}>
              <Search size={18} color={colors.muted} />
              <TextInput
                accessibilityLabel={text.searchHint}
                placeholder={
                  role === 'player'
                    ? copy.discover.placeholderAll
                    : copy.discover.placeholderPlayers
                }
                placeholderTextColor={colors.muted}
                value={value}
                onChangeText={setValue}
                autoCorrect={false}
                autoCapitalize="words"
                returnKeyType="search"
                style={styles.input}
              />
              {value ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={copy.discover.clearSearch}
                  onPress={() => setValue('')}
                  hitSlop={8}
                >
                  <X size={16} color={colors.muted} />
                </Pressable>
              ) : null}
            </View>

            {search.length >= MIN_LENGTH ? (
              <View style={styles.results}>
                {searching && !people.length ? (
                  <ActivityIndicator color={colors.brand} />
                ) : people.length ? (
                  people.map(({ kind, profile }) => (
                    <PersonRow
                      key={kind + profile.id}
                      profile={profile}
                      onPress={() => go(() => onOpenProfile(kind, profile.id))}
                    />
                  ))
                ) : (
                  <Text style={styles.empty}>{copy.discover.noResults}</Text>
                )}
              </View>
            ) : null}
          </View>

          {visitors ? <View style={styles.divider} /> : null}

          {visitors ? (
            <SidebarVisitors
              data={visitors}
              onOpen={() => go(onVisitors)}
              onUpgrade={() => go(onUpgrade)}
            />
          ) : null}
        </KeyboardAwareScrollView>
      </Animated.View>
    </Modal>
  );
}

function PersonRow({
  profile,
  onPress,
}: {
  profile: DiscoveryProfile;
  onPress(): void;
}) {
  const detail = [copy.roles[profile.role], profile.playerProfile?.position]
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={profile.fullName + ', ' + detail}
      onPress={onPress}
      style={({ pressed }) => [styles.person, pressed && styles.pressed]}
    >
      <Avatar
        name={profile.fullName}
        uri={avatarUrl(profile.id, profile.avatarVersion)}
        size={38}
        square={profile.role === 'club'}
      />
      <View style={styles.personBody}>
        <View style={styles.nameLine}>
          <Text numberOfLines={1} style={styles.personName}>
            {profile.fullName}
          </Text>
          {profile.verified ? (
            <BadgeCheck size={14} color={colors.accent} />
          ) : null}
        </View>
        <Text numberOfLines={1} style={styles.personDetail}>
          {detail}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.scrim },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.surface,
    borderRightWidth: 1,
    borderRightColor: colors.hairline,
    borderTopRightRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
    overflow: 'hidden',
  },
  inner: { paddingHorizontal: space.lg, gap: space.lg },
  searchSection: {
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  sectionIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandWash,
  },
  sectionTitles: { flex: 1, gap: 2 },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  sectionHint: { ...type.caption, color: colors.secondary },
  divider: {
    height: 1,
    backgroundColor: colors.hairline,
    marginVertical: space.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { color: colors.text, fontSize: 22, fontWeight: '800' },
  close: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.raised,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 48,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: { flex: 1, color: colors.text, fontSize: 15, paddingVertical: 0 },
  results: { gap: space.xs },
  empty: { color: colors.muted, fontSize: 13, textAlign: 'center' },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.sm,
    borderRadius: radius.md,
  },
  pressed: { opacity: 0.8 },
  personBody: { flex: 1, gap: 2 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  personName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
  },
  personDetail: { ...type.caption, color: colors.muted },
});
