import { ApiError, request } from '../src/shared/api/client';
import { accountRepository } from '../src/features/account/data/http-account-repository';
import {
  ageFrom,
  fromIsoDate,
  toIsoDate,
} from '../src/features/account/domain/models';
import { avatarUrl } from '../src/shared/lib/avatar';

jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn(),
}));
jest.mock('../src/shared/api/client', () => ({
  ...jest.requireActual('../src/shared/api/client'),
  request: jest.fn(),
}));

const profile = {
  id: 'a'.repeat(32),
  role: 'player',
  fullName: 'Ali Yılmaz',
  username: '',
  email: 'ali@example.com',
  city: 'Ankara',
  district: 'Çankaya',
  birthDate: '2004-05-17',
  bio: '',
  heightCm: 181,
  weightKg: null,
  avatarVersion: 2,
};

beforeEach(() => jest.clearAllMocks());

test('the account profile is validated at the API boundary', async () => {
  for (const bad of [
    { ...profile, role: 'admin' },
    { ...profile, birthDate: '17.05.2004' },
    { ...profile, heightCm: -1 },
    { ...profile, avatarVersion: -1 },
  ]) {
    jest.mocked(request).mockResolvedValueOnce({ profile: bad });
    await expect(accountRepository.get('s')).rejects.toBeInstanceOf(ApiError);
  }
  jest.mocked(request).mockResolvedValueOnce({ profile });
  await expect(accountRepository.get('s')).resolves.toEqual(profile);
});

test('dates convert between the form and the API', () => {
  expect(toIsoDate('7.5.2004')).toBe('2004-05-07');
  expect(toIsoDate('31.02.2004')).toBeNull();
  expect(toIsoDate('2004-05-07')).toBeNull();
  expect(fromIsoDate('2004-05-07')).toBe('07.05.2004');
  expect(ageFrom('2004-05-17', new Date(2026, 9, 19))).toBe(22);
  expect(ageFrom('2004-11-17', new Date(2026, 9, 19))).toBe(21);
});

test('avatars only have a URL when a photo exists', () => {
  expect(avatarUrl('a'.repeat(32), 0)).toBe('');
  expect(avatarUrl('a'.repeat(32), undefined)).toBe('');
  expect(avatarUrl('a'.repeat(32), 3)).toContain(
    '/v1/users/' + 'a'.repeat(32) + '/avatar?v=3',
  );
});
