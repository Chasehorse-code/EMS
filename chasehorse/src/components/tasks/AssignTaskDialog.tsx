import { useEffect, useMemo, useState } from 'react';
import { MapPin, Navigation, Radio, Search } from 'lucide-react';
import { api } from '@/api';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Skeleton, EmptyState } from '@/components/ui/States';
import { formatDate, formatInr } from '@/utils/format';
import type { EligibleWorker, Task } from '@/types';

interface AssignTaskDialogProps {
  task: Task | null;
  /** Admins may assign outside the radius; managers may not. */
  isAdmin: boolean;
  onClose: () => void;
  onAssigned: (workerName: string) => void;
}

/**
 * Rapido-style assignment: workers of the task's zone, nearest first, with live / zone location
 * and how busy they are. Workers outside the radius are greyed out for managers.
 */
export function AssignTaskDialog({ task, isAdmin, onClose, onAssigned }: AssignTaskDialogProps) {
  const [workers, setWorkers] = useState<EligibleWorker[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pick, setPick] = useState('');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!task) return;
    let alive = true;
    setWorkers(null);
    setError(null);
    setPick('');
    setQuery('');
    api
      .getEligibleWorkers(task.id)
      .then((list) => alive && setWorkers(list))
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'Could not load workers'));
    return () => {
      alive = false;
    };
  }, [task]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (workers ?? []).filter(
      (w) => !q || [w.name, w.displayId, w.zone].some((v) => v && v.toLowerCase().includes(q)),
    );
  }, [workers, query]);

  const inRadius = (workers ?? []).filter((w) => w.withinRadius).length;
  const reassign = Boolean(task?.assigneeId);

  async function confirm() {
    if (!task || !pick) return;
    setBusy(true);
    setError(null);
    try {
      await api.assignTask(task.id, pick);
      onAssigned(workers?.find((w) => w.id === pick)?.name || 'the worker');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Assignment failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={Boolean(task)}
      onClose={() => !busy && onClose()}
      title={task ? `${reassign ? 'Re-assign' : 'Assign'}: ${task.title}` : 'Assign task'}
      footer={
        <div className="btn-row btn-row--end" style={{ width: '100%' }}>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="primary" onClick={confirm} disabled={!pick || busy}>
            {busy ? 'Sending…' : reassign ? 'Re-assign & notify' : 'Assign & notify'}
          </Button>
        </div>
      }
    >
      {task && (
        <div className="stack" style={{ gap: '0.9rem' }}>
          <div className="assign-summary">
            <span><MapPin size={14} aria-hidden /> {task.location?.area || task.location?.address || 'Task site'}</span>
            <span>Due {formatDate(task.dueAt)}</span>
            <span>Reward <b>{formatInr(task.rewardInr)}</b></span>
          </div>
          <p className="muted" style={{ margin: 0 }}>
            The worker gets a pop-up and an e-mail and must accept or decline.
            {reassign && ' The current worker is told the task has been re-assigned.'}
            {workers && ` ${inRadius} of ${workers.length} workers are within the task radius.`}
          </p>

          <div className="search">
            <Search size={16} aria-hidden />
            <input
              type="search"
              className="input input--search"
              placeholder="Search name, EMP ID or town…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {error && <div className="callout callout--danger" role="alert">{error}</div>}

          {!workers && !error ? (
            <Skeleton lines={4} />
          ) : visible.length === 0 ? (
            <EmptyState
              title="No active workers in this zone"
              description="Approve field workers registered in this state, or ask nearby workers to share their live location."
            />
          ) : (
            <div className="worker-pick" role="radiogroup" aria-label="Field workers">
              {visible.map((w) => {
                const disabled = !w.withinRadius && !isAdmin;
                const current = w.id === task.assigneeId;
                return (
                  <label
                    key={w.id}
                    className={`worker-option ${pick === w.id ? 'worker-option--on' : ''} ${disabled ? 'worker-option--off' : ''}`}
                    title={disabled ? 'Outside the task radius' : undefined}
                  >
                    <input
                      type="radio"
                      name="assignee"
                      value={w.id}
                      checked={pick === w.id}
                      disabled={disabled || busy}
                      onChange={() => setPick(w.id)}
                    />
                    <Avatar name={w.name} size={34} />
                    <span className="worker-option__who">
                      <b>{w.name}</b>
                      <span>{[w.displayId, w.zone].filter(Boolean).join(' · ')}</span>
                    </span>
                    <span className="worker-option__meta">
                      <span className="worker-option__km">
                        {w.distanceKm != null ? `${w.distanceKm.toFixed(1)} km` : '—'}
                      </span>
                      {w.locationSource === 'LIVE' ? (
                        <span className="live-pill"><Radio size={11} aria-hidden /> live</span>
                      ) : w.locationSource === 'ZONE' ? (
                        <span className="zone-pill"><Navigation size={11} aria-hidden /> zone</span>
                      ) : null}
                    </span>
                    <span className="worker-option__tags">
                      {current && <Badge tone="info">Current</Badge>}
                      {!w.withinRadius && <Badge tone="warning">Outside radius</Badge>}
                      {w.activeTasks > 0 && <Badge tone="neutral">{w.activeTasks} active</Badge>}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}
