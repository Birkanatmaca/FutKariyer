import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ApiError } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import type { Gift, GiftInbox } from '../domain/models';
import type { GiftsService } from './gifts-service';

export function useGifts(service: GiftsService, token: string | null) {
  const [inbox, setInbox] = useState<GiftInbox | null>(null);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState('');
  const [loadError, setLoadError] = useState('');
  const [claimError, setClaimError] = useState('');
  const [notice, setNotice] = useState('');
  const pending = useRef(false),
    sequence = useRef(0);

  const refresh = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    const current = ++sequence.current;
    try {
      const value = await service.list(token);
      if (current !== sequence.current) return;
      setInbox(value);
      setLoadError('');
    } catch (failure) {
      if (current === sequence.current)
        setLoadError(
          failure instanceof Error ? failure.message : copy.form.unexpected,
        );
    } finally {
      if (current === sequence.current) setLoading(false);
    }
  }, [service, token]);

  useFocusEffect(
    useCallback(() => {
      pending.current = false;
      setClaimingId('');
      refresh();
      return () => {
        sequence.current++;
        pending.current = false;
      };
    }, [refresh]),
  );

  async function claim(id: string) {
    if (!token || pending.current) return;
    pending.current = true;
    setClaimingId(id);
    setClaimError('');
    setNotice('');
    // A claim supersedes any list request that started before it.
    sequence.current++;
    try {
      const value = await service.claim(token, id);
      setInbox(value);
      setNotice(
        value.result === 'claimed'
          ? copy.gifts.claimed
          : copy.gifts.alreadyClaimed,
      );
    } catch (failure) {
      setClaimError(
        failure instanceof Error ? failure.message : copy.form.unexpected,
      );
      // Expired or missing gifts: reload so the list shows the current status.
      if (
        failure instanceof ApiError &&
        (failure.status === 409 || failure.status === 404)
      )
        refresh();
    } finally {
      pending.current = false;
      setClaimingId('');
    }
  }

  const items: Gift[] = inbox?.items ?? [];
  return {
    items,
    availableCount: inbox?.availableCount ?? 0,
    loading,
    claimingId,
    error: claimError || loadError,
    notice,
    claim,
    refresh: () => refresh(),
  };
}
