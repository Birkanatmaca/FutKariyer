import { copy } from '../../../shared/lib/copy';
import { Button } from '../../../shared/ui/Button';
import { Feedback } from '../../../shared/ui/Feedback';
import type { ClubOverview } from '../domain/models';
import type { AdminService } from '../application/admin-service';
import { useClubOverview } from '../application/useClubOverview';
import { ClubOverviewDetails } from './ClubOverviewDetails';
import { ClubApplicationsTable, ClubNewsTable } from './ClubOverviewTables';
import { ClubLeagueCards } from './ClubOverviewLeagues';

export function ClubOverviewPanel({
  service,
  id,
  onBack,
}: {
  service: AdminService;
  id: string;
  onBack(): void;
}) {
  const { data, loading, error, notFound, reload } = useClubOverview(
    service,
    id,
  );
  return (
    <main className="panel-content club-overview">
      <Button
        variant="secondary"
        className="button-small overview-back"
        onClick={onBack}
      >
        <span aria-hidden="true">←</span>
        {copy.clubOverview.back}
      </Button>
      {loading ? (
        <div className="empty" role="status">
          <span className="spinner" />
          <p>{copy.form.loading}</p>
        </div>
      ) : notFound ? (
        <section className="list-panel empty">
          <h1>{copy.clubOverview.notFound}</h1>
          <p className="muted">{copy.clubOverview.notFoundBody}</p>
        </section>
      ) : error || !data ? (
        <section className="list-panel empty">
          <Feedback message={error ?? copy.form.unexpected} />
          <Button variant="secondary" onClick={reload}>
            {copy.form.retry}
          </Button>
        </section>
      ) : (
        <ClubOverviewContent data={data} />
      )}
    </main>
  );
}

function ClubOverviewContent({ data }: { data: ClubOverview }) {
  const { profile } = data;
  return (
    <>
      <header className="panel-header">
        <div>
          <p className="eyebrow">{copy.clubOverview.eyebrow}</p>
          <h1>{profile.name}</h1>
          <div className="overview-meta">
            <span
              className={
                'status-badge ' + (data.active ? 'active' : 'inactive')
              }
            >
              <span className="status-dot" />
              {data.active
                ? copy.clubOverview.active
                : copy.clubOverview.inactive}
            </span>
            <span className="count-badge">
              {copy.clubOverview.footballTypes[profile.footballType]}
            </span>
            <span className="count-badge">
              {copy.clubOverview.district}:{' '}
              {profile.district || copy.clubOverview.notEntered}
            </span>
            <span className="muted">
              {data.email || copy.clubOverview.notEntered}
            </span>
          </div>
        </div>
      </header>
      <ClubOverviewDetails profile={profile} />
      <ClubNewsTable items={data.news} />
      <ClubApplicationsTable items={data.applications} />
      <ClubLeagueCards leagues={data.leagues} />
    </>
  );
}
