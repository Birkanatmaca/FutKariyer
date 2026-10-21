import type { ContentService } from '../application/content-service';
import type { ContentSection } from '../domain/models';
import { AdsPanel } from './AdsPanel';
import { NewsPanel } from './NewsPanel';

export function ContentPanel({
  section,
  service,
}: {
  section: ContentSection;
  service: ContentService;
}) {
  return section === 'ads' ? (
    <AdsPanel service={service} />
  ) : (
    <NewsPanel service={service} />
  );
}
