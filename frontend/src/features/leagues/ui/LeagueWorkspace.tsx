import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { copy } from '../../../shared/lib/copy';
import { Button } from '../../../shared/ui/Button';
import { Field } from '../../../shared/ui/Field';
import { Feedback } from '../../../shared/ui/Feedback';
import type { League, LeagueDetail, LeagueMatch, Page } from '../domain/models';
import type { LeagueService } from '../application/league-service';
import { LeagueEditor } from './LeagueEditor';

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
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

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
  const [editor, setEditor] = useState(false);
  const [clubSearch, setClubSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [clubPage, setClubPage] = useState(1);
  const [clubs, setClubs] = useState<Page<{
    id: string;
    fullName: string;
  }> | null>(null);
  const [clubLoading, setClubLoading] = useState(false);
  const [clubError, setClubError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [matchOpen, setMatchOpen] = useState(false);
  const [matchEditing, setMatchEditing] = useState<LeagueMatch | undefined>();
  const teamById = useMemo(
    () => new Map((detail?.teams || []).map(team => [team.id, team.name])),
    [detail?.teams],
  );
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError(null);
    setDetail(null);
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
  useEffect(() => {
    let current = true;
    setClubLoading(true);
    setClubError(null);
    setClubs(null);
    service
      .clubs(submittedSearch, clubPage)
      .then(value => {
        if (!current) return;
        if (clubPage > Math.max(1, value.totalPages))
          setClubPage(Math.max(1, value.totalPages));
        else setClubs(value);
      })
      .catch(failure => {
        if (current)
          setClubError(
            failure instanceof Error ? failure.message : copy.form.unexpected,
          );
      })
      .finally(() => {
        if (current) setClubLoading(false);
      });
    return () => {
      current = false;
    };
  }, [service, submittedSearch, clubPage]);

  async function operate(action: () => Promise<unknown>, success?: () => void) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await action();
      success?.();
      setRevision(value => value + 1);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : copy.form.unexpected,
      );
    } finally {
      setBusy(false);
    }
  }
  async function addTeam(clubId: string) {
    await operate(() => service.addTeam(initial.id, clubId));
  }
  async function removeTeam(teamId: string) {
    if (!window.confirm(copy.leagues.removeTeamConfirm)) return;
    await operate(() => service.removeTeam(initial.id, teamId));
  }
  async function removeLeague() {
    if (!window.confirm(copy.leagues.deleteConfirm)) return;
    await operate(() => service.remove(initial.id), onBack);
  }
  async function removeMatch(matchId: string) {
    if (!window.confirm(copy.leagues.deleteMatchConfirm)) return;
    await operate(() => service.removeMatch(initial.id, matchId));
  }
  function openMatch(match?: LeagueMatch) {
    setMatchEditing(match);
    setMatchOpen(true);
  }
  const league = detail?.league || initial;
  return (
    <main className="panel-content">
      <button className="league-back" onClick={onBack}>
        ← {copy.leagues.back}
      </button>
      <header className="panel-header league-workspace-header">
        <div>
          <p className="eyebrow">
            {copy.leagues.eyebrow} · {league.season}
          </p>
          <div className="title-row">
            <h1>{league.name}</h1>
            <span className={'league-status ' + league.status}>
              {copy.leagues[league.status]}
            </span>
          </div>
          {league.description && <p className="muted">{league.description}</p>}
        </div>
        <div className="action-row">
          <Button variant="secondary" onClick={() => setEditor(true)}>
            {copy.leagues.edit}
          </Button>
          <Button variant="danger" onClick={removeLeague}>
            {copy.leagues.delete}
          </Button>
        </div>
      </header>
      <Feedback message={error} />
      {loading ? (
        <div className="list-panel empty" role="status">
          {copy.form.loading}
        </div>
      ) : detail ? (
        <>
          <section
            className="league-stat-grid"
            aria-label={copy.leagues.statistics}
          >
            <Stat
              label={copy.leagues.teamCount}
              value={detail.statistics.teamCount}
            />
            <Stat
              label={copy.leagues.matchCount}
              value={detail.statistics.matchCount}
            />
            <Stat
              label={copy.leagues.playedMatches}
              value={detail.statistics.playedMatches}
            />
            <Stat
              label={copy.leagues.scheduledMatches}
              value={detail.statistics.scheduledMatches}
            />
            <Stat
              label={copy.leagues.totalGoals}
              value={detail.statistics.totalGoals}
            />
            <Stat
              label={copy.leagues.averageGoals}
              value={detail.statistics.averageGoals.toFixed(2)}
            />
            <Stat
              label={copy.leagues.homeWins}
              value={detail.statistics.homeWins}
            />
            <Stat label={copy.leagues.draws} value={detail.statistics.draws} />
            <Stat
              label={copy.leagues.awayWins}
              value={detail.statistics.awayWins}
            />
          </section>

          <section className="list-panel league-section">
            <header className="league-section-header">
              <div>
                <h2>{copy.leagues.teams}</h2>
                <p className="muted">{copy.leagues.addTeam}</p>
              </div>
              <span className="count-badge">{detail.teams.length}</span>
            </header>
            <form
              className="toolbar"
              onSubmit={(event: FormEvent) => {
                event.preventDefault();
                setClubPage(1);
                setSubmittedSearch(clubSearch.trim());
              }}
            >
              <div className="search-form">
                <input
                  value={clubSearch}
                  maxLength={80}
                  placeholder={copy.leagues.searchClub}
                  aria-label={copy.leagues.searchClub}
                  onChange={event => setClubSearch(event.target.value)}
                />
                <Button type="submit" disabled={clubLoading}>
                  {copy.leagues.search}
                </Button>
              </div>
            </form>
            {clubError && (
              <div className="league-inline-error">
                <Feedback message={clubError} />
              </div>
            )}
            {clubLoading ? (
              <div className="league-inline-empty">{copy.form.loading}</div>
            ) : clubs?.items.length ? (
              <div className="league-club-options">
                {clubs.items.map(club => (
                  <div className="league-club-option" key={club.id}>
                    <strong>{club.fullName}</strong>
                    <Button
                      className="button-small"
                      disabled={
                        busy ||
                        detail.teams.some(team => team.clubId === club.id)
                      }
                      onClick={() => addTeam(club.id)}
                    >
                      {copy.leagues.add}
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="league-inline-empty">{copy.leagues.noClubs}</p>
            )}
            {clubs && clubs.totalPages > 1 && (
              <footer className="pagination">
                <span>{copy.panel.page(clubPage, clubs.totalPages)}</span>
                <div className="action-row">
                  <Button
                    variant="secondary"
                    disabled={clubPage <= 1}
                    onClick={() => setClubPage(value => value - 1)}
                  >
                    {copy.panel.previous}
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={clubPage >= clubs.totalPages}
                    onClick={() => setClubPage(value => value + 1)}
                  >
                    {copy.panel.next}
                  </Button>
                </div>
              </footer>
            )}
            {detail.teams.length > 0 && (
              <div className="league-team-chips">
                {detail.teams.map(team => (
                  <div className="league-team-chip" key={team.id}>
                    <span>
                      <strong>{team.name}</strong>
                      {team.district && <small>{team.district}</small>}
                    </span>
                    <Button
                      variant="secondary"
                      className="button-small"
                      disabled={busy}
                      onClick={() => removeTeam(team.id)}
                    >
                      {copy.leagues.remove}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="list-panel league-section">
            <header className="league-section-header">
              <div>
                <h2>{copy.leagues.standings}</h2>
                <p className="muted">
                  {copy.leagues.winPoints}: {league.winPoints} ·{' '}
                  {copy.leagues.drawPoints}: {league.drawPoints} ·{' '}
                  {copy.leagues.lossPoints}: {league.lossPoints}
                </p>
              </div>
            </header>
            {detail.standings.length ? (
              <div className="table-scroll">
                <table className="league-standings">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>{copy.leagues.team}</th>
                      <th>{copy.leagues.playedShort}</th>
                      <th>{copy.leagues.winsShort}</th>
                      <th>{copy.leagues.drawsShort}</th>
                      <th>{copy.leagues.lossesShort}</th>
                      <th>{copy.leagues.goalDifference}</th>
                      <th>{copy.leagues.pointsShort}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.standings.map(row => (
                      <tr key={row.teamId}>
                        <td>{row.position}</td>
                        <td>
                          <strong>{row.teamName}</strong>
                          <small>
                            {row.goalsFor} : {row.goalsAgainst}
                          </small>
                        </td>
                        <td>{row.played}</td>
                        <td>{row.wins}</td>
                        <td>{row.draws}</td>
                        <td>{row.losses}</td>
                        <td>
                          {row.goalDifference > 0 ? '+' : ''}
                          {row.goalDifference}
                        </td>
                        <td>
                          <strong>{row.points}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="league-inline-empty">{copy.leagues.noTeams}</div>
            )}
          </section>

          <section className="list-panel league-section">
            <header className="league-section-header">
              <div>
                <h2>{copy.leagues.fixtures}</h2>
                <p className="muted">
                  {copy.leagues.scheduledMatches}:{' '}
                  {detail.statistics.scheduledMatches} ·{' '}
                  {copy.leagues.playedMatches}:{' '}
                  {detail.statistics.playedMatches}
                </p>
              </div>
              <Button
                disabled={detail.teams.length < 2}
                onClick={() => openMatch()}
              >
                {copy.leagues.newMatch}
              </Button>
            </header>
            {detail.matches.length ? (
              <div className="league-fixture-list">
                {detail.matches.map(match => (
                  <article className="league-fixture" key={match.id}>
                    <div className="league-fixture-round">
                      {copy.leagues.round} {match.round}
                      <small>{dateLabel(match.kickoffAt)}</small>
                    </div>
                    <div className="league-fixture-teams">
                      <strong>
                        {teamById.get(match.homeTeamId) || match.homeName}
                      </strong>
                      <span>
                        {match.homeGoals === null ? '—' : match.homeGoals} :{' '}
                        {match.awayGoals === null ? '—' : match.awayGoals}
                      </span>
                      <strong>
                        {teamById.get(match.awayTeamId) || match.awayName}
                      </strong>
                    </div>
                    <div className="league-fixture-actions">
                      <span className="league-status neutral">
                        {match.homeGoals === null
                          ? copy.leagues.scheduled
                          : copy.leagues.played}
                      </span>
                      <Button
                        variant="secondary"
                        className="button-small"
                        onClick={() => openMatch(match)}
                      >
                        {copy.content.edit}
                      </Button>
                      <Button
                        variant="danger"
                        className="button-small"
                        onClick={() => removeMatch(match.id)}
                      >
                        {copy.content.remove}
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="league-inline-empty">
                {detail.teams.length < 2
                  ? copy.leagues.noTeams
                  : copy.leagues.noMatches}
              </div>
            )}
          </section>
        </>
      ) : (
        <section className="list-panel empty">
          <h2>{copy.leagues.empty}</h2>
          <p>{error}</p>
          <Button onClick={() => setRevision(value => value + 1)}>
            {copy.form.retry}
          </Button>
        </section>
      )}
      {editor && (
        <LeagueEditor
          league={league}
          service={service}
          onClose={() => setEditor(false)}
          onDone={() => {
            setEditor(false);
            setRevision(value => value + 1);
          }}
        />
      )}
      {matchOpen && detail && (
        <MatchEditor
          teams={detail.teams}
          initial={matchEditing}
          service={service}
          leagueId={initial.id}
          onClose={() => setMatchOpen(false)}
          onDone={() => {
            setMatchOpen(false);
            setRevision(value => value + 1);
          }}
        />
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="league-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MatchEditor({
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
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const match = {
        round,
        homeTeamId,
        awayTeamId,
        kickoffAt: kickoff ? new Date(kickoff).toISOString() : null,
        homeGoals: homeGoals === '' ? null : Number(homeGoals),
        awayGoals: awayGoals === '' ? null : Number(awayGoals),
      };
      await service.saveMatch(leagueId, match, initial?.id);
      onDone();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : copy.form.unexpected,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="league-match-editor">
      <div className="league-section-header">
        <h3>{initial ? copy.leagues.editMatch : copy.leagues.newMatch}</h3>
        <Button variant="secondary" className="button-small" onClick={onClose}>
          {copy.form.close}
        </Button>
      </div>
      <form className="league-match-form" onSubmit={save}>
        <Field
          label={copy.leagues.round}
          type="number"
          min={1}
          max={100}
          required
          value={round}
          disabled={busy}
          onChange={event => setRound(Number(event.target.value))}
        />
        <label className="field">
          {copy.leagues.homeTeam}
          <select
            required
            value={homeTeamId}
            disabled={busy}
            onChange={event => setHomeTeamId(event.target.value)}
          >
            {teams.map(team => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          {copy.leagues.awayTeam}
          <select
            required
            value={awayTeamId}
            disabled={busy}
            onChange={event => setAwayTeamId(event.target.value)}
          >
            {teams.map(team => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </label>
        <Field
          label={copy.leagues.kickoff}
          type="datetime-local"
          value={kickoff}
          disabled={busy}
          onChange={event => setKickoff(event.target.value)}
        />
        <Field
          label={copy.leagues.homeGoals}
          type="number"
          min={0}
          max={50}
          value={homeGoals}
          disabled={busy}
          onChange={event => setHomeGoals(event.target.value)}
        />
        <Field
          label={copy.leagues.awayGoals}
          type="number"
          min={0}
          max={50}
          value={awayGoals}
          disabled={busy}
          onChange={event => setAwayGoals(event.target.value)}
        />
        <p className="hint league-match-hint">
          {copy.leagues.scheduled}: skor alanlarını boş bırak. Maç sonucu
          girilince puan durumu ve istatistikler otomatik güncellenir.
        </p>
        <Feedback message={error} />
        <div className="league-match-submit">
          <Button type="submit" busy={busy}>
            {copy.leagues.saveMatch}
          </Button>
        </div>
      </form>
    </div>
  );
}
