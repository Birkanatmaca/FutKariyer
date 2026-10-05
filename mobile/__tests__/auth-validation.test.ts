import {
  validateLogin,
  validateRegistration,
} from '../src/features/auth/application/validation';
const account = {
  fullName: 'Deniz Yılmaz',
  email: 'deniz@example.com',
  password: 'strong-password',
  role: 'player' as const,
  adultConfirmed: true,
};
test('valid account passes; email is trimmed for validation', () => {
  expect(
    validateRegistration({ ...account, email: ' deniz@example.com ' }),
  ).toEqual({});
});
test('rejects short passwords, invalid names and adult refusal independently', () => {
  const errors = validateRegistration({
    ...account,
    fullName: 'X',
    password: 'short',
    adultConfirmed: false,
  });
  expect(Object.keys(errors).sort()).toEqual([
    'adultConfirmed',
    'fullName',
    'password',
  ]);
});
test('counts multi-byte characters against the bcrypt byte limit', () => {
  expect(
    validateRegistration({ ...account, password: 'ş'.repeat(37) }).password,
  ).toBeTruthy();
  expect(
    validateRegistration({ ...account, password: 'ş'.repeat(36) }),
  ).toEqual({});
});
test('login rejects invalid email and empty password', () => {
  expect(
    Object.keys(validateLogin({ email: 'invalid', password: '' })).sort(),
  ).toEqual(['email', 'password']);
});
