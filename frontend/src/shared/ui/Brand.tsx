import { copy } from '../lib/copy';
export function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark" aria-hidden="true">
        F
      </span>
      <div>
        <strong>{copy.brand}</strong>
        <span>{copy.pilot}</span>
      </div>
    </div>
  );
}
