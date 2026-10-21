import { useEffect, useState, type PropsWithChildren } from 'react';
import { Brand } from '../shared/ui/Brand';
import { NavIcon } from '../shared/ui/NavIcon';
import { copy } from '../shared/lib/copy';
import type { Account } from '../shared/domain/account';
import type { PanelSection } from './useAdminRoute';

// The menu in groups (21 Oct 2026): accounts, content, football, revenue
// and security & monitoring.
const groups: { key: keyof typeof copy.panel.groups; items: PanelSection[] }[] =
  [
    { key: 'accounts', items: ['users', 'clubs', 'applications'] },
    { key: 'content', items: ['news', 'ads', 'popups', 'announcements'] },
    { key: 'football', items: ['leagues', 'rating'] },
    { key: 'revenue', items: ['payments', 'gifts'] },
    { key: 'security', items: ['reports', 'audit', 'logs'] },
  ];

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
  // Phones: the menu opens over the page from the top bar.
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [section]);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open]);

  return (
    <div className="admin-layout">
      <header className="admin-topbar">
        <Brand />
        <button
          type="button"
          className="icon-button"
          aria-label={open ? copy.panel.closeMenu : copy.panel.openMenu}
          aria-expanded={open}
          aria-controls="admin-sidebar"
          onClick={() => setOpen(value => !value)}
        >
          <NavIcon name={open ? 'close' : 'menu'} size={20} />
        </button>
      </header>
      <aside
        id="admin-sidebar"
        className={'sidebar' + (open ? ' sidebar-open' : '')}
      >
        <div className="sidebar-brand">
          <Brand />
        </div>
        <nav aria-label={copy.panel.eyebrow} className="sidebar-nav">
          {groups.map(group => (
            <div key={group.key} className="nav-group">
              <p className="nav-group-label">{copy.panel.groups[group.key]}</p>
              {group.items.map(value => (
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
                  <NavIcon name={value} />
                  <span className="nav-text">{copy.panel[value]}</span>
                  {!!badges[value] && (
                    <span
                      className="nav-badge"
                      aria-label={
                        value === 'reports'
                          ? copy.panel.openReportsBadge(badges[value] ?? 0)
                          : copy.panel.pendingBadge(badges[value] ?? 0)
                      }
                    >
                      {badges[value]}
                    </span>
                  )}
                </a>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-account">
          <span className="avatar">
            {user.fullName.slice(0, 1).toLocaleUpperCase('tr-TR')}
          </span>
          <div className="sidebar-account-text">
            <strong>{user.fullName}</strong>
            <span>{copy.admin}</span>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label={copy.panel.logout}
            title={copy.panel.logout}
            disabled={logoutBusy}
            onClick={onLogout}
          >
            <NavIcon name="logout" />
          </button>
        </div>
        {logoutError && (
          <p role="alert" className="error-banner">
            {logoutError}
          </p>
        )}
      </aside>
      {open && (
        <div
          className="sidebar-backdrop"
          aria-hidden="true"
          onClick={() => setOpen(false)}
        />
      )}
      {children}
    </div>
  );
}
