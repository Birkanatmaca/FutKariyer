import { useEffect, useState } from 'react';
import { Button } from '../../../shared/ui/Button';
import { Feedback } from '../../../shared/ui/Feedback';
import { copy } from '../../../shared/lib/copy';
import type { ProPlan } from '../domain/models';
import type { PaymentService } from '../application/payment-service';

const maxAmountMinor = 100000000;

export function ProPlanSection({
  service,
  revision,
}: {
  service: PaymentService;
  revision: number;
}) {
  const [plan, setPlan] = useState<ProPlan | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let current = true;
    setError(null);
    service
      .proPlan()
      .then(value => {
        if (!current) return;
        setPlan(value);
        setDraft((value.amountMinor / 100).toFixed(2));
      })
      .catch(failure => {
        if (current)
          setError(
            failure instanceof Error ? failure.message : copy.form.unexpected,
          );
      });
    return () => {
      current = false;
    };
  }, [service, revision]);

  async function update(item: ProPlan, amountMinor: number, active: boolean) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await service.updateProPlan(item.id, amountMinor, active);
      setPlan(updated);
      setDraft((updated.amountMinor / 100).toFixed(2));
      setNotice(copy.payments.proSaved);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : copy.payments.proError,
      );
    } finally {
      setBusy(false);
    }
  }

  function save(item: ProPlan) {
    if (busy) return;
    const amount = Number(draft.trim().replace(',', '.'));
    const amountMinor = Math.round(amount * 100);
    if (
      !Number.isFinite(amount) ||
      amountMinor < 100 ||
      amountMinor > maxAmountMinor
    ) {
      setNotice(null);
      setError(copy.payments.priceRange);
      return;
    }
    void update(item, amountMinor, item.active);
  }

  function toggle(item: ProPlan, active: boolean) {
    if (busy) return;
    void update(item, item.amountMinor, active);
  }

  return (
    <section className="payment-section" aria-labelledby="payment-pro-plan">
      <div className="league-section-header">
        <div>
          <h2 id="payment-pro-plan">{copy.payments.proTitle}</h2>
          <p className="muted">{copy.payments.proHint}</p>
        </div>
      </div>
      <Feedback message={notice} success />
      <Feedback message={error} />
      {plan ? (
        <div className="payment-package-grid">
          <article className="payment-package">
            <div>
              <h3>{copy.payments.proSummary(plan.days, plan.bonusCredits)}</h3>
              <span
                className={
                  'league-status ' + (plan.active ? 'active' : 'neutral')
                }
              >
                {plan.active ? copy.payments.active : copy.payments.inactive}
              </span>
            </div>
            <label className="field">
              <span>{copy.payments.proPrice}</span>
              <input
                type="number"
                min="1"
                max={maxAmountMinor / 100}
                step="0.01"
                inputMode="decimal"
                value={draft}
                onChange={event => setDraft(event.target.value)}
              />
            </label>
            <div className="payment-package-actions">
              <label className="payment-active-toggle">
                <input
                  type="checkbox"
                  checked={plan.active}
                  disabled={busy}
                  onChange={event => toggle(plan, event.target.checked)}
                />
                {copy.payments.active}
              </label>
              <Button
                className="button-small"
                busy={busy}
                onClick={() => save(plan)}
              >
                {copy.payments.proSave}
              </Button>
            </div>
          </article>
        </div>
      ) : error ? null : (
        <div className="league-inline-empty" role="status">
          {copy.form.loading}
        </div>
      )}
    </section>
  );
}
