import { useEffect, useRef, useState, type ReactNode } from 'react';
import { copy } from '../lib/copy';
import { Button } from './Button';
import { Feedback } from './Feedback';
import { NavIcon } from './NavIcon';

// One modal for the panel (21 Oct 2026): the native dialog gives the focus
// trap, Esc and the backdrop; busy blocks closing while something saves.
export function Modal({
  title,
  eyebrow,
  size = 'md',
  busy = false,
  onClose,
  children,
  footer,
}: {
  title: string;
  eyebrow?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  busy?: boolean;
  onClose(): void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className={'modal modal-' + size}
      aria-label={title}
      onCancel={event => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={event => {
        // A click on the backdrop (the dialog itself, outside its box).
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="modal-box">
        <header className="modal-header">
          <div>
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            <h2>{title}</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label={copy.form.close}
            disabled={busy}
            onClick={onClose}
          >
            <NavIcon name="close" />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </div>
    </dialog>
  );
}

// A yes/no question for destructive actions, instead of window.confirm.
export function ConfirmDialog({
  title,
  message,
  confirm,
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  confirm: string;
  onConfirm(): Promise<void>;
  onClose(): void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal
      title={title}
      size="sm"
      busy={busy}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            {copy.form.cancel}
          </Button>
          <Button
            variant="danger"
            busy={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await onConfirm();
              } catch (failure) {
                setError(
                  failure instanceof Error
                    ? failure.message
                    : copy.form.unexpected,
                );
                setBusy(false);
              }
            }}
          >
            {confirm}
          </Button>
        </>
      }
    >
      <p className="modal-message">{message}</p>
      <Feedback message={error} />
    </Modal>
  );
}
