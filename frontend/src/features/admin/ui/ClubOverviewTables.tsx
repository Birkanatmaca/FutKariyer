import { copy } from '../../../shared/lib/copy';
import type {
  ClubOverviewApplication,
  ClubOverviewNews,
} from '../domain/models';
import { formatDate } from './overview-format';

const applicationStatusClass = {
  pending: 'pending',
  accepted: 'approved',
  rejected: 'rejected',
} as const;

export function ClubNewsTable({ items }: { items: ClubOverviewNews[] }) {
  const labels = copy.clubOverview.news;
  return (
    <section className="list-panel" aria-labelledby="club-overview-news-title">
      <header className="toolbar">
        <h2 id="club-overview-news-title">{labels.title}</h2>
      </header>
      {items.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{labels.columns.title}</th>
                <th>{labels.columns.review}</th>
                <th>{labels.columns.published}</th>
                <th>{labels.columns.date}</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.title}</strong>
                  </td>
                  <td>
                    <span className={'status-badge ' + item.reviewStatus}>
                      {labels.status[item.reviewStatus]}
                    </span>
                  </td>
                  <td>
                    {item.published
                      ? copy.clubOverview.yes
                      : copy.clubOverview.no}
                  </td>
                  <td>
                    <time dateTime={item.createdAt}>
                      {formatDate(item.createdAt)}
                    </time>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted overview-empty">{labels.empty}</p>
      )}
    </section>
  );
}

export function ClubApplicationsTable({
  items,
}: {
  items: ClubOverviewApplication[];
}) {
  const labels = copy.clubOverview.applications;
  return (
    <section
      className="list-panel"
      aria-labelledby="club-overview-applications-title"
    >
      <header className="toolbar">
        <h2 id="club-overview-applications-title">{labels.title}</h2>
      </header>
      {items.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{labels.columns.player}</th>
                <th>{labels.columns.status}</th>
                <th>{labels.columns.date}</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.playerName}</strong>
                  </td>
                  <td>
                    <span
                      className={
                        'status-badge ' + applicationStatusClass[item.status]
                      }
                    >
                      {labels.status[item.status]}
                    </span>
                  </td>
                  <td>
                    <time dateTime={item.createdAt}>
                      {formatDate(item.createdAt)}
                    </time>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted overview-empty">{labels.empty}</p>
      )}
    </section>
  );
}
