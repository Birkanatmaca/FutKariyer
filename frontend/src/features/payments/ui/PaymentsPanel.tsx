import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '../../../shared/ui/Button';
import { Feedback } from '../../../shared/ui/Feedback';
import { copy } from '../../../shared/lib/copy';
import type {
  CatalogUpdate,
  Payment,
  PaymentPackage,
  PaymentPage,
  PaymentStatus,
} from '../domain/models';
import type { PaymentService } from '../application/payment-service';
import { CatalogEditor } from './CatalogEditor';
import { ProPlanSection } from './ProPlanSection';

const statuses: Array<PaymentStatus | 'all'> = [
  'all',
  'pending',
  'paid',
  'failed',
  'refunded',
];

function money(amountMinor: number, currency = 'TRY') {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
  }).format(amountMinor / 100);
}

function date(value: string) {
  return new Date(value).toLocaleString('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function PaymentsPanel({ service }: { service: PaymentService }) {
  const [packages, setPackages] = useState<PaymentPackage[] | null>(null);
  const [packageError, setPackageError] = useState<string | null>(null);
  const [packageBusy, setPackageBusy] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [status, setStatus] = useState<PaymentStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<PaymentPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    service
      .packages()
      .then(value => {
        if (current) setPackages(value);
      })
      .catch(failure => {
        if (current)
          setPackageError(
            failure instanceof Error ? failure.message : copy.form.unexpected,
          );
      });
    return () => {
      current = false;
    };
  }, [service, revision]);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError(null);
    setData(null);
    service
      .list(status, page, search)
      .then(value => {
        if (!current) return;
        if (page > Math.max(1, value.totalPages)) {
          setPage(Math.max(1, value.totalPages));
        } else {
          setData(value);
        }
      })
      .catch(failure => {
        if (current)
          setError(
            failure instanceof Error ? failure.message : copy.form.unexpected,
          );
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [service, status, page, search, revision]);

  async function updatePackage(item: PaymentPackage, values: CatalogUpdate) {
    if (packageBusy) return;
    setPackageBusy(item.id);
    setPackageError(null);
    setNotice(null);
    try {
      const updated = await service.updatePackage(item.id, values);
      setPackages(
        current =>
          current?.map(value =>
            value.id === updated.id ? updated : value,
          ) || [updated],
      );
      setNotice(copy.payments.saved);
    } catch (failure) {
      setPackageError(
        failure instanceof Error ? failure.message : copy.payments.packageError,
      );
    } finally {
      setPackageBusy('');
    }
  }

  function applySearch(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setSearch(searchDraft.trim());
  }

  return (
    <main className="panel-content">
      <header className="panel-header">
        <div>
          <p className="eyebrow">{copy.payments.eyebrow}</p>
          <h1>{copy.payments.title}</h1>
          <p className="muted">{copy.payments.hint}</p>
        </div>
        <Button
          variant="secondary"
          onClick={() => setRevision(value => value + 1)}
        >
          {copy.payments.refresh}
        </Button>
      </header>

      <ProPlanSection service={service} revision={revision} />

      <section className="payment-section" aria-labelledby="payment-packages">
        <div className="league-section-header">
          <div>
            <h2 id="payment-packages">{copy.payments.packages}</h2>
            <p className="muted">{copy.payments.packageHint}</p>
          </div>
        </div>
        <Feedback message={notice} success />
        <Feedback message={packageError} />
        {packages ? (
          <div className="payment-package-grid">
            {packages.map(item => (
              <CatalogEditor
                key={item.id}
                title={copy.payments.rights(item.credits)}
                saved={item}
                priceLabel={copy.payments.price}
                saveLabel={copy.payments.save}
                busy={packageBusy === item.id}
                onSave={values => void updatePackage(item, values)}
                onInvalid={() => {
                  setNotice(null);
                  setPackageError(null);
                }}
              />
            ))}
          </div>
        ) : packageError ? null : (
          <div className="league-inline-empty" role="status">
            {copy.form.loading}
          </div>
        )}
        <p className="payment-note">{copy.payments.paymentNote}</p>
      </section>

      {data && (
        <section className="payment-summary" aria-label={copy.payments.history}>
          <Metric
            label={copy.payments.collected}
            value={money(data.summary.collectedMinor)}
          />
          <Metric
            label={copy.payments.refundedAmount}
            value={money(data.summary.refundedMinor)}
          />
          <Metric
            label={copy.payments.paid}
            value={data.summary.paid.toLocaleString('tr-TR')}
          />
          <Metric
            label={copy.payments.pending}
            value={data.summary.pending.toLocaleString('tr-TR')}
          />
          <Metric
            label={copy.payments.failed}
            value={data.summary.failed.toLocaleString('tr-TR')}
          />
          <Metric
            label={copy.payments.refunded}
            value={data.summary.refunded.toLocaleString('tr-TR')}
          />
        </section>
      )}

      <section
        className="list-panel payment-history"
        aria-label={copy.payments.history}
      >
        <div className="league-section-header">
          <div>
            <h2>{copy.payments.history}</h2>
            <p className="muted">
              {data ? copy.panel.total(data.total) : copy.form.loading}
            </p>
          </div>
        </div>
        <div className="toolbar payment-toolbar">
          <form onSubmit={applySearch} className="search-form">
            <input
              aria-label={copy.payments.search}
              placeholder={copy.payments.search}
              value={searchDraft}
              onChange={event => setSearchDraft(event.target.value)}
              maxLength={100}
              type="search"
            />
            <Button type="submit" variant="secondary" disabled={loading}>
              {copy.panel.searchButton}
            </Button>
          </form>
          <label className="payment-status-filter">
            <span>{copy.payments.status}</span>
            <select
              value={status}
              onChange={event => {
                setStatus(event.target.value as PaymentStatus | 'all');
                setPage(1);
              }}
            >
              {statuses.map(value => (
                <option key={value} value={value}>
                  {value === 'all'
                    ? copy.payments.all
                    : copy.payments.statusLabels[value]}
                </option>
              ))}
            </select>
          </label>
        </div>
        {loading ? (
          <div className="empty" role="status">
            <span className="spinner" />
            <p>{copy.form.loading}</p>
          </div>
        ) : error ? (
          <div className="empty">
            <Feedback message={error} />
            <Button
              variant="secondary"
              onClick={() => setRevision(value => value + 1)}
            >
              {copy.form.retry}
            </Button>
          </div>
        ) : data?.items.length ? (
          <>
            <PaymentTable items={data.items} />
            <footer className="pagination">
              <span>{copy.panel.page(data.page, data.totalPages)}</span>
              <div className="action-row">
                <Button
                  variant="secondary"
                  className="button-small"
                  disabled={page <= 1}
                  onClick={() => setPage(value => value - 1)}
                >
                  {copy.panel.previous}
                </Button>
                <Button
                  variant="secondary"
                  className="button-small"
                  disabled={page >= data.totalPages}
                  onClick={() => setPage(value => value + 1)}
                >
                  {copy.panel.next}
                </Button>
              </div>
            </footer>
          </>
        ) : (
          <div className="empty">
            <h2>{copy.payments.empty}</h2>
            <p className="muted">
              {search ? copy.panel.emptySearch : copy.payments.emptyHint}
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="league-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PaymentTable({ items }: { items: Payment[] }) {
  return (
    <div className="table-scroll">
      <table className="payment-table">
        <thead>
          <tr>
            <th>{copy.payments.player}</th>
            <th>{copy.payments.package}</th>
            <th>{copy.payments.amount}</th>
            <th>{copy.payments.provider}</th>
            <th>{copy.payments.status}</th>
            <th>{copy.payments.date}</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.id}>
              <td>
                <strong>{item.playerName || copy.roles.player}</strong>
                <small>{item.playerEmail || item.id}</small>
              </td>
              <td>
                {item.product === 'pro'
                  ? copy.payments.proProduct
                  : copy.payments.rights(item.packageCredits)}
              </td>
              <td>{money(item.amountMinor, item.currency)}</td>
              <td>{item.provider || '—'}</td>
              <td>
                <span
                  className={
                    'league-status ' +
                    (item.status === 'paid' ? 'active' : 'neutral')
                  }
                >
                  {copy.payments.statusLabels[item.status]}
                </span>
              </td>
              <td>{date(item.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
