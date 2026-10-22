import { useState, type FormEvent } from 'react';
import { ApiError } from '../../../shared/api/client';
import { organizerCopy } from '../../../shared/lib/organizer-copy';
import { Button } from '../../../shared/ui/Button';
import { Feedback } from '../../../shared/ui/Feedback';
import { Field } from '../../../shared/ui/Field';
import { Modal } from '../../../shared/ui/Modal';
import type { Match, Team } from '../domain/models';
import { fromLocalInput, parseScore, toLocalInput } from '../domain/rules';
import type { TournamentService } from '../application/tournament-service';

const text = organizerCopy.fixtures;

// Add a match or edit one: kickoff, venue and the score (both or none).
export function MatchModal({
  service,
  tournamentId,
  teams,
  initial,
  defaultRound,
  onClose,
  onDone,
}: {
  service: TournamentService;
  tournamentId: string;
  teams: Team[];
  initial?: Match;
  defaultRound: number;
  onClose(): void;
  onDone(): void;
}) {
  const [round, setRound] = useState(String(initial?.round ?? defaultRound));
  const [home, setHome] = useState(
    initial?.homeEntryId ?? teams[0]?.entryId ?? '',
  );
  const [away, setAway] = useState(
    initial?.awayEntryId ?? teams[1]?.entryId ?? '',
  );
  const [kickoff, setKickoff] = useState(
    toLocalInput(initial?.kickoffAt ?? null),
  );
  const [venue, setVenue] = useState(initial?.venue ?? '');
  const [homeGoals, setHomeGoals] = useState(
    initial?.homeGoals == null ? '' : String(initial.homeGoals),
  );
  const [awayGoals, setAwayGoals] = useState(
    initial?.awayGoals == null ? '' : String(initial.awayGoals),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  // A match keeps its teams in the list even if one was later removed.
  const options = [...teams];
  if (initial) {
    for (const [entryId, name] of [
      [initial.homeEntryId, initial.homeName],
      [initial.awayEntryId, initial.awayName],
    ])
      if (!options.some(team => team.entryId === entryId))
        options.push({ entryId, clubId: '', name, district: '', players: 0 });
  }
  async function save(event?: FormEvent) {
    event?.preventDefault();
    if (busy) return;
    const score = parseScore(homeGoals, awayGoals);
    const local: Record<string, string> = {};
    if (home === away) local.teams = text.sameTeam;
    if (!score.ok)
      local.score = score.error === 'both' ? text.scoreBoth : text.scoreRange;
    if (Object.keys(local).length || !score.ok) {
      setFields(local);
      return;
    }
    setBusy(true);
    setError(null);
    setFields({});
    try {
      await service.saveMatch(
        tournamentId,
        {
          round: Number(round),
          homeEntryId: home,
          awayEntryId: away,
          kickoffAt: fromLocalInput(kickoff),
          venue: venue.trim(),
          homeGoals: score.homeGoals,
          awayGoals: score.awayGoals,
        },
        initial?.id,
      );
      onDone();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : organizerCopy.form.unexpected,
      );
      if (failure instanceof ApiError) setFields(failure.fields);
      setBusy(false);
    }
  }
  const select = (
    label: string,
    value: string,
    onChange: (value: string) => void,
  ) => (
    <label className="field">
      <span>{label}</span>
      <select
        required
        value={value}
        disabled={busy}
        onChange={event => onChange(event.target.value)}
      >
        {options.map(team => (
          <option key={team.entryId} value={team.entryId}>
            {team.name}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <Modal
      title={initial ? text.edit : text.add}
      eyebrow={organizerCopy.workspace.tabs.fixtures}
      busy={busy}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            {organizerCopy.form.cancel}
          </Button>
          <Button busy={busy} onClick={() => save()}>
            {text.save}
          </Button>
        </>
      }
    >
      <form className="lg-match-form" onSubmit={save}>
        <Field
          label={text.round}
          type="number"
          min={1}
          max={300}
          required
          value={round}
          disabled={busy}
          error={fields.round}
          onChange={event => setRound(event.target.value)}
        />
        <Field
          label={text.kickoff}
          type="datetime-local"
          value={kickoff}
          disabled={busy}
          error={fields.kickoffAt}
          onChange={event => setKickoff(event.target.value)}
        />
        <div className="lg-wide">
          <Field
            label={text.venue}
            value={venue}
            maxLength={120}
            disabled={busy}
            error={fields.venue}
            onChange={event => setVenue(event.target.value)}
          />
        </div>
        <div className="lg-scoreboard">
          <div className="lg-side">
            {select(text.home, home, setHome)}
            <input
              className="lg-goal"
              type="number"
              inputMode="numeric"
              min={0}
              max={99}
              placeholder="–"
              aria-label={text.homeGoals}
              value={homeGoals}
              disabled={busy}
              onChange={event => setHomeGoals(event.target.value)}
            />
          </div>
          <span className="lg-scoreboard-vs">{text.vs}</span>
          <div className="lg-side">
            {select(text.away, away, setAway)}
            <input
              className="lg-goal"
              type="number"
              inputMode="numeric"
              min={0}
              max={99}
              placeholder="–"
              aria-label={text.awayGoals}
              value={awayGoals}
              disabled={busy}
              onChange={event => setAwayGoals(event.target.value)}
            />
          </div>
        </div>
        {(fields.teams || fields.score) && (
          <p className="field-error lg-wide" role="alert">
            {fields.teams || fields.score}
          </p>
        )}
        <p className="hint lg-wide">{text.scoreHint}</p>
        <button type="submit" hidden />
      </form>
      <Feedback message={error} />
    </Modal>
  );
}
