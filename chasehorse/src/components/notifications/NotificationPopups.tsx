import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, BellRing, CheckCircle2, ClipboardList, X } from 'lucide-react';
import type { AppNotification } from '@/types';

const SEEN_KEY = 'ch.popups.seen';
const MAX_VISIBLE = 3;
const AUTO_HIDE_MS = 12000;

/** Types with their own pop-up elsewhere (the Enquiries page) are not repeated here. */
const SKIP_TYPES = new Set(['ENQUIRY']);
const WARN_TYPES = new Set(['TASK_DECLINED', 'TASK_DROPPED', 'TASK_REASSIGNED', 'REWORK_REQUESTED']);
const GOOD_TYPES = new Set(['TASK_ACCEPTED', 'TASK_APPROVED', 'REWARD_CREDITED']);

function readSeen(): Set<string> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(SEEN_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

function writeSeen(seen: Set<string>) {
  try {
    sessionStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(seen).slice(-200)));
  } catch {
    /* private mode: pop-ups may repeat after a reload, nothing else breaks */
  }
}

interface Props {
  notifications: AppNotification[];
  /** Where a click on a notification goes (null = stay). */
  hrefFor: (n: AppNotification) => string | null;
  onOpen: (n: AppNotification) => void;
}

/**
 * Pops up unread notifications: right after login (what arrived while away) and whenever a new
 * one arrives during the session (task assigned, accepted, declined, dropped…).
 */
export function NotificationPopups({ notifications, hrefFor, onOpen }: Props) {
  const navigate = useNavigate();
  const seen = useRef<Set<string>>(readSeen());
  const [queue, setQueue] = useState<AppNotification[]>([]);
  const [overflow, setOverflow] = useState(0);

  useEffect(() => {
    const fresh = notifications.filter((n) => !n.read && !SKIP_TYPES.has(n.type) && !seen.current.has(n.id));
    if (fresh.length === 0) return;
    fresh.forEach((n) => seen.current.add(n.id));
    writeSeen(seen.current);
    setQueue((q) => {
      const merged = [...fresh, ...q];
      setOverflow((o) => o + Math.max(0, merged.length - MAX_VISIBLE));
      return merged.slice(0, MAX_VISIBLE);
    });
  }, [notifications]);

  useEffect(() => {
    if (queue.length === 0) return;
    const t = setTimeout(() => setQueue((q) => q.slice(0, -1)), AUTO_HIDE_MS);
    return () => clearTimeout(t);
  }, [queue]);

  if (queue.length === 0) return null;

  const dismiss = (id: string) => {
    setQueue((q) => q.filter((n) => n.id !== id));
    if (queue.length <= 1) setOverflow(0);
  };

  return (
    <div className="notify-stack" role="region" aria-live="polite" aria-label="New notifications">
      {queue.map((n) => {
        const tone = WARN_TYPES.has(n.type) ? 'warn' : GOOD_TYPES.has(n.type) ? 'good' : '';
        const Icon = tone === 'warn' ? AlertTriangle : tone === 'good' ? CheckCircle2 : n.entityType === 'TASK' ? ClipboardList : BellRing;
        const href = hrefFor(n);
        return (
          <div key={n.id} className={`notify-pop ${tone ? `notify-pop--${tone}` : ''}`}>
            <span className="notify-pop__icon"><Icon size={16} aria-hidden /></span>
            <div>
              <p className="notify-pop__title">{n.title}</p>
              <p className="notify-pop__body">{n.body}</p>
              <div className="notify-pop__actions">
                {href && (
                  <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    onClick={() => {
                      onOpen(n);
                      dismiss(n.id);
                      navigate(href);
                    }}
                  >
                    {n.type === 'TASK_ASSIGNED' ? 'Review task' : 'Open'}
                  </button>
                )}
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => dismiss(n.id)}>
                  Later
                </button>
              </div>
            </div>
            <button type="button" className="notify-pop__close" aria-label="Dismiss" onClick={() => dismiss(n.id)}>
              <X size={16} aria-hidden />
            </button>
          </div>
        );
      })}
      {overflow > 0 && (
        <p className="cell-sub" style={{ textAlign: 'right', margin: 0 }}>
          +{overflow} more in the bell
        </p>
      )}
    </div>
  );
}
