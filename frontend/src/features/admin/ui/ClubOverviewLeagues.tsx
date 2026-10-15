import { copy } from '../../../shared/lib/copy';
import type { ClubOverviewFixture, ClubOverviewLeague } from '../domain/models';
import { formatDateTime, scoreText, signedNumber } from './overview-format';

const labels = copy.clubOverview.leagues;

export function ClubLeagueCards({
  leagues,
}: {
  leagues: ClubOverviewLeague[];
}) {
  return (
    <section
      className="list-panel"
      aria-labelledby="club-overview-leagues-title"
    >
      <header className="toolbar">
        <h2 id="club-overview-leagues-title">{labels.title}</h2>
      </header>
      {leagues.length ? (
        <ul className="overview-league-grid">
          {leagues.map(league => (
            <li key={league.leagueId}>
              <LeagueCard league={league} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted overview-empty">{labels.empty}</p>
      )}
    </section>
  );
}

function LeagueCard({ league }: { league: ClubOverviewLeague }) {
  const [next] = league.upcoming;
  return (
    <article className="overview-league">
      <header className="overview-league-header">
        <div>
          <strong>{league.leagueName}</strong>
          <span className="content-club">{league.season}</span>
        </div>
        <span
          className={
            'status-badge ' +
            (league.status === 'active' ? 'active' : 'inactive')
          }
        >
          <span className="status-dot" />
          {league.status === 'active' ? labels.active : labels.finished}
        </span>
      </header>
      <p className="muted">
        {labels.position(league.position, league.teamCount)}
      </p>
      <dl className="overview-stats">
        <div>
          <dt>{labels.points}</dt>
          <dd>{league.points}</dd>
        </div>
        <div>
          <dt>{labels.played}</dt>
          <dd>{league.played}</dd>
        </div>
        <div>
          <dt>{labels.record}</dt>
          <dd>
            {league.wins}-{league.draws}-{league.losses}
          </dd>
        </div>
        <div>
          <dt>{labels.goalDifference}</dt>
          <dd>{signedNumber(league.goalDifference)}</dd>
        </div>
      </dl>
      <div>
        <h3 className="overview-sub">{labels.recent}</h3>
        {league.recent.length ? (
          <ul className="overview-results">
            {league.recent.map(match => (
              <li key={match.id}>
                <RecentResult match={match} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">{labels.noRecent}</p>
        )}
      </div>
      <div className="overview-next">
        <h3 className="overview-sub">{labels.next}</h3>
        {next ? (
          <>
            <strong>{next.opponentName}</strong>
            <span className="muted">
              {labels.round(next.round)} ·{' '}
              {next.isHome ? labels.home : labels.away}
            </span>
            <span className="muted">
              {next.kickoffAt
                ? formatDateTime(next.kickoffAt)
                : labels.dateUnknown}
            </span>
          </>
        ) : (
          <p className="muted">{labels.noNext}</p>
        )}
      </div>
    </article>
  );
}

function RecentResult({ match }: { match: ClubOverviewFixture }) {
  if (match.result === '') {
    return null;
  }
  const score = scoreText(match.goalsFor, match.goalsAgainst);
  return (
    <span
      className={'status-badge ' + match.result}
      title={labels.resultLabels[match.result]}
    >
      {labels.results[match.result]}
      {score ? ' ' + score : ''}
    </span>
  );
}
