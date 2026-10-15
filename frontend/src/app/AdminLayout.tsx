import type { PropsWithChildren } from 'react';
import { Brand } from '../shared/ui/Brand';
import { Button } from '../shared/ui/Button';
import { copy } from '../shared/lib/copy';
import type { Account } from '../shared/domain/account';
import type { PanelSection } from './useAdminRoute';
export function AdminLayout({
  section,
  onSection,
  user,
  onLogout,
  logoutBusy,
  logoutError,
  badges = {},
  children,
}: PropsWithChildren<{
  section: PanelSection;
  onSection(section: PanelSection): void;
  user: Account;
  onLogout(): void;
  logoutBusy: boolean;
  logoutError: string | null;
  badges?: Partial<Record<PanelSection, number>>;
}>) {
  return (
    <div className="admin-layout">
      <aside className="sidebar">
        <Brand />
        <p className="sidebar-label">{copy.panel.eyebrow}</p>
        <nav aria-label={copy.panel.eyebrow}>
          {(
            [
              'users',
              'clubs',
              'applications',
              'ads',
              'news',
              'leagues',
              'payments',
              'gifts',
              'announcements',
            ] as const
          ).map(value => (
            <a
              key={value}
              href={'/securityadmin/' + value}
              aria-current={section === value ? 'page' : undefined}
              onClick={event => {
                if (
                  event.button === 0 &&
                  !event.ctrlKey &&
                  !event.metaKey &&
                  !event.shiftKey &&
                  !event.altKey
                ) {
                  event.preventDefault();
                  onSection(value);
                }
              }}
            >
              <span aria-hidden="true">
                {value === 'users'
                  ? '◎'
                  : value === 'clubs'
                  ? '▱'
                  : value === 'ads'
                  ? '▧'
                  : value === 'leagues'
                  ? '🏆'
                  : value === 'payments'
                  ? '₺'
                  : value === 'gifts'
                  ? '🎁'
                  : value === 'announcements'
                  ? '📣'
                  : value === 'applications'
                  ? '📝'
                  : '▤'}
              </span>
              {copy.panel[value]}
              {!!badges[value] && (
                <span
                  className="nav-badge"
                  aria-label={copy.panel.pendingBadge(badges[value] ?? 0)}
                >
                  {badges[value]}
                </span>
              )}
              <span className="nav-arrow" aria-hidden="true">
                ↗
              </span>
            </a>
          ))}
        </nav>
        <div className="sidebar-account">
          <span className="avatar">{user.fullName.slice(0, 1)}</span>
          <div>
            <strong>{user.fullName}</strong>
            <span>{copy.admin}</span>
          </div>
        </div>
        <Button variant="secondary" busy={logoutBusy} onClick={onLogout}>
          {copy.panel.logout}
          <span aria-hidden="true">↗</span>
        </Button>
        {logoutError && (
          <p role="alert" className="error-banner">
            {logoutError}
          </p>
        )}
      </aside>
      {children}
    </div>
  );
}
