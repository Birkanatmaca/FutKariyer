import { useState } from 'react';
import { organizerCopy } from '../../../shared/lib/organizer-copy';
import { Button } from '../../../shared/ui/Button';
import { Feedback } from '../../../shared/ui/Feedback';
import { Modal } from '../../../shared/ui/Modal';
import type { TournamentService } from '../application/tournament-service';

const text = organizerCopy.fixtures;

// Round-robin fixture for the accepted teams, single or double leg.
export function FixtureModal({
  service,
  tournamentId,
  teamCount,
  onClose,
  onDone,
}: {
  service: TournamentService;
  tournamentId: string;
  teamCount: number;
  onClose(): void;
  onDone(): void;
}) {
  const [legs, setLegs] = useState<1 | 2>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function generate() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await service.generateFixture(tournamentId, legs);
      onDone();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : organizerCopy.form.unexpected,
      );
      setBusy(false);
    }
  }
  return (
    <Modal
      title={text.generateTitle}
      eyebrow={organizerCopy.workspace.tabs.fixtures}
      busy={busy}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            {organizerCopy.form.cancel}
          </Button>
          <Button busy={busy} onClick={generate}>
            {text.generate}
          </Button>
        </>
      }
    >
      <p className="muted">{text.generateHint}</p>
      <div
        className="org-legs"
        role="radiogroup"
        aria-label={text.generateTitle}
      >
        {([1, 2] as const).map(value => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={legs === value}
            className="org-leg"
            disabled={busy}
            onClick={() => setLegs(value)}
          >
            <strong>{value === 1 ? text.single : text.double}</strong>
            <span>{value === 1 ? text.singleHint : text.doubleHint}</span>
            <span className="org-leg-count">
              {roundCount(teamCount, value)}{' '}
              {text.round.toLocaleLowerCase('tr-TR')}
            </span>
          </button>
        ))}
      </div>
      <Feedback message={error} />
    </Modal>
  );
}

// Weeks a round robin needs: n-1 (n even) or n (odd, with byes), per leg.
export function roundCount(teams: number, legs: 1 | 2) {
  if (teams < 2) return 0;
  return (teams % 2 === 0 ? teams - 1 : teams) * legs;
}
