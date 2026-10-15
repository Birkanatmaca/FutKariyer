import React from 'react';
import { copy } from '../../../../shared/lib/copy';
import type { AdminServices } from '../../application/admin-services';
import type { ProPlan } from '../../domain/models';
import { CatalogEditor } from './CatalogEditor';

const text = copy.admin.payments;

// Same reporting amount / store ids / on-sale management as a team-right
// package, for the single Pro plan.
export function ProPlanCard({
  plan,
  services,
  onSaved,
}: {
  plan: ProPlan;
  services: AdminServices;
  onSaved(updated: ProPlan): void;
}) {
  return (
    <CatalogEditor
      title={text.proPlanTitle(plan.days, plan.bonusCredits)}
      saved={plan}
      priceLabel={text.proPrice}
      onSaleHint={text.proOnSaleHint}
      saveLabel={text.saveProPlan}
      savedNotice={text.proSaved}
      onSave={async update =>
        onSaved(await services.payments.updateProPlan(plan.id, update))
      }
    />
  );
}
