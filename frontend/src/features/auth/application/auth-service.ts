import type { AuthRepository, LoginInput } from '../domain/models';
export function createAuthService(repository: AuthRepository) {
  return {
    me: () => repository.me(),
    login: (input: LoginInput) =>
      repository.login({
        ...input,
        identifier: input.identifier.trim().toLowerCase(),
      }),
    verify: (challenge: string, code: string) =>
      repository.verify(challenge, code.replace(/\s/g, '')),
    logout: () => repository.logout(),
  };
}
export type AuthService = ReturnType<typeof createAuthService>;
