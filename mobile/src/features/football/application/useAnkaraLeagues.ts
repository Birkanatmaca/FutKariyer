import { useCallback, useState } from 'react';
import type { AnkaraPicker, AnkaraQuery } from '../domain/models';
import { emptyAnkaraQuery, nextAnkaraQuery } from '../domain/rules';
import type { FootballService } from './football-service';
import { useFootballResource } from './useFootballResource';

export function useAnkaraLeagues(
  service: FootballService,
  token: string,
  enabled = true,
) {
  const [query, setQuery] = useState<AnkaraQuery>(emptyAnkaraQuery);
  const load = useCallback(
    () => service.ankara(token, query),
    [service, token, query],
  );
  const resource = useFootballResource(load, { keepData: true, enabled });
  const { data } = resource;
  const select = useCallback(
    (picker: AnkaraPicker, id: string) =>
      setQuery(nextAnkaraQuery(data, picker, id)),
    [data],
  );
  return { ...resource, query, select };
}
