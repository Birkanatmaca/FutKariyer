import { copy } from '../../../shared/lib/copy';
import { Initials, Pill, ago, shortDate } from '../../../shared/ui/kit';
import type { ManagedAccount } from '../domain/models';
import { roleTone } from './AccountEditor';

const text = copy.panel;

function status(account: ManagedAccount) {
  if (account.approvalStatus === 'pending')
    return <Pill tone="warning">{text.pending}</Pill>;
  if (account.approvalStatus === 'rejected')
    return <Pill tone="danger">{text.rejected}</Pill>;
  return account.active ? (
    <Pill tone="accent">{text.active}</Pill>
  ) : (
    <Pill tone="danger">{text.inactive}</Pill>
  );
}

export function AccountTable({
  accounts,
  clubs,
  busy,
  onEdit,
  onOverview,
}: {
  accounts: ManagedAccount[];
  clubs: boolean;
  busy?: boolean;
  onEdit(account: ManagedAccount): void;
  onOverview(account: ManagedAccount): void;
}) {
  return (
    <div className="table-scroll" aria-busy={busy}>
      <table className="kit-table">
        <thead>
          <tr>
            <th>{text.name}</th>
            <th>{clubs ? text.footballType : text.role}</th>
            <th>{text.identity}</th>
            <th>{text.status}</th>
            <th>{text.badges}</th>
            <th>{text.date}</th>
            <th className="align-right">{text.actions}</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map(account => {
            const locked = account.role === 'admin';
            const place = [account.city, account.district]
              .filter(Boolean)
              .join(' / ');
            return (
              <tr
                key={account.id}
                className={locked ? undefined : 'kit-row-link'}
                onClick={locked ? undefined : () => onEdit(account)}
              >
                <td>
                  <div className="kit-identity">
                    <Initials name={account.fullName} />
                    <div>
                      <strong>{account.fullName}</strong>
                      <span>{place || text.noPlace}</span>
                    </div>
                  </div>
                </td>
                <td>
                  {clubs ? (
                    <span className="kit-soft">
                      {account.footballType &&
                      account.footballType !== 'unknown'
                        ? copy.football.types[account.footballType]
                        : '—'}
                    </span>
                  ) : (
                    <Pill tone={roleTone(account.role)}>
                      {copy.roles[account.role]}
                    </Pill>
                  )}
                </td>
                <td className="login-identity kit-soft">
                  {account.username || account.email}
                </td>
                <td>{status(account)}</td>
                <td>
                  <div className="kit-badges">
                    {account.verified && (
                      <Pill tone="info">{text.verified}</Pill>
                    )}
                    {account.pro && <Pill tone="warning">PRO</Pill>}
                    {!account.verified && !account.pro && (
                      <span className="muted">—</span>
                    )}
                  </div>
                </td>
                <td>
                  <time
                    dateTime={account.createdAt}
                    title={shortDate(account.createdAt)}
                    className="kit-soft"
                  >
                    {ago(account.createdAt)}
                  </time>
                </td>
                <td className="align-right">
                  {locked ? (
                    <span className="muted">{text.protected}</span>
                  ) : (
                    <div className="kit-row-actions">
                      {account.role === 'club' && (
                        <button
                          type="button"
                          className="kit-action"
                          aria-label={text.overviewLabel(account.fullName)}
                          onClick={event => {
                            event.stopPropagation();
                            onOverview(account);
                          }}
                        >
                          {text.overview}
                        </button>
                      )}
                      <button
                        type="button"
                        className="kit-action kit-action-primary"
                        aria-label={text.editLabel(account.fullName)}
                        onClick={event => {
                          event.stopPropagation();
                          onEdit(account);
                        }}
                      >
                        {text.edit}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
