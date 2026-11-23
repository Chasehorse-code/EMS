import { useEffect, useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';

const MIN = 5;
const MAX = 500;

interface ReasonDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  presets: string[];
  busy?: boolean;
  danger?: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

/** Asks for a short reason (quick picks + free text) before declining or dropping a task. */
export function ReasonDialog({ open, title, description, confirmLabel, presets, busy, danger, onConfirm, onClose }: ReasonDialogProps) {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  const clean = reason.trim();
  const valid = clean.length >= MIN && clean.length <= MAX;

  return (
    <Dialog
      open={open}
      onClose={() => !busy && onClose()}
      title={title}
      footer={
        <div className="btn-row btn-row--end" style={{ width: '100%' }}>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant={danger ? 'danger' : 'primary'} disabled={!valid || busy} onClick={() => onConfirm(clean)}>
            {busy ? 'Sending…' : confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="stack" style={{ gap: '0.9rem' }}>
        <p className="muted" style={{ margin: 0 }}>{description}</p>
        <div className="chips" role="group" aria-label="Common reasons">
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              className={`reason-chip ${clean === p ? 'reason-chip--on' : ''}`}
              onClick={() => setReason(p)}
              disabled={busy}
            >
              {p}
            </button>
          ))}
        </div>
        <label className="field">
          <span className="field__label">Reason <span className="field__req">*</span></span>
          <textarea
            className="input"
            rows={3}
            maxLength={MAX}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Tell your operations manager what happened"
            disabled={busy}
          />
          <span className="field__hint">
            {clean.length < MIN ? `At least ${MIN} characters` : `${clean.length}/${MAX}`} · your manager and the admin receive this by e-mail
          </span>
        </label>
      </div>
    </Dialog>
  );
}
