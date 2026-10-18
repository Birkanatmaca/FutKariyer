import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ApiError, request } from '../src/shared/api/client';
import { squadRepository } from '../src/features/squad/data/http-squad-repository';
import type {
  Membership,
  SquadMember,
} from '../src/features/squad/domain/models';
import { listingsRepository } from '../src/features/listings/data/http-listings-repository';
import { createListingsService } from '../src/features/listings/application/listings-service';
import type { ListingsService } from '../src/features/listings/application/listings-service';
import {
  applyErrorMessage,
  isFinalApplyError,
  listingFieldErrors,
  validateListing,
} from '../src/features/listings/application/validation';
import type { Listing } from '../src/features/listings/domain/models';
import { ListingDetailScreen } from '../src/features/listings/ui/ListingDetailScreen';
import { ListingForm } from '../src/features/listings/ui/ListingForm';
import { NotificationsScreen } from '../src/features/notifications/ui/NotificationsScreen';
import type { NotificationsService } from '../src/features/notifications/application/notification-service';
import { copy } from '../src/shared/lib/copy';

jest.mock('../src/shared/api/client', () => ({
  ...jest.requireActual('../src/shared/api/client'),
  request: jest.fn(),
}));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (effect: () => void) =>
    jest.requireActual('react').useEffect(effect, [effect]),
}));
jest.mock('../src/features/auth', () => ({ useAuth: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('lucide-react-native', () => ({
  ArrowLeft: () => null,
  ArrowRight: () => null,
  ArrowUpRight: () => null,
  Bell: () => null,
  CalendarDays: () => null,
  Check: () => null,
  CheckCheck: () => null,
  ChevronLeft: () => null,
  ChevronRight: () => null,
  CircleAlert: () => null,
  ClipboardList: () => null,
  CreditCard: () => null,
  Eye: () => null,
  EyeOff: () => null,
  Gift: () => null,
  Handshake: () => null,
  MapPin: () => null,
  Megaphone: () => null,
  Newspaper: () => null,
  RefreshCw: () => null,
  Shield: () => null,
  Sparkles: () => null,
  Trophy: () => null,
  X: () => null,
  CircleCheck: () => null,
  Medal: () => null,
  Trash2: () => null,
  UserPlus: () => null,
}));

const mockedRequest = request as jest.MockedFunction<typeof request>;
const id = (n: number) => n.toString(16).padStart(32, '0');
const stamp = '2026-10-13T10:00:00Z';
const text = copy.listings;

const member: SquadMember = {
  playerId: id(1),
  name: 'Ali Yılmaz',
  position: 'Stoper',
  footballType: 'amateur',
  joinedAt: stamp,
};
const membership: Membership = {
  clubId: id(2),
  clubName: 'Örnek Spor',
  district: 'Çankaya',
  joinedAt: stamp,
};
const listing: Listing = {
  id: id(3),
  clubId: id(2),
  clubName: 'Örnek Spor',
  district: 'Çankaya',
  footballType: 'amateur',
  title: 'Sol bek aranıyor',
  position: 'Sol bek',
  description: 'Hafta içi iki antrenman.',
  status: 'open',
  createdAt: stamp,
  closedAt: null,
};
const quota = {
  included: 3 as const,
  purchased: 0,
  earned: 1,
  pro: 0,
  used: 2,
  remaining: 2,
  limit: 4,
};
const joinRequest = {
  id: id(4),
  status: 'pending',
  createdAt: stamp,
  updatedAt: stamp,
};

function texts(root: ReactTestRenderer) {
  return root.root
    .findAll(node => typeof node.props.children === 'string')
    .map(node => node.props.children as string);
}

function button(root: ReactTestRenderer, label: string) {
  return root.root.findAll(
    node =>
      node.props.accessibilityRole === 'button' &&
      node.props.accessibilityLabel === label &&
      typeof node.props.onPress === 'function',
  )[0];
}

beforeEach(() => {
  mockedRequest.mockReset();
});

describe('squad repository validation', () => {
  it('accepts a valid squad and rejects malformed members', async () => {
    mockedRequest.mockResolvedValueOnce({ items: [member] });
    await expect(squadRepository.squad('t')).resolves.toEqual([member]);
    for (const payload of [
      { items: [{ ...member, footballType: 'futsal' }] },
      { items: [{ ...member, playerId: 'abc' }] },
      { items: [{ ...member, joinedAt: 'yesterday' }] },
      {},
    ]) {
      mockedRequest.mockResolvedValueOnce(payload);
      await expect(squadRepository.squad('t')).rejects.toBeInstanceOf(ApiError);
    }
  });

  it('accepts valid memberships and rejects malformed ones', async () => {
    mockedRequest.mockResolvedValueOnce({ items: [membership] });
    await expect(squadRepository.memberships('t')).resolves.toEqual([
      membership,
    ]);
    for (const payload of [
      { items: [{ ...membership, clubName: null }] },
      { items: [{ ...membership, clubId: 'A'.repeat(32) }] },
      { items: null },
    ]) {
      mockedRequest.mockResolvedValueOnce(payload);
      await expect(squadRepository.memberships('t')).rejects.toBeInstanceOf(
        ApiError,
      );
    }
  });

  it('sends removals as DELETE requests', async () => {
    mockedRequest.mockResolvedValue(undefined);
    await squadRepository.removeMember('t', member.playerId);
    await squadRepository.leaveClub('t', membership.clubId);
    expect(mockedRequest.mock.calls).toEqual([
      ['/v1/me/squad/' + member.playerId, { method: 'DELETE', token: 't' }],
      [
        '/v1/me/memberships/' + membership.clubId,
        { method: 'DELETE', token: 't' },
      ],
    ]);
  });
});

describe('listing repository validation', () => {
  const page = (items: unknown[], total = items.length) => ({
    items,
    page: 1,
    pageSize: 20,
    total,
    totalPages: Math.ceil(total / 20),
  });

  it('accepts an open listing page and sends the football type filter', async () => {
    mockedRequest.mockResolvedValueOnce(page([listing], 21));
    await expect(listingsRepository.open('t', 1, 'amateur')).resolves.toEqual(
      page([listing], 21),
    );
    expect(mockedRequest).toHaveBeenCalledWith(
      '/v1/listings?page=1&footballType=amateur',
      { token: 't' },
    );
  });

  it('rejects malformed listing pages', async () => {
    for (const payload of [
      page([{ ...listing, status: 'closed', closedAt: stamp }]),
      page([{ ...listing, footballType: 'futsal' }]),
      page([{ ...listing, closedAt: 'never' }]),
      { ...page([listing]), totalPages: 3 },
      { ...page([listing]), pageSize: 50 },
    ]) {
      mockedRequest.mockResolvedValueOnce(payload);
      await expect(listingsRepository.open('t', 1, '')).rejects.toBeInstanceOf(
        ApiError,
      );
    }
  });

  it('checks the detail id and the club application counts', async () => {
    mockedRequest.mockResolvedValueOnce({ listing });
    await expect(listingsRepository.detail('t', listing.id)).resolves.toEqual(
      listing,
    );
    mockedRequest.mockResolvedValueOnce({ listing });
    await expect(listingsRepository.detail('t', id(9))).rejects.toBeInstanceOf(
      ApiError,
    );

    const own = { ...listing, applications: 2 };
    mockedRequest.mockResolvedValueOnce({ items: [own] });
    await expect(listingsRepository.mine('t')).resolves.toEqual([own]);
    mockedRequest.mockResolvedValueOnce({ items: [listing] });
    await expect(listingsRepository.mine('t')).rejects.toBeInstanceOf(ApiError);
  });

  it('validates the apply and create responses', async () => {
    mockedRequest.mockResolvedValueOnce({ request: joinRequest, quota });
    await expect(listingsRepository.apply('t', listing.id)).resolves.toEqual({
      request: joinRequest,
      quota,
    });
    mockedRequest.mockResolvedValueOnce({
      request: joinRequest,
      quota: { ...quota, remaining: 9 },
    });
    await expect(
      listingsRepository.apply('t', listing.id),
    ).rejects.toBeInstanceOf(ApiError);

    mockedRequest.mockResolvedValueOnce({ listing, notifiedPlayers: 12 });
    await expect(
      listingsRepository.create('t', {
        title: listing.title,
        position: '',
        description: '',
      }),
    ).resolves.toEqual({ listing, notifiedPlayers: 12 });
    mockedRequest.mockResolvedValueOnce({ listing, notifiedPlayers: -1 });
    await expect(
      listingsRepository.create('t', {
        title: listing.title,
        position: '',
        description: '',
      }),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('treats a missing listing as closed when resolving a notification', async () => {
    const service = createListingsService(listingsRepository);
    mockedRequest.mockRejectedValueOnce(new ApiError('Yok', 404));
    await expect(service.findOpen('t', listing.id)).resolves.toBeNull();
    mockedRequest.mockRejectedValueOnce(new ApiError('Ağ', 0));
    await expect(service.findOpen('t', listing.id)).rejects.toBeInstanceOf(
      ApiError,
    );
  });
});

describe('listing form', () => {
  it('validates the title and the optional field limits', () => {
    expect(
      validateListing({ title: 'Ab', position: '', description: '' }),
    ).toEqual({});
    expect(
      Object.keys(
        validateListing({
          title: 'a',
          position: 'a'.repeat(41),
          description: 'a'.repeat(1001),
        }),
      ),
    ).toEqual(['title', 'position', 'description']);
  });

  it('maps 422 field errors onto the form fields only', () => {
    const failure = new ApiError('Doğrulama hatası', 422, {
      title: 'Başlık 2-120 karakter olmalı.',
      listing: 'Geçerli bir ilan gönder.',
    });
    expect(listingFieldErrors(failure)).toEqual({
      title: 'Başlık 2-120 karakter olmalı.',
    });
    expect(listingFieldErrors(new ApiError('Çok fazla', 409))).toEqual({});
  });

  it('shows a 422 field error inline under the field', async () => {
    const service = {
      create: jest.fn().mockRejectedValue(
        new ApiError('Doğrulama hatası', 422, {
          position: 'Mevki en fazla 40 karakter olabilir.',
        }),
      ),
    } as unknown as ListingsService;
    let root!: ReactTestRenderer;
    await act(async () => {
      root = create(
        <ListingForm
          token="t"
          service={service}
          onCreated={jest.fn()}
          onCancel={jest.fn()}
        />,
      );
    });
    const title = root.root.findAll(
      node =>
        node.props.accessibilityLabel === text.formTitle &&
        typeof node.props.onChangeText === 'function',
    )[0];
    await act(async () => title.props.onChangeText('Sol bek aranıyor'));
    await act(async () => button(root, text.publish).props.onPress());
    expect(service.create).toHaveBeenCalledWith('t', {
      title: 'Sol bek aranıyor',
      position: '',
      description: '',
    });
    expect(texts(root)).toContain('Mevki en fazla 40 karakter olabilir.');
    expect(texts(root)).toContain('Doğrulama hatası');
  });
});

describe('listing apply', () => {
  it('turns apply failures into user messages', () => {
    expect(applyErrorMessage(new ApiError('İlan bulunamadı.', 404))).toBe(
      text.notFound,
    );
    const duplicate = new ApiError(
      'Bu kulübe daha önce başvuru gönderdin.',
      409,
    );
    expect(applyErrorMessage(duplicate)).toBe(duplicate.message);
    expect(isFinalApplyError(duplicate)).toBe(true);
    expect(applyErrorMessage(new ApiError('', 500))).toBe(copy.form.unexpected);
    expect(isFinalApplyError(new ApiError('Ağ hatası', 0))).toBe(false);
  });

  function fakeService(apply: jest.Mock) {
    return {
      detail: jest.fn().mockResolvedValue(listing),
      apply,
    } as unknown as ListingsService;
  }

  async function mount(service: ListingsService, canApply: boolean) {
    let root!: ReactTestRenderer;
    await act(async () => {
      root = create(
        <ListingDetailScreen
          token="t"
          id={listing.id}
          service={service}
          canApply={canApply}
          onBack={jest.fn()}
        />,
      );
    });
    return root;
  }

  it('hides the apply button for accounts that are not players', async () => {
    const root = await mount(fakeService(jest.fn()), false);
    expect(texts(root)).toContain(listing.description);
    expect(button(root, text.apply)).toBeUndefined();
    expect(texts(root)).toContain(text.browseOnly);
  });

  it('applies as a player and shows the remaining rights', async () => {
    const apply = jest.fn().mockResolvedValue({ request: joinRequest, quota });
    const root = await mount(fakeService(apply), true);
    expect(texts(root)).toContain(text.applyHelp);
    await act(async () => button(root, text.apply).props.onPress());
    expect(apply).toHaveBeenCalledWith('t', listing.id);
    expect(texts(root)).toContain(text.applied);
    expect(texts(root)).toContain(text.remaining(2, 4));
    expect(button(root, text.apply)).toBeUndefined();
  });

  it('shows the 409 message and hides the button afterwards', async () => {
    const apply = jest
      .fn()
      .mockRejectedValue(
        new ApiError('Kullanılabilir takım başvuru hakkın kalmadı.', 409),
      );
    const root = await mount(fakeService(apply), true);
    await act(async () => button(root, text.apply).props.onPress());
    expect(texts(root)).toContain(
      'Kullanılabilir takım başvuru hakkın kalmadı.',
    );
    expect(button(root, text.apply)).toBeUndefined();
  });
});

describe('opportunity notification', () => {
  it('asks to open the listing named by the notification', async () => {
    const onOpenListing = jest.fn();
    const service = {
      list: async () => ({
        items: [
          {
            id: id(8),
            kind: 'opportunity',
            title: 'Yeni ilan',
            body: 'Örnek Spor sol bek arıyor.',
            resourceId: listing.id,
            createdAt: stamp,
            readAt: stamp,
          },
        ],
        page: 1,
        pageSize: 20,
        total: 1,
        totalPages: 1,
        unreadCount: 0,
      }),
    } as unknown as NotificationsService;
    let root!: ReactTestRenderer;
    await act(async () => {
      root = create(
        <NotificationsScreen
          token="t"
          service={service}
          onBack={jest.fn()}
          onOpenListing={onOpenListing}
        />,
      );
    });
    await act(async () =>
      button(root, 'Yeni ilan, Örnek Spor sol bek arıyor.').props.onPress(),
    );
    expect(onOpenListing).toHaveBeenCalledWith(listing.id);
  });
});
