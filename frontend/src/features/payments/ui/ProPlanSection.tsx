import { useEffect, useState } from 'react';
import { Feedback } from '../../../shared/ui/Feedback';
import { copy } from '../../../shared/lib/copy';
import type { CatalogUpdate, ProPlan } from '../domain/models';
import type { PaymentService } from '../application/payment-service';
import { CatalogEditor } from './CatalogEditor';

export function ProPlanSection({
  service,
  revision,
}: {
  service: PaymentService;
  revision: number;
}) {
  const [plan, setPlan] = useState<ProPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let current = true;
    setError(null);
    service
      .proPlan()
      .then(value => {
        if (current) setPlan(value);
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

  async function update(item: ProPlan, values: CatalogUpdate) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      setPlan(await service.updateProPlan(item.id, values));
      setNotice(copy.payments.proSaved);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : copy.payments.proError,
      );
    } finally {
      setBusy(false);
    }
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
          <CatalogEditor
            title={copy.payments.proSummary(plan.days, plan.bonusCredits)}
            saved={plan}
            priceLabel={copy.payments.proPrice}
            saveLabel={copy.payments.proSave}
            busy={busy}
            onSave={values => void update(plan, values)}
            onInvalid={() => {
              setNotice(null);
              setError(null);
            }}
          />
        </div>
      ) : error ? null : (
        <div className="league-inline-empty" role="status">
          {copy.form.loading}
        </div>
      )}
    </section>
  );
}
