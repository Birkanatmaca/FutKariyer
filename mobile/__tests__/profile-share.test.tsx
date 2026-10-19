import React from 'react';
import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import Share from 'react-native-share';
import { PlayerProfileHeader } from '../src/features/players/ui/PlayerProfileHeader';
import { ProfileShareSheet } from '../src/features/players/ui/ProfileShareSheet';
import { profileSharer } from '../src/features/players/data/profile-share';
import type { ProfileSharer } from '../src/features/players/application/profile-share';
import type { PlayerProfile } from '../src/features/players/domain/profile';
import { copy } from '../src/shared/lib/copy';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('lucide-react-native', () => ({
  Eye: () => null,
  EyeOff: () => null,
  Pencil: () => null,
  Share: () => null,
  Share2: () => null,
  Shield: () => null,
  X: () => null,
}));

const profile: PlayerProfile = {
  position: 'Forvet',
  dominantFoot: 'right',
  experienceYears: 6,
  currentClub: '',
  availability: 'seeking_team',
  discoverable: true,
  footballType: 'amateur',
  licenseStatus: 'licensed',
  updatedAt: '2026-10-19T00:00:00Z',
};
const counts = { views: 12, followers: 6, following: 0 };

const texts = (root: ReactTestRenderer) =>
  root.root.findAllByType(Text).map(node => String(node.props.children));
const button = (root: ReactTestRenderer, label: string) =>
  root.root.find(
    node =>
      node.props.accessibilityLabel === label &&
      typeof node.props.onPress === 'function',
  );

test('the own profile shows an icon-only share button beside Profili düzenle', () => {
  const onShare = jest.fn();
  let root!: ReactTestRenderer;
  act(() => {
    root = create(
      <PlayerProfileHeader
        fullName="Birkan Atmaca"
        profile={profile}
        counts={counts}
        onEdit={jest.fn()}
        onShare={onShare}
      />,
    );
  });
  const share = button(root, copy.profileShare.open);
  expect(texts(root)).not.toContain(copy.profileShare.open);
  act(() => share.props.onPress());
  expect(onShare).toHaveBeenCalled();
});

function renderSheet(sharer: ProfileSharer, onClose = jest.fn()) {
  let root!: ReactTestRenderer;
  act(() => {
    root = create(
      <ProfileShareSheet
        visible
        onClose={onClose}
        sharer={sharer}
        fullName="Birkan Atmaca"
        profile={profile}
        counts={counts}
      />,
    );
  });
  return root;
}

test('the sheet previews the card and shares it to the chosen app', async () => {
  const share = jest.fn(() => Promise.resolve('shared' as const));
  const onClose = jest.fn();
  const root = renderSheet(
    { targets: ['instagramStory', 'whatsapp', 'more'], share },
    onClose,
  );
  const shown = texts(root);
  expect(shown).toEqual(
    expect.arrayContaining([
      'Birkan Atmaca',
      copy.profileShare.cardCta,
      copy.profileShare.instagramStory,
      copy.profileShare.whatsapp,
      copy.profileShare.more,
      copy.playerProfile.availabilities.seeking_team,
    ]),
  );
  await act(async () => {
    await button(root, copy.profileShare.whatsapp).props.onPress();
  });
  expect(share).toHaveBeenCalledWith(
    expect.anything(),
    'whatsapp',
    copy.profileShare.message('Birkan Atmaca'),
    expect.any(String),
  );
  expect(onClose).toHaveBeenCalled();
});

test('a missing app is named instead of failing silently', async () => {
  const root = renderSheet({
    targets: ['instagramStory', 'more'],
    share: () => Promise.resolve('unavailable'),
  });
  await act(async () => {
    await button(root, copy.profileShare.instagramStory).props.onPress();
  });
  expect(texts(root)).toContain(
    copy.profileShare.unavailable(copy.profileShare.instagramStory),
  );
});

test('without a Meta app id the card goes to Instagram as an image', async () => {
  const outcome = await profileSharer.share(
    { current: null },
    'instagramStory',
    'mesaj',
    '#000000',
  );
  expect(outcome).toBe('shared');
  expect(Share.shareSingle).toHaveBeenCalledWith(
    expect.objectContaining({
      social: 'instagram',
      url: 'file:///tmp/profile-card.png',
      type: 'image/png',
    }),
  );
});
