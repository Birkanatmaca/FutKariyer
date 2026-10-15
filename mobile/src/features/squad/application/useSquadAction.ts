import { useState } from 'react';
import { ApiError } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';

// Runs one removal at a time and refreshes the list afterwards.
// A 404 means the membership already ended, so the list is refreshed then too.
export function useSquadAction(refresh: () => void) {
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function run(id: string, action: () => Promise<void>, done: string) {
    if (busyId) return;
    setBusyId(id);
    setError('');
    setNotice('');
    try {
      await action();
      setNotice(done);
      refresh();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : copy.form.unexpected,
      );
      if (failure instanceof ApiError && failure.status === 404) refresh();
    } finally {
      setBusyId('');
    }
  }
  return { busyId, error, notice, run };
}
