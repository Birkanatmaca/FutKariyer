import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { copy } from '../../../shared/lib/copy';
import { Button } from '../../../shared/ui/Button';
import { Field } from '../../../shared/ui/Field';
import { Feedback } from '../../../shared/ui/Feedback';
import { ConfirmDialog, Modal } from '../../../shared/ui/Modal';
import type {
  ClubOption,
  League,
  LeagueDetail,
  LeagueMatch,
  LeagueTeam,
  Page,
} from '../domain/models';
import type { LeagueService } from '../application/league-service';
import { LeagueEditor } from './LeagueEditor';

const text = copy.leagues;
type Tab = 'standings' | 'fixtures' | 'teams';

function localDate(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}
function dateLabel(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('tr-TR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type Confirm =
  | { kind: 'league' }
  | { kind: 'team'; team: LeagueTeam }
  | { kind: 'match'; match: LeagueMatch };

// One league (21 Oct 2026 design): a summary header, then standings,
// fixtures grouped by round and teams in tabs; editing the league, adding a
// match or a club and every removal open in modals.
export function LeagueWorkspace({
  service,
  initial,
  onBack,
}: {
  service: LeagueService;
  initial: League;
  onBack(): void;
}) {
  const [detail, setDetail] = useState<LeagueDetail | null>(null);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('standings');
  const [editor, setEditor] = useState(false);
  const [match, setMatch] = useState<{ match?: LeagueMatch } | null>(null);
  const [clubPicker, setClubPicker] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError(null);
    service
      .detail(initial.id)
      .then(value => {
        if (current) setDetail(value);
      })
      .catch(failure => {
        if (current)
          setError(
            failure instanceof Error ? failure.message : copy.form.unexpected,
          );
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [service, initial.id, revision]);
  const reload = () => setRevision(value => value + 1);
  const league = detail?.league || initial;
  const teamById = useMemo(
    () => new Map((detail?.teams || []).map(team => [team.id, team.name])),
    [detail?.teams],
  );
  const rounds = useMemo(() => {
    const groups = new Map<number, LeagueMatch[]>();
    for (const item of detail?.matches ?? []) {
      groups.set(item.round, [...(groups.get(item.round) ?? []), item]);
    }
    return [...groups.entries()].sort(([a], [b]) => a - b);
  }, [detail?.matches]);
  const stats = detail?.statistics;

  return (
    <main className="panel-content lg">
      <button type="button" className="lg-back" onClick={onBack}>
        ← {text.back}
      </button>
      <header className="lg-hero">
        <div className="lg-hero-main">
          <p className="eyebrow">
            {text.eyebrow} · {league.season}
          </p>
          <div className="title-row">
            <h1>{league.name}</h1>
            <span className={'league-status ' + league.status}>
              {text[league.status]}
            </span>
          </div>
          {league.description && <p className="muted">{league.description}</p>}
          <p className="lg-season">
            {text.rules(league.winPoints, league.drawPoints, league.lossPoints)}
          </p>
        </div>
        <div className="action-row">
          <Button variant="secondary" onClick={() => setEditor(true)}>
            {copy.content.edit}
          </Button>
          <Button
            variant="danger"
            onClick={() => setConfirm({ kind: 'league' })}
          >
            {text.delete}
          </Button>
        </div>
      </header>
      <Feedback message={error} />

      {stats && (
        <section className="lg-stats" aria-label={text.statistics}>
          <div className="lg-stat">
            <span>{text.teamCount}</span>
            <strong>{stats.teamCount}</strong>
          </div>
          <div className="lg-stat">
            <span>{text.matchCount}</span>
            <strong>
              {stats.playedMatches}
              <small> / {stats.matchCount}</small>
            </strong>
            <span className="lg-stat-sub">
              {text.playedMatches} / {text.matchCount}
            </span>
          </div>
          <div className="lg-stat">
            <span>{text.totalGoals}</span>
            <strong>{stats.totalGoals}</strong>
            <span className="lg-stat-sub">
              {text.averageGoals}: {stats.averageGoals.toFixed(2)}
            </span>
          </div>
          <div className="lg-stat lg-stat-wide">
            <span>{text.winRate}</span>
            <ResultBar
              home={stats.homeWins}
              draw={stats.draws}
              away={stats.awayWins}
            />
          </div>
        </section>
      )}

      <div className="application-tabs" role="tablist" aria-label={league.name}>
        {(['standings', 'fixtures', 'teams'] as const).map(value => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            className="application-tab"
            onClick={() => setTab(value)}
          >
            {text.tabs[value]}
            {detail && value !== 'standings' && (
              <span className="lg-tab-count">
                {value === 'teams'
                  ? detail.teams.length
                  : detail.matches.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading && !detail ? (
        <div className="empty" role="status">
          <span className="spinner" />
          <p>{copy.form.loading}</p>
        </div>
      ) : !detail ? (
        <div className="rt-empty">
          <Button onClick={reload}>{copy.form.retry}</Button>
        </div>
      ) : tab === 'standings' ? (
        <section className="lg-panel">
          {detail.standings.length ? (
            <div className="table-scroll">
              <table className="lg-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{text.team}</th>
                    <th>{text.playedShort}</th>
                    <th>{text.winsShort}</th>
                    <th>{text.drawsShort}</th>
                    <th>{text.lossesShort}</th>
                    <th>{text.goals}</th>
                    <th>{text.goalDifference}</th>
                    <th>{text.pointsShort}</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.standings.map(row => (
                    <tr key={row.teamId}>
                      <td>
                        <span
                          className={
                            'lg-pos' +
                            (row.position === 1 ? ' lg-pos-first' : '')
                          }
                        >
                          {row.position}
                        </span>
                      </td>
                      <td>
                        <strong>{row.teamName}</strong>
                      </td>
                      <td>{row.played}</td>
                      <td>{row.wins}</td>
                      <td>{row.draws}</td>
                      <td>{row.losses}</td>
                      <td>
                        {row.goalsFor}:{row.goalsAgainst}
                      </td>
                      <td
                        className={
                          row.goalDifference > 0
                            ? 'lg-plus'
                            : row.goalDifference < 0
                            ? 'lg-minus'
                            : ''
                        }
                      >
                        {row.goalDifference > 0 ? '+' : ''}
                        {row.goalDifference}
                      </td>
                      <td>
                        <strong className="lg-points-cell">{row.points}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyTeams onAdd={() => setClubPicker(true)} />
          )}
        </section>
      ) : tab === 'fixtures' ? (
        <section className="lg-panel">
          <div className="lg-panel-head">
            <span className="muted">
              {text.scheduledMatches}: {stats?.scheduledMatches ?? 0} ·{' '}
              {text.playedMatches}: {stats?.playedMatches ?? 0}
            </span>
            <Button
              disabled={detail.teams.length < 2}
              onClick={() => setMatch({})}
            >
              + {text.newMatch}
            </Button>
          </div>
          {rounds.length ? (
            <div className="lg-rounds">
              {rounds.map(([round, matches]) => (
                <div key={round} className="lg-round">
                  <h3>{text.roundTitle(round)}</h3>
                  {matches.map(item => {
                    const played = item.homeGoals !== null;
                    return (
                      <article className="lg-match" key={item.id}>
                        <span className="lg-match-date">
                          {dateLabel(item.kickoffAt)}
                        </span>
                        <span className="lg-match-team lg-home">
                          {teamById.get(item.homeTeamId) || item.homeName}
                        </span>
                        <span
                          className={'lg-score' + (played ? ' lg-played' : '')}
                        >
                          {played
                            ? item.homeGoals + ' – ' + item.awayGoals
                            : text.vs}
                        </span>
                        <span className="lg-match-team">
                          {teamById.get(item.awayTeamId) || item.awayName}
                        </span>
                        <span className="lg-match-actions">
                          <Button
                            variant="secondary"
                            className="button-small"
                            onClick={() => setMatch({ match: item })}
                          >
                            {copy.content.edit}
                          </Button>
                          <Button
                            variant="danger"
                            className="button-small"
                            onClick={() =>
                              setConfirm({ kind: 'match', match: item })
                            }
                          >
                            {text.deleteShort}
                          </Button>
                        </span>
                      </article>
                    );
                  })}
                </div>
              ))}
            </div>
          ) : detail.teams.length < 2 ? (
            <EmptyTeams onAdd={() => setClubPicker(true)} />
          ) : (
            <div className="rt-empty">
              <p className="muted">{text.noMatches}</p>
              <Button onClick={() => setMatch({})}>+ {text.newMatch}</Button>
            </div>
          )}
        </section>
      ) : (
        <section className="lg-panel">
          <div className="lg-panel-head">
            <span className="muted">
              {text.teamCount}: {detail.teams.length}
            </span>
            <Button onClick={() => setClubPicker(true)}>
              + {text.addClub}
            </Button>
          </div>
          {detail.teams.length ? (
            <div className="lg-team-grid">
              {detail.teams.map(team => (
                <article className="lg-team" key={team.id}>
                  <span className="avatar">
                    {team.name.slice(0, 1).toLocaleUpperCase('tr-TR')}
                  </span>
                  <span className="lg-team-name">
                    <strong>{team.name}</strong>
                    {team.district && <span>{team.district}</span>}
                  </span>
                  <Button
                    variant="secondary"
                    className="button-small"
                    onClick={() => setConfirm({ kind: 'team', team })}
                  >
                    {text.remove}
                  </Button>
                </article>
              ))}
            </div>
          ) : (
            <EmptyTeams onAdd={() => setClubPicker(true)} />
          )}
        </section>
      )}

      {editor && (
        <LeagueEditor
          league={league}
          service={service}
          onClose={() => setEditor(false)}
          onDone={() => {
            setEditor(false);
            reload();
          }}
        />
      )}
      {match && detail && (
        <MatchModal
          teams={detail.teams}
          initial={match.match}
          service={service}
          leagueId={initial.id}
          onClose={() => setMatch(null)}
          onDone={() => {
            setMatch(null);
            reload();
          }}
        />
      )}
      {clubPicker && detail && (
        <ClubPicker
          service={service}
          leagueId={initial.id}
          taken={new Set(detail.teams.map(team => team.clubId))}
          onAdded={reload}
          onClose={() => setClubPicker(false)}
        />
      )}
      {confirm?.kind === 'league' && (
        <ConfirmDialog
          title={text.deleteTitle}
          message={text.deleteConfirm}
          confirm={text.delete}
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            await service.remove(initial.id);
            setConfirm(null);
            onBack();
          }}
        />
      )}
      {confirm?.kind === 'team' && (
        <ConfirmDialog
          title={text.removeTeamTitle}
          message={text.removeTeamMessage(confirm.team.name)}
          confirm={text.remove}
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            await service.removeTeam(initial.id, confirm.team.id);
            setConfirm(null);
            reload();
          }}
        />
      )}
      {confirm?.kind === 'match' && (
        <ConfirmDialog
          title={text.deleteMatchTitle}
          message={text.deleteMatchConfirm}
          confirm={text.deleteMatch}
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            await service.removeMatch(initial.id, confirm.match.id);
            setConfirm(null);
            reload();
          }}
        />
      )}
    </main>
  );
}

function EmptyTeams({ onAdd }: { onAdd(): void }) {
  return (
    <div className="rt-empty">
      <p className="muted">{text.noTeams}</p>
      <Button onClick={onAdd}>+ {text.addClub}</Button>
    </div>
  );
}

function ResultBar({
  home,
  draw,
  away,
}: {
  home: number;
  draw: number;
  away: number;
}) {
  const total = home + draw + away;
  if (!total) return <strong>—</strong>;
  const part = (n: number) => (n / total) * 100 + '%';
  return (
    <div className="lg-result">
      <div className="lg-result-bar">
        <span className="lg-result-home" style={{ width: part(home) }} />
        <span className="lg-result-draw" style={{ width: part(draw) }} />
        <span className="lg-result-away" style={{ width: part(away) }} />
      </div>
      <span className="lg-stat-sub">
        {home} / {draw} / {away}
      </span>
    </div>
  );
}

function ClubPicker({
  service,
  leagueId,
  taken,
  onAdded,
  onClose,
}: {
  service: LeagueService;
  leagueId: string;
  taken: Set<string>;
  onAdded(): void;
  onClose(): void;
}) {
  const [search, setSearch] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [page, setPage] = useState(1);
  const [clubs, setClubs] = useState<Page<ClubOption> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  useEffect(() => {
    let current = true;
    setClubs(null);
    setError(null);
    service
      .clubs(submitted, page)
      .then(value => current && setClubs(value))
      .catch(
        failure =>
          current &&
          setError(
            failure instanceof Error ? failure.message : copy.form.unexpected,
          ),
      );
    return () => {
      current = false;
    };
  }, [service, submitted, page]);
  async function add(club: ClubOption) {
    setBusy(club.id);
    setError(null);
    try {
      await service.addTeam(leagueId, club.id);
      setAdded(current => new Set(current).add(club.id));
      onAdded();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : copy.form.unexpected,
      );
    } finally {
      setBusy(null);
    }
  }
  return (
    <Modal
      title={text.addClubTitle}
      eyebrow={text.eyebrow}
      onClose={onClose}
      busy={busy !== null}
    >
      <form
        className="lg-search"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          setPage(1);
          setSubmitted(search.trim());
        }}
      >
        <input
          type="search"
          value={search}
          maxLength={80}
          autoFocus
          placeholder={text.searchClub}
          aria-label={text.searchClub}
          onChange={event => setSearch(event.target.value)}
        />
        <Button type="submit" variant="secondary">
          {text.search}
        </Button>
      </form>
      <Feedback message={error} />
      {clubs === null ? (
        <div className="empty" role="status">
          <span className="spinner" />
        </div>
      ) : clubs.items.length ? (
        <ul className="lg-club-list">
          {clubs.items.map(club => {
            const already = taken.has(club.id) || added.has(club.id);
            return (
              <li key={club.id}>
                <span className="avatar">
                  {club.fullName.slice(0, 1).toLocaleUpperCase('tr-TR')}
                </span>
                <strong>{club.fullName}</strong>
                <Button
                  className="button-small"
                  variant={already ? 'secondary' : 'primary'}
                  disabled={already || busy !== null}
                  busy={busy === club.id}
                  onClick={() => add(club)}
                >
                  {already ? '✓ ' + text.added : text.add}
                </Button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="muted">{text.noClubs}</p>
      )}
      {clubs && clubs.totalPages > 1 && (
        <footer className="pagination">
          <span>{copy.panel.page(page, clubs.totalPages)}</span>
          <div className="action-row">
            <Button
              variant="secondary"
              className="button-small"
              disabled={page <= 1}
              onClick={() => setPage(value => value - 1)}
            >
              {copy.panel.previous}
            </Button>
            <Button
              variant="secondary"
              className="button-small"
              disabled={page >= clubs.totalPages}
              onClick={() => setPage(value => value + 1)}
            >
              {copy.panel.next}
            </Button>
          </div>
        </footer>
      )}
    </Modal>
  );
}

function MatchModal({
  teams,
  initial,
  service,
  leagueId,
  onClose,
  onDone,
}: {
  teams: LeagueDetail['teams'];
  initial?: LeagueMatch;
  service: LeagueService;
  leagueId: string;
  onClose(): void;
  onDone(): void;
}) {
  const [round, setRound] = useState(initial?.round || 1);
  const [homeTeamId, setHomeTeamId] = useState(
    initial?.homeTeamId || teams[0]?.id || '',
  );
  const [awayTeamId, setAwayTeamId] = useState(
    initial?.awayTeamId || teams[1]?.id || '',
  );
  const [kickoff, setKickoff] = useState(localDate(initial?.kickoffAt || null));
  const [homeGoals, setHomeGoals] = useState(
    initial?.homeGoals == null ? '' : String(initial.homeGoals),
  );
  const [awayGoals, setAwayGoals] = useState(
    initial?.awayGoals == null ? '' : String(initial.awayGoals),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save(event?: FormEvent) {
    event?.preventDefault();
    if (busy) return;
    if (homeTeamId === awayTeamId) {
      setError(text.sameTeam);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await service.saveMatch(
        leagueId,
        {
          round,
          homeTeamId,
          awayTeamId,
          kickoffAt: kickoff ? new Date(kickoff).toISOString() : null,
          homeGoals: homeGoals === '' ? null : Number(homeGoals),
          awayGoals: awayGoals === '' ? null : Number(awayGoals),
        },
        initial?.id,
      );
      onDone();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : copy.form.unexpected,
      );
      setBusy(false);
    }
  }
  const select = (
    label: string,
    value: string,
    onChange: (value: string) => void,
  ) => (
    <label className="field">
      <span>{label}</span>
      <select
        required
        value={value}
        disabled={busy}
        onChange={event => onChange(event.target.value)}
      >
        {teams.map(team => (
          <option key={team.id} value={team.id}>
            {team.name}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <Modal
      title={initial ? text.editMatch : text.newMatch}
      eyebrow={text.fixtures}
      busy={busy}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            {copy.form.cancel}
          </Button>
          <Button busy={busy} onClick={() => save()}>
            {text.saveMatch}
          </Button>
        </>
      }
    >
      <form className="lg-match-form" onSubmit={save}>
        <Field
          label={text.round}
          type="number"
          min={1}
          max={100}
          required
          value={round}
          disabled={busy}
          onChange={event => setRound(Number(event.target.value))}
        />
        <Field
          label={text.kickoff}
          type="datetime-local"
          value={kickoff}
          disabled={busy}
          onChange={event => setKickoff(event.target.value)}
        />
        <div className="lg-scoreboard">
          <div className="lg-side">
            {select(text.homeTeam, homeTeamId, setHomeTeamId)}
            <input
              className="lg-goal"
              type="number"
              min={0}
              max={50}
              placeholder="–"
              aria-label={text.homeGoals}
              value={homeGoals}
              disabled={busy}
              onChange={event => setHomeGoals(event.target.value)}
            />
          </div>
          <span className="lg-scoreboard-vs">{text.vs}</span>
          <div className="lg-side">
            {select(text.awayTeam, awayTeamId, setAwayTeamId)}
            <input
              className="lg-goal"
              type="number"
              min={0}
              max={50}
              placeholder="–"
              aria-label={text.awayGoals}
              value={awayGoals}
              disabled={busy}
              onChange={event => setAwayGoals(event.target.value)}
            />
          </div>
        </div>
        <p className="hint lg-wide">{text.matchHint}</p>
        <button type="submit" hidden />
      </form>
      <Feedback message={error} />
    </Modal>
  );
}
