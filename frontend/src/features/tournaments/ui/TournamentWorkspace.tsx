import { useCallback, useEffect, useMemo, useState } from 'react';
import { organizerCopy } from '../../../shared/lib/organizer-copy';
import { Button } from '../../../shared/ui/Button';
import { Feedback } from '../../../shared/ui/Feedback';
import { ConfirmDialog } from '../../../shared/ui/Modal';
import type { Entry, Match, TournamentTable } from '../domain/models';
import {
  actionTarget,
  groupRounds,
  isEditable,
  sortEntries,
  statusActions,
  type StatusAction,
} from '../domain/rules';
import type { TournamentService } from '../application/tournament-service';
import { FixtureModal } from './FixtureModal';
import { InviteModal } from './InviteModal';
import { MatchModal } from './MatchModal';
import { dayLabel, initial, kickoffLabel } from './format';

const text = organizerCopy.workspace;
type Tab = 'standings' | 'fixtures' | 'teams';
type Confirm =
  | { kind: 'status'; action: 'finish' | 'cancel' }
  | { kind: 'match'; match: Match }
  | { kind: 'clear' }
  | { kind: 'reject'; entry: Entry };

// One tournament: summary and status controls, then standings, fixture by
// round and teams (entries and invites) in tabs. Every edit opens a modal;
// destructive steps ask through ConfirmDialog.
export function TournamentWorkspace({
  service,
  id,
  onBack,
}: {
  service: TournamentService;
  id: string;
  onBack(): void;
}) {
  const [table, setTable] = useState<TournamentTable | null>(null);
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [tab, setTab] = useState<Tab>('standings');
  const [match, setMatch] = useState<{ match?: Match } | null>(null);
  const [fixture, setFixture] = useState(false);
  const [invite, setInvite] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const reload = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    let current = true;
    setError(null);
    Promise.all([service.table(id), service.entries(id)])
      .then(([nextTable, nextEntries]) => {
        if (!current) return;
        setTable(nextTable);
        setEntries(nextEntries);
      })
      .catch(failure => {
        if (current)
          setError(
            failure instanceof Error
              ? failure.message
              : organizerCopy.form.unexpected,
          );
      });
    return () => {
      current = false;
    };
  }, [service, id, revision]);
  const rounds = useMemo(
    () => groupRounds(table?.matches ?? []),
    [table?.matches],
  );
  const sorted = useMemo(() => sortEntries(entries ?? []), [entries]);

  async function run(key: string, action: () => Promise<void>, done?: string) {
    if (busy) return;
    setBusy(key);
    setError(null);
    setSuccess(null);
    try {
      await action();
      if (done) setSuccess(done);
      reload();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : organizerCopy.form.unexpected,
      );
    } finally {
      setBusy(null);
    }
  }
  function statusAction(action: StatusAction) {
    if (action === 'finish' || action === 'cancel') {
      setConfirm({ kind: 'status', action });
      return;
    }
    void run(
      'status',
      () => service.setStatus(id, actionTarget(action)).then(() => undefined),
      text.statusChanged,
    );
  }

  if (!table) {
    return (
      <main className="panel-content lg">
        <button type="button" className="lg-back" onClick={onBack}>
          ← {text.back}
        </button>
        {error ? (
          <div className="rt-empty">
            <Feedback message={error} />
            <Button onClick={reload}>{organizerCopy.form.retry}</Button>
          </div>
        ) : (
          <div className="empty" role="status">
            <span className="spinner" />
            <p>{organizerCopy.form.loading}</p>
          </div>
        )}
      </main>
    );
  }

  const tournament = table.tournament;
  const editable = isEditable(tournament.status);
  const played = table.matches.filter(item => item.homeGoals !== null).length;
  const unplayed = table.matches.length - played;
  const nextRound = rounds.length ? rounds[rounds.length - 1][0] : 1;

  return (
    <main className="panel-content lg">
      <button type="button" className="lg-back" onClick={onBack}>
        ← {text.back}
      </button>
      <header className="lg-hero">
        <div className="lg-hero-main">
          <p className="eyebrow">
            {organizerCopy.formats[tournament.format]}
            {tournament.district && ' · ' + tournament.district}
          </p>
          <div className="title-row">
            <h1>{tournament.name}</h1>
            <span className={'org-status org-status-' + tournament.status}>
              {organizerCopy.status[tournament.status]}
            </span>
          </div>
          <p className="lg-season">
            {organizerCopy.list.dates(
              dayLabel(tournament.startsOn),
              dayLabel(tournament.endsOn),
            )}
            {tournament.venue && ' · ' + tournament.venue}
            {tournament.status === 'open' &&
              ' · ' +
                organizerCopy.list.deadline(
                  dayLabel(tournament.applicationDeadline),
                )}
          </p>
          {tournament.description && (
            <p className="muted org-description">{tournament.description}</p>
          )}
        </div>
        {editable && (
          <div className="action-row org-status-actions">
            {statusActions(tournament.status).map(action => (
              <Button
                key={action}
                variant={
                  action === 'cancel'
                    ? 'danger'
                    : action === 'finish' || action === 'close'
                    ? 'primary'
                    : 'secondary'
                }
                busy={
                  busy === 'status' &&
                  action !== 'cancel' &&
                  action !== 'finish'
                }
                disabled={busy !== null}
                onClick={() => statusAction(action)}
              >
                {text[action]}
              </Button>
            ))}
          </div>
        )}
      </header>
      {!editable && <p className="notice org-readonly">{text.readOnly}</p>}
      <Feedback message={error} />
      <Feedback message={success} success />

      <section className="lg-stats org-stats" aria-label={tournament.name}>
        <div className="lg-stat">
          <span>{text.accepted}</span>
          <strong>
            {tournament.acceptedTeams}
            <small> / {tournament.teamCapacity}</small>
          </strong>
        </div>
        <div className="lg-stat">
          <span>{text.pending}</span>
          <strong>{tournament.pendingEntries}</strong>
        </div>
        <div className="lg-stat">
          <span>{text.matches}</span>
          <strong>
            {played}
            <small> / {table.matches.length}</small>
          </strong>
        </div>
      </section>

      <div
        className="application-tabs"
        role="tablist"
        aria-label={tournament.name}
      >
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
            {value !== 'standings' && (
              <span className="lg-tab-count">
                {value === 'teams'
                  ? entries?.length ?? 0
                  : table.matches.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'standings' ? (
        <Standings table={table} />
      ) : tab === 'fixtures' ? (
        <section className="lg-panel">
          <div className="lg-panel-head">
            <span className="muted">
              {organizerCopy.fixtures.summary(played, table.matches.length)}
            </span>
            {editable && (
              <div className="action-row">
                {table.matches.length === 0 ? (
                  <Button
                    disabled={table.teams.length < 2}
                    onClick={() => setFixture(true)}
                  >
                    {organizerCopy.fixtures.generate}
                  </Button>
                ) : (
                  unplayed > 0 && (
                    <Button
                      variant="secondary"
                      onClick={() => setConfirm({ kind: 'clear' })}
                    >
                      {organizerCopy.fixtures.clear}
                    </Button>
                  )
                )}
                <Button
                  variant={table.matches.length ? 'primary' : 'secondary'}
                  disabled={table.teams.length < 2}
                  onClick={() => setMatch({})}
                >
                  + {organizerCopy.fixtures.add}
                </Button>
              </div>
            )}
          </div>
          {rounds.length ? (
            <div className="lg-rounds">
              {rounds.map(([round, matches]) => (
                <div key={round} className="lg-round">
                  <h3>{organizerCopy.fixtures.roundTitle(round)}</h3>
                  {matches.map(item => {
                    const isPlayed = item.homeGoals !== null;
                    return (
                      <article
                        className={
                          'lg-match' + (editable ? '' : ' org-match-static')
                        }
                        key={item.id}
                      >
                        <span className="lg-match-date">
                          {kickoffLabel(item.kickoffAt) ??
                            organizerCopy.fixtures.noDate}
                          {item.venue && ' · ' + item.venue}
                        </span>
                        <span className="lg-match-team lg-home">
                          {item.homeName}
                        </span>
                        <span
                          className={
                            'lg-score' + (isPlayed ? ' lg-played' : '')
                          }
                        >
                          {isPlayed
                            ? item.homeGoals + ' – ' + item.awayGoals
                            : organizerCopy.fixtures.vs}
                        </span>
                        <span className="lg-match-team">{item.awayName}</span>
                        {editable && (
                          <span className="lg-match-actions">
                            <Button
                              variant="secondary"
                              className="button-small"
                              onClick={() => setMatch({ match: item })}
                            >
                              {organizerCopy.fixtures.editShort}
                            </Button>
                            <Button
                              variant="danger"
                              className="button-small"
                              onClick={() =>
                                setConfirm({ kind: 'match', match: item })
                              }
                            >
                              {organizerCopy.fixtures.deleteShort}
                            </Button>
                          </span>
                        )}
                      </article>
                    );
                  })}
                </div>
              ))}
            </div>
          ) : (
            <div className="rt-empty">
              <p className="muted">
                {table.teams.length < 2
                  ? organizerCopy.fixtures.needTeams
                  : organizerCopy.fixtures.noMatches}
              </p>
            </div>
          )}
        </section>
      ) : (
        <section className="lg-panel">
          <div className="lg-panel-head">
            <span className="muted">
              {organizerCopy.teams.capacity(
                tournament.acceptedTeams,
                tournament.teamCapacity,
              )}
            </span>
            {editable && (
              <Button onClick={() => setInvite(true)}>
                + {organizerCopy.teams.invite}
              </Button>
            )}
          </div>
          {sorted.length ? (
            <div className="org-entries">
              {sorted.map(entry => (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  editable={editable}
                  busy={busy}
                  onAccept={() =>
                    run('accept:' + entry.id, () =>
                      service.decide(id, entry.id, true),
                    )
                  }
                  onReject={() => setConfirm({ kind: 'reject', entry })}
                  onCancelInvite={() =>
                    run('cancel:' + entry.id, () =>
                      service.cancelInvite(id, entry.id),
                    )
                  }
                />
              ))}
            </div>
          ) : (
            <div className="rt-empty">
              <p className="muted">{organizerCopy.teams.empty}</p>
            </div>
          )}
        </section>
      )}

      {match && (
        <MatchModal
          service={service}
          tournamentId={id}
          teams={table.teams}
          initial={match.match}
          defaultRound={nextRound}
          onClose={() => setMatch(null)}
          onDone={() => {
            setMatch(null);
            reload();
          }}
        />
      )}
      {fixture && (
        <FixtureModal
          service={service}
          tournamentId={id}
          teamCount={table.teams.length}
          onClose={() => setFixture(false)}
          onDone={() => {
            setFixture(false);
            setTab('fixtures');
            reload();
          }}
        />
      )}
      {invite && (
        <InviteModal
          service={service}
          tournamentId={id}
          onClose={() => setInvite(false)}
          onDone={name => {
            setInvite(false);
            setSuccess(organizerCopy.teams.invited(name));
            reload();
          }}
        />
      )}
      {confirm?.kind === 'status' && (
        <ConfirmDialog
          title={
            confirm.action === 'finish' ? text.finishTitle : text.cancelTitle
          }
          message={
            confirm.action === 'finish'
              ? text.finishMessage
              : text.cancelMessage
          }
          confirm={confirm.action === 'finish' ? text.finish : text.cancel}
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            await service.setStatus(id, actionTarget(confirm.action));
            setConfirm(null);
            setSuccess(text.statusChanged);
            reload();
          }}
        />
      )}
      {confirm?.kind === 'match' && (
        <ConfirmDialog
          title={organizerCopy.fixtures.deleteTitle}
          message={organizerCopy.fixtures.deleteMessage(
            confirm.match.homeName,
            confirm.match.awayName,
          )}
          confirm={organizerCopy.fixtures.delete}
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            await service.removeMatch(id, confirm.match.id);
            setConfirm(null);
            reload();
          }}
        />
      )}
      {confirm?.kind === 'clear' && (
        <ConfirmDialog
          title={organizerCopy.fixtures.clearTitle}
          message={organizerCopy.fixtures.clearMessage}
          confirm={organizerCopy.fixtures.clear}
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            await service.clearFixture(id);
            setConfirm(null);
            reload();
          }}
        />
      )}
      {confirm?.kind === 'reject' && (
        <ConfirmDialog
          title={organizerCopy.teams.rejectTitle}
          message={organizerCopy.teams.rejectMessage(confirm.entry.clubName)}
          confirm={organizerCopy.teams.reject}
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            await service.decide(id, confirm.entry.id, false);
            setConfirm(null);
            reload();
          }}
        />
      )}
    </main>
  );
}

function Standings({ table }: { table: TournamentTable }) {
  const text = organizerCopy.standings;
  if (!table.standings.length)
    return (
      <section className="lg-panel">
        <div className="rt-empty">
          <p className="muted">{text.empty}</p>
        </div>
      </section>
    );
  return (
    <section className="lg-panel">
      <div className="table-scroll">
        <table className="lg-table">
          <thead>
            <tr>
              <th>#</th>
              <th>{text.team}</th>
              <th>{text.played}</th>
              <th>{text.wins}</th>
              <th>{text.draws}</th>
              <th>{text.losses}</th>
              <th>{text.goals}</th>
              <th>{text.difference}</th>
              <th>{text.points}</th>
            </tr>
          </thead>
          <tbody>
            {table.standings.map(row => (
              <tr key={row.entryId}>
                <td>
                  <span
                    className={
                      'lg-pos' + (row.position === 1 ? ' lg-pos-first' : '')
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
    </section>
  );
}

function EntryCard({
  entry,
  editable,
  busy,
  onAccept,
  onReject,
  onCancelInvite,
}: {
  entry: Entry;
  editable: boolean;
  busy: string | null;
  onAccept(): void;
  onReject(): void;
  onCancelInvite(): void;
}) {
  const text = organizerCopy.teams;
  const [open, setOpen] = useState(false);
  return (
    <article className={'org-entry org-entry-' + entry.status}>
      <div className="org-entry-head">
        <span className="avatar">{initial(entry.clubName)}</span>
        <span className="lg-team-name">
          <strong>{entry.clubName}</strong>
          <span>
            {[
              entry.clubDistrict,
              organizerCopy.teamTypes[entry.clubFootballType],
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </span>
        <span className={'org-entry-status org-entry-status-' + entry.status}>
          {text.entryStatus[entry.status]}
        </span>
      </div>
      {entry.message && <p className="org-entry-message">“{entry.message}”</p>}
      <div className="org-entry-foot">
        {entry.status === 'invited' || entry.status === 'declined' ? (
          <span />
        ) : (
          <button
            type="button"
            className="text-link org-roster-toggle"
            aria-expanded={open}
            onClick={() => setOpen(value => !value)}
          >
            {text.roster(entry.players.length)} {open ? '▴' : '▾'}
          </button>
        )}
        {editable && (
          <span className="action-row">
            {entry.status === 'pending' && (
              <>
                <Button
                  variant="secondary"
                  className="button-small"
                  disabled={busy !== null}
                  onClick={onReject}
                >
                  {text.reject}
                </Button>
                <Button
                  className="button-small"
                  busy={busy === 'accept:' + entry.id}
                  disabled={busy !== null}
                  onClick={onAccept}
                >
                  {text.accept}
                </Button>
              </>
            )}
            {entry.status === 'invited' && (
              <Button
                variant="secondary"
                className="button-small"
                busy={busy === 'cancel:' + entry.id}
                disabled={busy !== null}
                onClick={onCancelInvite}
              >
                {text.cancelInvite}
              </Button>
            )}
          </span>
        )}
      </div>
      {open &&
        (entry.players.length ? (
          <ul className="org-roster">
            {entry.players.map(player => (
              <li key={player.id}>
                <span>{player.name}</span>
                {player.position && (
                  <span className="muted">{player.position}</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="hint">{text.noPlayers}</p>
        ))}
    </article>
  );
}
