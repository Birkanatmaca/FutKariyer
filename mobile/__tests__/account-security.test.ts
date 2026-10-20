import { authRepository } from '../src/features/auth/data/auth-repository';
import { validateNewPassword } from '../src/features/auth/application/validation';
import { lastSeenLabel } from '../src/features/auth/application/session-time';
import { ApiError } from '../src/shared/api/client';
import { copy } from '../src/shared/lib/copy';

const token = 't'.repeat(43);
const user = {
  id: 'u1',
  fullName: 'Deniz Kaya',
  email: 'deniz@example.com',
  username: '',
  active: true,
  verified: false,
  role: 'player',
  city: 'Ankara',
  createdAt: '2026-10-20T10:00:00Z',
  emailVerified: true,
};

describe('account security requests (20 Oct 2026)', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });
  function respond(status: number, body?: unknown) {
    fetchMock.mockResolvedValueOnce({
      ok: status < 400,
      status,
      json: async () => body,
    });
  }
  function call(index = 0) {
    const [url, init] = fetchMock.mock.calls[index];
    return {
      url: url as string,
      method: init.method as string,
      body: init.body ? JSON.parse(init.body) : undefined,
      headers: init.headers as Record<string, string>,
    };
  }

  test('forgot and reset password', async () => {
    respond(202, { status: 'sent' });
    await authRepository.forgotPassword('deniz@example.com');
    expect(call(0)).toMatchObject({
      method: 'POST',
      body: { email: 'deniz@example.com' },
    });
    expect(call(0).url).toMatch(/\/v1\/auth\/password\/forgot$/);
    respond(200, { token, expiresAt: '2026-11-20T10:00:00Z', user });
    const session = await authRepository.resetPassword({
      email: 'deniz@example.com',
      code: '123456',
      password: 'brand-new-pass-1',
    });
    expect(session.user.id).toBe('u1');
    expect(call(1).url).toMatch(/\/v1\/auth\/password\/reset$/);
    expect(call(1).headers['X-Device']).toEqual(expect.any(String));
  });

  test('a wrong code keeps the server message', async () => {
    respond(422, {
      error: {
        code: 'code_invalid',
        message: 'Kod hatalı veya süresi dolmuş.',
        fields: { code: 'Kod hatalı veya süresi dolmuş.' },
      },
    });
    const failure = await authRepository
      .verifyEmail(token, '000000')
      .catch(e => e);
    expect(failure).toBeInstanceOf(ApiError);
    expect(failure.code).toBe('code_invalid');
    expect(failure.fields.code).toBeTruthy();
  });

  test('verify, change password and sessions', async () => {
    respond(200, { user });
    await expect(authRepository.verifyEmail(token, '123456')).resolves.toEqual(
      user,
    );
    respond(204);
    await authRepository.changePassword(token, 'old-password-1', 'new-pass-22');
    expect(call(1)).toMatchObject({
      method: 'PUT',
      body: { currentPassword: 'old-password-1', newPassword: 'new-pass-22' },
    });
    expect(call(1).headers.Authorization).toBe('Bearer ' + token);
    respond(200, {
      sessions: [
        {
          id: 'a',
          device: 'iPhone',
          createdAt: user.createdAt,
          lastSeenAt: user.createdAt,
          current: true,
          club: false,
        },
        { id: 'broken' },
      ],
    });
    const list = await authRepository.sessions(token);
    expect(list.map(item => item.id)).toEqual(['a']);
    respond(204);
    await authRepository.endSession(token, 'a/b');
    expect(call(3).url).toMatch(/\/v1\/me\/sessions\/a%2Fb$/);
    expect(call(3).method).toBe('DELETE');
    respond(204);
    await authRepository.endOtherSessions(token);
    expect(call(4).url).toMatch(/\/v1\/me\/sessions$/);
  });

  test('users from older servers without emailVerified still load', async () => {
    const older: Partial<typeof user> = { ...user };
    delete older.emailVerified;
    respond(200, { user: older });
    await expect(authRepository.me(token)).resolves.toMatchObject({ id: 'u1' });
  });
});

describe('new password rules', () => {
  test('length, byte limit and repetition', () => {
    expect(validateNewPassword('short', 'short')).toEqual({
      password: copy.form.passwordError,
    });
    expect(validateNewPassword('ğ'.repeat(40), 'ğ'.repeat(40))).toEqual({
      password: copy.form.passwordMax,
    });
    expect(validateNewPassword('long-enough-1', 'long-enough-2')).toEqual({
      repeat: copy.security.repeatError,
    });
    expect(
      validateNewPassword('long-enough-1', 'long-enough-1', 'newPassword'),
    ).toEqual({});
    expect(validateNewPassword('x', 'x', 'newPassword')).toHaveProperty(
      'newPassword',
    );
  });
});

describe('last use on Active sessions', () => {
  const now = Date.parse('2026-10-20T12:00:00Z');
  test('reads like the rest of the app', () => {
    expect(lastSeenLabel('2026-10-20T11:58:00Z', now)).toBe('az önce');
    expect(lastSeenLabel('2026-10-20T11:30:00Z', now)).toBe('30 dk önce');
    expect(lastSeenLabel('2026-10-20T07:00:00Z', now)).toBe('5 sa önce');
    expect(lastSeenLabel('2026-10-17T12:00:00Z', now)).toBe('3 gün önce');
  });
});
