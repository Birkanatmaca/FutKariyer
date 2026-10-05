import { copy } from '../../../shared/lib/copy';

export async function confirmSignOut(): Promise<boolean> {
  return globalThis.confirm(
    copy.profile.logoutTitle + '\n\n' + copy.profile.logoutBody,
  );
}
