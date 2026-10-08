import type { AuthRepository, LoginInput } from '../domain/models';
export function createAuthService(repository: AuthRepository) {
  return {
    me: () => repository.me(),
    login: (input: LoginInput) =>
      repository.login({
        ...input,
        identifier: input.identifier.trim().toLowerCase(),
      }),
    logout: () => repository.logout(),
  };
}
export type AuthService = ReturnType<typeof createAuthService>;
