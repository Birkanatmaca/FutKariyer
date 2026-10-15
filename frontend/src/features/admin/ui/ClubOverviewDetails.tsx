import { copy } from '../../../shared/lib/copy';
import type { ClubOverviewProfile } from '../domain/models';

export function ClubOverviewDetails({
  profile,
}: {
  profile: ClubOverviewProfile;
}) {
  const labels = copy.clubOverview.details;
  const fields = [
    { label: labels.description, value: profile.description },
    { label: labels.venueName, value: profile.venueName },
    { label: labels.venueAddress, value: profile.venueAddress },
    { label: labels.trainingGroundName, value: profile.trainingGroundName },
    {
      label: labels.trainingGroundAddress,
      value: profile.trainingGroundAddress,
    },
    { label: labels.trainingSchedule, value: profile.trainingSchedule },
  ];
  return (
    <section
      className="list-panel"
      aria-labelledby="club-overview-details-title"
    >
      <header className="toolbar">
        <h2 id="club-overview-details-title">{labels.title}</h2>
      </header>
      <dl className="overview-details">
        {fields.map(field => (
          <div key={field.label}>
            <dt>{field.label}</dt>
            <dd className={field.value ? undefined : 'not-entered'}>
              {field.value || copy.clubOverview.notEntered}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
