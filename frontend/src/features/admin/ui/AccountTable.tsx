import { copy } from '../../../shared/lib/copy';
import { Button } from '../../../shared/ui/Button';
import type { ManagedAccount } from '../domain/models';
export function AccountTable({
  accounts,
  onEdit,
  onOverview,
}: {
  accounts: ManagedAccount[];
  onEdit(account: ManagedAccount): void;
  onOverview(account: ManagedAccount): void;
}) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>{copy.panel.name}</th>
            <th>{copy.panel.role}</th>
            <th>{copy.panel.identity}</th>
            <th>{copy.panel.status}</th>
            <th>{copy.panel.verification}</th>
            <th>{copy.panel.date}</th>
            <th className="align-right">{copy.panel.actions}</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map(account => (
            <tr key={account.id}>
              <td>
                <div className="table-identity">
                  <span className="avatar" aria-hidden="true">
                    {account.fullName.slice(0, 1).toLocaleUpperCase('tr-TR')}
                  </span>
                  <div>
                    <strong>{account.fullName}</strong>
                    <span>
                      {account.city}
                      {account.district ? ' / ' + account.district : ''}
                    </span>
                  </div>
                </div>
              </td>
              <td>{copy.roles[account.role]}</td>
              <td className="login-identity">
                {account.username || account.email}
              </td>
              <td>
                <span
                  className={
                    'status-badge ' + (account.active ? 'active' : 'inactive')
                  }
                >
                  <span className="status-dot" />
                  {account.active ? copy.panel.active : copy.panel.inactive}
                </span>
              </td>
              <td>
                {account.role === 'club' ||
                account.role === 'coach' ||
                account.role === 'organizer' ? (
                  <span
                    className={
                      'status-badge ' +
                      (account.verified ? 'active' : 'inactive')
                    }
                  >
                    {account.verified
                      ? copy.panel.verified
                      : copy.panel.unverified}
                  </span>
                ) : (
                  <span className="muted">—</span>
                )}
              </td>
              <td>
                <time dateTime={account.createdAt}>
                  {new Date(account.createdAt).toLocaleDateString('tr-TR')}
                </time>
              </td>
              <td className="align-right">
                {account.role === 'admin' ? (
                  <span className="muted">{copy.panel.protected}</span>
                ) : (
                  <div className="action-row action-end">
                    {account.role === 'club' && (
                      <Button
                        variant="secondary"
                        className="button-small"
                        aria-label={copy.panel.overviewLabel(account.fullName)}
                        onClick={() => onOverview(account)}
                      >
                        {copy.panel.overview}
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      className="button-small"
                      aria-label={copy.panel.editLabel(account.fullName)}
                      onClick={() => onEdit(account)}
                    >
                      {copy.panel.edit}
                    </Button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
