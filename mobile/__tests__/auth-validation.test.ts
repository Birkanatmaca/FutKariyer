import {
  toRegisterInput,
  validateLogin,
  validateRegistration,
} from '../src/features/auth/application/validation';
const account = {
  fullName: 'Deniz Yılmaz',
  email: 'deniz@example.com',
  password: 'strong-password',
  role: 'player' as const,
  footballType: 'amateur' as const,
  licenseStatus: 'licensed' as const,
};
test('valid account passes; email is trimmed for validation', () => {
  expect(
    validateRegistration({ ...account, email: ' deniz@example.com ' }),
  ).toEqual({});
});
test('rejects short passwords and invalid names independently', () => {
  const errors = validateRegistration({
    ...account,
    fullName: 'X',
    password: 'short',
  });
  expect(Object.keys(errors).sort()).toEqual(['fullName', 'password']);
});
test('counts multi-byte characters against the bcrypt byte limit', () => {
  expect(
    validateRegistration({ ...account, password: 'ş'.repeat(37) }).password,
  ).toBeTruthy();
  expect(
    validateRegistration({ ...account, password: 'ş'.repeat(36) }),
  ).toEqual({});
});
test('a coach names a licence level instead of a licence status', () => {
  const coach = {
    fullName: 'Ayşe Hoca',
    email: 'ayse@example.com',
    password: 'strong-password',
    role: 'coach' as const,
    footballType: 'amateur' as const,
  };
  expect(Object.keys(validateRegistration(coach))).toEqual(['licenseLevel']);
  expect(
    validateRegistration({ ...coach, licenseLevel: 'uefa_a' as const }),
  ).toEqual({});
  expect(
    toRegisterInput({
      ...coach,
      licenseLevel: 'none',
      licenseStatus: 'licensed',
    }),
  ).toEqual({ ...coach, licenseLevel: 'none' });
});
test('login rejects empty identifier and empty password', () => {
  expect(
    Object.keys(validateLogin({ identifier: '', password: '' })).sort(),
  ).toEqual(['identifier', 'password']);
});
