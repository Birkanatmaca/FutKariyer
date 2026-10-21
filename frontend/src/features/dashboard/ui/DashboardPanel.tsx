import { useEffect, useState, type ReactNode } from 'react';
import { copy } from '../../../shared/lib/copy';
import { Button } from '../../../shared/ui/Button';
import { Feedback } from '../../../shared/ui/Feedback';
import { NavIcon } from '../../../shared/ui/NavIcon';
import {
  dashboardWindows,
  type Dashboard,
  type DashboardWindow,
} from '../domain/models';
import {
  change,
  formatMoney,
  formatNumber,
  type DashboardService,
} from '../application/dashboard-service';
import {
  ChartCard,
  CommunityChart,
  Donut,
  GamesChart,
  HealthChart,
  HorizontalBars,
  RevenueChart,
  SignupsChart,
  Sparkline,
  useColors,
} from './charts';

const text = copy.dashboard;

// The sections a card can open (the panel's routes).
type Section =
  | 'users'
  | 'clubs'
  | 'applications'
  | 'reports'
  | 'ads'
  | 'popups'
  | 'news'
  | 'leagues'
  | 'payments'
  | 'gifts'
  | 'rating'
  | 'announcements'
  | 'audit'
  | 'logs';

function Delta({ value }: { value: number | null }) {
  if (value === null)
    return <span className="dash-delta">{text.noCompare}</span>;
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return (
    <span
      className={
        'dash-delta ' + (value > 0 ? 'up' : value < 0 ? 'down' : 'flat')
      }
      title={text.vsPrevious}
    >
      {sign}
      {Math.abs(value)}%
    </span>
  );
}

function Kpi({
  label,
  value,
  sub,
  delta,
  spark,
  color,
  onOpen,
}: {
  label: string;
  value: string;
  sub?: string;
  delta?: number | null;
  spark?: number[];
  color: string;
  onOpen?: () => void;
}) {
  return (
    <button type="button" className="dash-card dash-kpi" onClick={onOpen}>
      <span className="dash-kpi-label">{label}</span>
      <span className="dash-kpi-value">
        <strong>{value}</strong>
        {delta !== undefined && <Delta value={delta} />}
      </span>
      {sub && <span className="dash-kpi-sub">{sub}</span>}
      {spark && <Sparkline data={spark} color={color} />}
    </button>
  );
}

function SectionCard({
  section,
  stats,
  highlight,
  onOpen,
}: {
  section: Section;
  stats: [string, ReactNode][];
  highlight?: boolean;
  onOpen(section: Section): void;
}) {
  return (
    <button
      type="button"
      className={
        'dash-card dash-section' + (highlight ? ' dash-attention' : '')
      }
      onClick={() => onOpen(section)}
    >
      <span className="dash-section-head">
        <span className="dash-section-icon">
          <NavIcon name={section} />
        </span>
        <strong>{copy.panel[section]}</strong>
        <span className="dash-open" aria-hidden="true">
          {text.open} →
        </span>
      </span>
      <dl>
        {stats.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </button>
  );
}

function time(iso: string) {
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Ana sayfa (21 Oct 2026): headline numbers with trends, what needs a
// decision, charts for growth, community, revenue, games and health, and one
// card per panel section that opens it.
export function DashboardPanel({
  service,
  userName,
  onSection,
}: {
  service: DashboardService;
  userName: string;
  onSection(section: Section): void;
}) {
  const colors = useColors();
  const [days, setDays] = useState<DashboardWindow>(30),
    [data, setData] = useState<Dashboard | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<string | null>(null),
    [reload, setReload] = useState(0);

  useEffect(() => {
    let current = true;
    setLoading(true);
    service
      .load(days)
      .then(value => {
        if (!current) return;
        setData(value);
        setError(null);
      })
      .catch(
        failure =>
          current &&
          setError(
            failure instanceof Error ? failure.message : copy.form.unexpected,
          ),
      )
      .finally(() => current && setLoading(false));
    return () => {
      current = false;
    };
  }, [service, days, reload]);

  const firstName = userName.split(' ')[0] || userName;
  const header = (
    <header className="panel-header">
      <div>
        <p className="eyebrow">{text.eyebrow}</p>
        <h1>{text.greeting(firstName)}</h1>
        <p className="muted">{text.hint}</p>
      </div>
      <div className="action-row">
        {data && (
          <span className="hint">{text.updated(time(data.generatedAt))}</span>
        )}
        <Button
          variant="secondary"
          busy={loading && data !== null}
          onClick={() => setReload(value => value + 1)}
        >
          {text.refresh}
        </Button>
      </div>
    </header>
  );

  if (!data) {
    return (
      <main className="panel-content">
        {header}
        {error ? (
          <Feedback message={error} />
        ) : (
          <div className="empty" role="status">
            <span className="spinner" />
            <p>{copy.form.loading}</p>
          </div>
        )}
      </main>
    );
  }

  const { kpis, modules: m, daily } = data;
  const signups = daily.map(d => d.players + d.coaches + d.clubs);
  const attention: [Section, string, boolean][] = [
    [
      'applications',
      text.attentionItems.applications(m.applications.pending),
      m.applications.pending > 0,
    ],
    [
      'reports',
      text.attentionItems.reports(m.reports.open),
      m.reports.open > 0,
    ],
    [
      'news',
      text.attentionItems.news(m.news.pendingReview),
      m.news.pendingReview > 0,
    ],
    ['logs', text.attentionItems.errors(m.logs.errors), m.logs.errors > 0],
    [
      'audit',
      text.attentionItems.security(m.logs.security),
      m.logs.security > 0,
    ],
  ];
  const due = attention.filter(([, , on]) => on);
  const roleLabel = (key: string) =>
    copy.roles[key as keyof typeof copy.roles] ?? key;
  const typeLabel = (key: string) =>
    copy.football.types[key as keyof typeof copy.football.types] ??
    text.unknownPosition;
  const daysLeft = m.rating.endsAt
    ? Math.max(
        0,
        Math.ceil((Date.parse(m.rating.endsAt) - Date.now()) / 86400000),
      )
    : null;

  return (
    <main className="panel-content dashboard">
      {header}

      <div
        className="application-tabs"
        role="tablist"
        aria-label={text.eyebrow}
      >
        {dashboardWindows.map(value => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={days === value}
            className="application-tab"
            onClick={() => setDays(value)}
          >
            {text.windows[value]}
          </button>
        ))}
      </div>
      <Feedback message={error} />

      <section className="dash-kpis">
        <Kpi
          label={text.kpis.users}
          value={formatNumber(kpis.users)}
          sub={text.kpis.usersSub(formatNumber(kpis.newUsers))}
          spark={signups}
          color={colors.brand}
          onOpen={() => onSection('users')}
        />
        <Kpi
          label={text.kpis.signups}
          value={formatNumber(kpis.newUsers)}
          delta={change(kpis.newUsers, kpis.newUsersPrev)}
          spark={signups}
          color={colors.accent}
          onOpen={() => onSection('users')}
        />
        <Kpi
          label={text.kpis.active}
          value={formatNumber(kpis.active24h)}
          sub={text.kpis.activeSub(formatNumber(kpis.active7d))}
          color={colors.info}
        />
        <Kpi
          label={text.kpis.revenue}
          value={formatMoney(kpis.revenueMinor)}
          sub={text.kpis.revenueSub(formatNumber(kpis.paidOrders))}
          delta={change(kpis.revenueMinor, kpis.revenuePrevMinor)}
          spark={daily.map(d => d.revenueMinor)}
          color={colors.warning}
          onOpen={() => onSection('payments')}
        />
        <Kpi
          label={text.kpis.posts}
          value={formatNumber(kpis.posts)}
          delta={change(kpis.posts, kpis.postsPrev)}
          spark={daily.map(d => d.posts)}
          color={colors.success}
        />
        <Kpi
          label={text.kpis.pro}
          value={formatNumber(kpis.proMembers)}
          sub={text.kpis.plays + ': ' + formatNumber(kpis.gamePlays)}
          color={colors.danger}
          onOpen={() => onSection('payments')}
        />
      </section>

      <section className="dash-card dash-attention-strip">
        <h2>{text.attention}</h2>
        {due.length ? (
          <div className="dash-chips">
            {due.map(([section, label]) => (
              <button
                key={section}
                type="button"
                className="dash-chip"
                onClick={() => onSection(section)}
              >
                <NavIcon name={section} size={16} />
                {label}
                <span aria-hidden="true">→</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="muted">{text.attentionEmpty}</p>
        )}
      </section>

      <div className="dash-grid">
        <ChartCard title={text.charts.signups} wide>
          <SignupsChart data={daily} />
        </ChartCard>
        <ChartCard title={text.charts.roles}>
          <Donut data={data.roles} label={roleLabel} />
        </ChartCard>
        <ChartCard title={text.charts.community} wide>
          <CommunityChart data={daily} />
        </ChartCard>
        <ChartCard title={text.charts.footballTypes}>
          <Donut data={data.footballTypes} label={typeLabel} />
        </ChartCard>
        <ChartCard title={text.charts.revenue} wide>
          <RevenueChart data={daily} />
        </ChartCard>
        <ChartCard title={text.charts.positions}>
          <HorizontalBars
            data={data.positions}
            label={key => (key === 'unknown' ? text.unknownPosition : key)}
          />
        </ChartCard>
        <ChartCard title={text.charts.games}>
          <GamesChart data={daily} />
          <ul className="dash-legend dash-legend-inline">
            {data.games.map(item => (
              <li key={item.key}>
                <span>{text.games[item.key] ?? item.key}</span>
                <strong>{formatNumber(item.value)}</strong>
              </li>
            ))}
          </ul>
        </ChartCard>
        <ChartCard title={text.charts.health}>
          <HealthChart data={daily} />
        </ChartCard>
      </div>

      <h2 className="dash-heading">{text.sections}</h2>
      <section className="dash-sections">
        <SectionCard
          section="users"
          onOpen={onSection}
          stats={[
            [text.stats.players, formatNumber(m.users.players)],
            [text.stats.coaches, formatNumber(m.users.coaches)],
            [text.stats.verified, formatNumber(m.users.verified)],
            [text.stats.suspended, formatNumber(m.users.suspended)],
          ]}
        />
        <SectionCard
          section="clubs"
          onOpen={onSection}
          stats={[
            [text.stats.total, formatNumber(m.clubs.total)],
            [text.stats.tffLinked, formatNumber(m.clubs.tffLinked)],
            [text.stats.withStaff, formatNumber(m.clubs.withStaff)],
            [text.stats.squad, formatNumber(m.clubs.squadPlayers)],
          ]}
        />
        <SectionCard
          section="applications"
          onOpen={onSection}
          highlight={m.applications.pending > 0}
          stats={[
            [text.stats.pending, formatNumber(m.applications.pending)],
            [text.stats.approved, formatNumber(m.applications.approved)],
            [text.stats.rejected, formatNumber(m.applications.rejected)],
          ]}
        />
        <SectionCard
          section="reports"
          onOpen={onSection}
          highlight={m.reports.open > 0}
          stats={[
            [text.stats.open, formatNumber(m.reports.open)],
            [text.stats.resolved, formatNumber(m.reports.resolved)],
          ]}
        />
        <SectionCard
          section="news"
          onOpen={onSection}
          highlight={m.news.pendingReview > 0}
          stats={[
            [text.stats.published, formatNumber(m.news.published)],
            [text.stats.review, formatNumber(m.news.pendingReview)],
            [text.stats.newItems, formatNumber(m.news.new)],
          ]}
        />
        <SectionCard
          section="ads"
          onOpen={onSection}
          stats={[
            [text.stats.active, formatNumber(m.ads.active)],
            [text.stats.total, formatNumber(m.ads.total)],
          ]}
        />
        <SectionCard
          section="popups"
          onOpen={onSection}
          stats={[
            [text.stats.active, formatNumber(m.popups.active)],
            [text.stats.views, formatNumber(m.popups.views)],
          ]}
        />
        <SectionCard
          section="announcements"
          onOpen={onSection}
          stats={[
            [text.stats.sent, formatNumber(m.announcements.sent)],
            [text.stats.total, formatNumber(m.announcements.total)],
          ]}
        />
        <SectionCard
          section="leagues"
          onOpen={onSection}
          stats={[
            [text.stats.active, formatNumber(m.leagues.active)],
            [text.stats.teams, formatNumber(m.leagues.teams)],
            [text.stats.upcoming, formatNumber(m.leagues.upcomingMatches)],
            [text.stats.played, formatNumber(m.leagues.playedMatches)],
          ]}
        />
        <SectionCard
          section="rating"
          onOpen={onSection}
          stats={[
            [
              text.stats.season,
              m.rating.season ? (
                <>
                  {m.rating.season}
                  {daysLeft !== null && (
                    <em className="dash-note">{text.stats.endsIn(daysLeft)}</em>
                  )}
                </>
              ) : (
                text.stats.noSeason
              ),
            ],
            [text.stats.participants, formatNumber(m.rating.participants)],
            [text.stats.points, formatNumber(m.rating.points)],
          ]}
        />
        <SectionCard
          section="payments"
          onOpen={onSection}
          stats={[
            [text.stats.revenue, formatMoney(m.payments.revenueMinor)],
            [text.stats.paid, formatNumber(m.payments.paid)],
            [text.stats.pro, formatNumber(m.payments.pro)],
            [text.stats.refunded, formatNumber(m.payments.refunded)],
          ]}
        />
        <SectionCard
          section="gifts"
          onOpen={onSection}
          stats={[
            [text.stats.sent, formatNumber(m.gifts.sent)],
            [text.stats.claimed, formatNumber(m.gifts.claimed)],
          ]}
        />
        <SectionCard
          section="audit"
          onOpen={onSection}
          stats={[
            [text.stats.actions, formatNumber(m.audit.actions)],
            [text.stats.logins, formatNumber(m.audit.adminLogins)],
          ]}
        />
        <SectionCard
          section="logs"
          onOpen={onSection}
          highlight={m.logs.errors > 0}
          stats={[
            [text.stats.errors, formatNumber(m.logs.errors)],
            [text.stats.warnings, formatNumber(m.logs.warnings)],
            [text.stats.security, formatNumber(m.logs.security)],
          ]}
        />
      </section>

      <div className="dash-grid dash-lists">
        <section className="dash-card">
          <div className="dash-list-head">
            <h2>{text.recentUsers}</h2>
            <button
              type="button"
              className="text-link"
              onClick={() => onSection('users')}
            >
              {text.seeAll}
            </button>
          </div>
          {data.recentUsers.length ? (
            <ul className="dash-list">
              {data.recentUsers.map(user => (
                <li key={user.id}>
                  <span className="avatar">
                    {user.fullName.slice(0, 1).toLocaleUpperCase('tr-TR')}
                  </span>
                  <span className="dash-list-main">
                    <strong>{user.fullName}</strong>
                    <span>{roleLabel(user.role)}</span>
                  </span>
                  <time dateTime={user.createdAt}>{time(user.createdAt)}</time>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">{text.empty}</p>
          )}
        </section>
        <section className="dash-card">
          <div className="dash-list-head">
            <h2>{text.recentActions}</h2>
            <button
              type="button"
              className="text-link"
              onClick={() => onSection('audit')}
            >
              {text.seeAll}
            </button>
          </div>
          {data.recentActions.length ? (
            <ul className="dash-list">
              {data.recentActions.map(action => (
                <li key={action.at + action.action}>
                  <span className="dash-list-main">
                    <strong>
                      {copy.audit.actions[
                        action.action as keyof typeof copy.audit.actions
                      ] ?? action.action.replace(/^admin\./, '')}
                    </strong>
                    <span>
                      {action.actorType === 'system'
                        ? copy.audit.system
                        : action.actorName || copy.audit.deleted}
                    </span>
                  </span>
                  <time dateTime={action.at}>{time(action.at)}</time>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">{text.empty}</p>
          )}
        </section>
      </div>
    </main>
  );
}
