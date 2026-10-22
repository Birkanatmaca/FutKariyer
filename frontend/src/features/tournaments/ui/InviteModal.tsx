import { useState, type FormEvent } from 'react';
import { organizerCopy } from '../../../shared/lib/organizer-copy';
import { Button } from '../../../shared/ui/Button';
import { Feedback } from '../../../shared/ui/Feedback';
import { Modal } from '../../../shared/ui/Modal';
import type { Candidate } from '../domain/models';
import type { TournamentService } from '../application/tournament-service';
import { initial } from './format';

const text = organizerCopy.teams;

// Invite a club: search (2+ letters) among eligible clubs, pick one, add an
// optional message and send.
export function InviteModal({
  service,
  tournamentId,
  onClose,
  onDone,
}: {
  service: TournamentService;
  tournamentId: string;
  onClose(): void;
  onDone(name: string): void;
}) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Candidate[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<Candidate | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function find(event: FormEvent) {
    event.preventDefault();
    const query = search.trim();
    if (query.length < 2) {
      setError(text.searchHint);
      return;
    }
    setSearching(true);
    setError(null);
    try {
      setResults(await service.candidates(tournamentId, query));
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : organizerCopy.form.unexpected,
      );
    } finally {
      setSearching(false);
    }
  }
  async function send() {
    if (!picked || busy) return;
    setBusy(true);
    setError(null);
    try {
      await service.invite(tournamentId, picked.id, message);
      onDone(picked.name);
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
      title={text.inviteTitle}
      eyebrow={organizerCopy.workspace.tabs.teams}
      busy={busy}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            {organizerCopy.form.cancel}
          </Button>
          <Button busy={busy} disabled={!picked} onClick={send}>
            {text.send}
          </Button>
        </>
      }
    >
      {picked ? (
        <div className="form-stack">
          <div className="lg-team">
            <span className="avatar">{initial(picked.name)}</span>
            <span className="lg-team-name">
              <strong>{picked.name}</strong>
              <span>
                {[picked.district, organizerCopy.teamTypes[picked.footballType]]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </span>
            <Button
              variant="secondary"
              className="button-small"
              disabled={busy}
              onClick={() => setPicked(null)}
            >
              {text.change}
            </Button>
          </div>
          <label className="field">
            <span>{text.inviteMessage}</span>
            <textarea
              value={message}
              maxLength={500}
              rows={3}
              disabled={busy}
              onChange={event => setMessage(event.target.value)}
            />
          </label>
        </div>
      ) : (
        <>
          <form className="lg-search" onSubmit={find}>
            <input
              type="search"
              value={search}
              maxLength={80}
              autoFocus
              placeholder={text.search}
              aria-label={text.search}
              onChange={event => setSearch(event.target.value)}
            />
            <Button type="submit" variant="secondary" busy={searching}>
              {text.searchButton}
            </Button>
          </form>
          {results === null ? (
            <p className="hint">{text.searchHint}</p>
          ) : results.length ? (
            <ul className="lg-club-list">
              {results.map(club => (
                <li key={club.id}>
                  <span className="avatar">{initial(club.name)}</span>
                  <strong>
                    {club.name}
                    {club.district && (
                      <span className="org-sub"> · {club.district}</span>
                    )}
                  </strong>
                  <Button
                    className="button-small"
                    onClick={() => setPicked(club)}
                  >
                    {text.pick}
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">{text.noCandidates}</p>
          )}
        </>
      )}
      <Feedback message={error} />
    </Modal>
  );
}
