import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  BellRing, CheckCircle2, Clock, Download, Inbox, Mail, MailCheck, Phone, RefreshCw, Search, Volume2, VolumeX,
} from 'lucide-react';
import {
  enquiryApi, type EnquiryDetail, type EnquiryFilters, type EnquiryPage, type EnquiryRow, type EnquiryStatus,
  type EnquirySummary,
} from '@/api/enquiries';
import { useToast } from '@/context/ToastContext';
import { PageHeader, Card, StatCard } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import type { Tone } from '@/utils/labels';

const PAGE_SIZE = 25;
const POLL_MS = 15000;

const STATUS_META: Record<EnquiryStatus, { label: string; tone: Tone }> = {
  NEW: { label: 'New', tone: 'warning' },
  IN_PROGRESS: { label: 'In progress', tone: 'info' },
  CONTACTED: { label: 'Contacted', tone: 'ai' },
  CLOSED: { label: 'Closed', tone: 'success' },
  SPAM: { label: 'Spam', tone: 'neutral' },
};
const STATUS_TABS: (EnquiryStatus | '')[] = ['', 'NEW', 'IN_PROGRESS', 'CONTACTED', 'CLOSED', 'SPAM'];

const fmt = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const minutesLabel = (m: number | null) => {
  if (m === null || m === undefined) return '—';
  if (m < 60) return `${Math.round(m)} min`;
  if (m < 60 * 24) return `${(m / 60).toFixed(1)} h`;
  return `${(m / 60 / 24).toFixed(1)} d`;
};

/** A short, quiet two-tone chime (no audio file needed). */
function playChime() {
  try {
    const ctx = new AudioContext();
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.16);
      gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + i * 0.16 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.16 + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.16);
      osc.stop(ctx.currentTime + i * 0.16 + 0.32);
    });
    window.setTimeout(() => void ctx.close(), 1000);
  } catch {
    /* audio unavailable */
  }
}

const readPref = (key: string, fallback: boolean) => {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === '1';
  } catch {
    return fallback;
  }
};
const writePref = (key: string, value: boolean) => {
  try { localStorage.setItem(key, value ? '1' : '0'); } catch { /* storage unavailable */ }
};

export function EnquiriesPage() {
  const { notify } = useToast();
  const [params, setParams] = useSearchParams();

  const [filters, setFilters] = useState<EnquiryFilters>({ status: '' });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [data, setData] = useState<EnquiryPage | null>(null);
  const [summary, setSummary] = useState<EnquirySummary | null>(null);
  const [formTypes, setFormTypes] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const [sound, setSound] = useState(() => readPref('ch.enquiries.sound', true));
  const [desktop, setDesktop] = useState(() =>
    typeof Notification !== 'undefined' && Notification.permission === 'granted' && readPref('ch.enquiries.desktop', true));
  const [exporting, setExporting] = useState(false);

  const openId = params.get('open');
  const lastSeen = useRef<string | null>(null);

  // ------------------------------------------------------------- loading

  const load = useCallback(async () => {
    setError(null);
    try {
      const [list, sum] = await Promise.all([enquiryApi.list(filters, page, PAGE_SIZE), enquiryApi.summary()]);
      setData(list);
      setSummary(sum);
      if (!lastSeen.current) lastSeen.current = sum.latestCreatedAt ?? new Date().toISOString();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load enquiries');
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { enquiryApi.formTypes().then(setFormTypes).catch(() => {}); }, []);

  // Debounced search
  useEffect(() => {
    const t = window.setTimeout(() => {
      setPage(0);
      setFilters((f) => (f.q === search ? f : { ...f, q: search }));
    }, 350);
    return () => window.clearTimeout(t);
  }, [search]);

  // ------------------------------------------------------------- live updates

  useEffect(() => {
    const tick = async () => {
      if (!lastSeen.current || document.hidden) return;
      try {
        const fresh = await enquiryApi.updates(lastSeen.current);
        if (fresh.length === 0) return;
        lastSeen.current = fresh[0].createdAt;
        setFreshIds((prev) => new Set([...prev, ...fresh.map((f) => f.id)]));
        fresh.slice(0, 3).forEach((e) => notify({
          title: `New enquiry ${e.reference}`,
          message: `${e.formLabel} from ${e.name}${e.company ? ` (${e.company})` : ''}`,
          tone: 'info',
        }));
        if (fresh.length > 3) notify({ title: 'New enquiries', message: `${fresh.length - 3} more just arrived`, tone: 'info' });
        if (sound) playChime();
        if (desktop && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          const e = fresh[0];
          const n = new Notification(fresh.length > 1 ? `${fresh.length} new ChaseHorse enquiries` : `New enquiry ${e.reference}`, {
            body: `${e.formLabel} from ${e.name}`,
            tag: 'chasehorse-enquiry',
          });
          n.onclick = () => { window.focus(); setParams({ open: e.id }); };
        }
        void load();
      } catch {
        /* transient; next poll retries */
      }
    };
    const timer = window.setInterval(tick, POLL_MS);
    return () => window.clearInterval(timer);
  }, [notify, sound, desktop, load, setParams]);

  const toggleSound = () => setSound((s) => { writePref('ch.enquiries.sound', !s); return !s; });
  const toggleDesktop = async () => {
    if (typeof Notification === 'undefined') {
      notify('Desktop notifications are not supported in this browser.', 'info');
      return;
    }
    if (desktop) {
      setDesktop(false);
      writePref('ch.enquiries.desktop', false);
      return;
    }
    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (permission === 'granted') {
      setDesktop(true);
      writePref('ch.enquiries.desktop', true);
    } else {
      notify('Desktop notifications were blocked in the browser settings.', 'info');
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      await enquiryApi.exportCsv(filters);
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Export failed', 'danger');
    } finally {
      setExporting(false);
    }
  };

  const setStatusFilter = (status: EnquiryStatus | '') => { setPage(0); setFilters((f) => ({ ...f, status })); };
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  const tabCount = (s: EnquiryStatus | '') => {
    if (!summary) return null;
    return { '': summary.total, NEW: summary.newCount, IN_PROGRESS: summary.inProgress, CONTACTED: summary.contacted, CLOSED: summary.closed, SPAM: summary.spam }[s];
  };

  return (
    <div className="stack">
      <PageHeader
        title="Enquiry Management"
        description="Every website form — contact, partner onboarding, bookings, careers — with a verified e-mail. New entries appear here automatically."
        actions={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button size="sm" variant="ghost" onClick={toggleSound} aria-pressed={sound} title="Sound for new enquiries">
              {sound ? <Volume2 size={16} /> : <VolumeX size={16} />} Sound
            </Button>
            <Button size="sm" variant="ghost" onClick={toggleDesktop} aria-pressed={desktop} title="Desktop pop-up for new enquiries">
              <BellRing size={16} /> {desktop ? 'Desktop alerts on' : 'Enable desktop alerts'}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => void load()}><RefreshCw size={16} /> Refresh</Button>
            <Button size="sm" variant="primary" onClick={exportCsv} disabled={exporting}>
              <Download size={16} /> {exporting ? 'Exporting…' : 'Export CSV'}
            </Button>
          </div>
        }
      />

      <div className="grid grid--stats">
        <StatCard label="New (unhandled)" value={summary?.newCount ?? '—'} icon={Inbox} tone="warning" hint="Awaiting first response" />
        <StatCard label="Received today" value={summary?.today ?? '—'} icon={MailCheck} tone="brand" />
        <StatCard label="In progress" value={summary?.inProgress ?? '—'} icon={Clock} tone="ai" />
        <StatCard label="Avg. first response" value={minutesLabel(summary?.avgFirstResponseMinutes ?? null)} icon={CheckCircle2} tone="success" hint="Last 30 days" />
      </div>

      <Card>
        <div className="toolbar" style={{ marginBottom: 12 }}>
          <div className="segmented" role="tablist" aria-label="Filter by status">
            {STATUS_TABS.map((s) => (
              <button key={s || 'ALL'} type="button" role="tab" aria-selected={filters.status === s}
                className={`segmented__btn ${filters.status === s ? 'segmented__btn--on' : ''}`}
                onClick={() => setStatusFilter(s)}>
                {s ? STATUS_META[s].label : 'All'}
                {tabCount(s) !== null && <span className="segmented__count">{tabCount(s)}</span>}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <select className="input input--compact" aria-label="Form" value={filters.formType ?? ''}
              onChange={(e) => { setPage(0); setFilters((f) => ({ ...f, formType: e.target.value })); }}>
              <option value="">All forms</option>
              {formTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <input type="date" className="input input--compact" aria-label="From date"
              onChange={(e) => { setPage(0); setFilters((f) => ({ ...f, from: e.target.value ? new Date(`${e.target.value}T00:00:00`).toISOString() : undefined })); }} />
            <input type="date" className="input input--compact" aria-label="To date"
              onChange={(e) => { setPage(0); setFilters((f) => ({ ...f, to: e.target.value ? new Date(`${e.target.value}T23:59:59`).toISOString() : undefined })); }} />
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)' }} />
              <input className="input input--search input--compact" placeholder="Search name, e-mail, company, ref…"
                value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search enquiries" />
            </div>
          </div>
        </div>

        {loading ? (
          <Skeleton lines={6} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState title="No enquiries match" description="New website enquiries appear here as soon as they are submitted." />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Received</th>
                    <th scope="col">Enquiry</th>
                    <th scope="col">Contact</th>
                    <th scope="col">Form</th>
                    <th scope="col">Status</th>
                    <th scope="col">Assigned</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((e) => (
                    <EnquiryTableRow key={e.id} row={e} fresh={freshIds.has(e.id)}
                      onOpen={() => { setFreshIds((p) => { const n = new Set(p); n.delete(e.id); return n; }); setParams({ open: e.id }); }} />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="toolbar" style={{ marginTop: 12 }}>
              <span className="muted">{data.total} enquir{data.total === 1 ? 'y' : 'ies'}</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                <span className="muted">Page {page + 1} of {totalPages}</span>
                <Button size="sm" variant="ghost" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          </>
        )}
      </Card>

      {openId && (
        <EnquiryDetailDialog
          id={openId}
          onClose={() => setParams({})}
          onChanged={() => void load()}
        />
      )}
    </div>
  );
}

function EnquiryTableRow({ row, fresh, onOpen }: { row: EnquiryRow; fresh: boolean; onOpen: () => void }) {
  const meta = STATUS_META[row.status];
  return (
    <tr onClick={onOpen} style={{ cursor: 'pointer', background: fresh ? 'rgba(255, 77, 22, 0.07)' : undefined }}
      tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(); }} aria-label={`Open enquiry ${row.reference}`}>
      <td style={{ whiteSpace: 'nowrap' }}>
        <span className="cell-title">{fmt(row.createdAt)}</span>
        {fresh && <span className="cell-sub" style={{ color: '#FF4D16', fontWeight: 700 }}>Just in</span>}
      </td>
      <td>
        <span className="cell-title">{row.name}{row.company ? ` · ${row.company}` : ''}</span>
        <span className="cell-sub" style={{ fontFamily: 'var(--font-mono, monospace)' }}>{row.reference}</span>
      </td>
      <td>
        <span className="cell-title">{row.email}</span>
        <span className="cell-sub">{row.phone ?? '—'}{row.city ? ` · ${row.city}` : ''}</span>
      </td>
      <td>{row.formLabel}</td>
      <td><Badge tone={meta.tone}>{meta.label}</Badge></td>
      <td>{row.assigneeName ?? <span className="muted">Unassigned</span>}</td>
    </tr>
  );
}

function EnquiryDetailDialog({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const { notify } = useToast();
  const [detail, setDetail] = useState<EnquiryDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [staff, setStaff] = useState<{ id: string; name: string; email: string }[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    setDetail(null);
    setError(null);
    enquiryApi.get(id).then((d) => { if (active) setDetail(d); })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : 'Could not load the enquiry'); });
    enquiryApi.staff().then((s) => { if (active) setStaff(s); }).catch(() => {});
    return () => { active = false; };
  }, [id]);

  const run = async (action: () => Promise<EnquiryDetail>, done: string) => {
    setBusy(true);
    try {
      setDetail(await action());
      onChanged();
      notify(done);
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Update failed', 'danger');
    } finally {
      setBusy(false);
    }
  };

  const e = detail?.enquiry;
  const replySubject = e ? `Re: your ChaseHorse enquiry ${e.reference}` : '';
  const facts = useMemo(() => (detail ? Object.entries(detail.details) : []), [detail]);

  return (
    <Dialog
      open
      onClose={onClose}
      title={e ? `${e.reference} · ${e.formLabel}` : 'Enquiry'}
      footer={<Button variant="ghost" onClick={onClose}>Close</Button>}
    >
      {error ? <ErrorState message={error} /> : !detail || !e ? <Skeleton lines={8} /> : (
        <div className="stack" style={{ gap: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <Badge tone={STATUS_META[e.status].tone}>{STATUS_META[e.status].label}</Badge>
            <span className="muted">Received {fmt(e.createdAt)}</span>
            <span className="muted">· E-mail verified {fmt(detail.emailVerifiedAt)}</span>
            {detail.sourcePage && <span className="muted">· from {detail.sourcePage}</span>}
          </div>

          <section aria-label="Contact">
            <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>{e.name}{e.company ? ` · ${e.company}` : ''}</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <a href={`mailto:${e.email}?subject=${encodeURIComponent(replySubject)}`}><Mail size={14} /> {e.email}</a>
              {e.phone && <a href={`tel:${e.phone.replace(/[^+\d]/g, '')}`}><Phone size={14} /> {e.phone}</a>}
              {e.city && <span className="muted">{e.city}</span>}
            </div>
          </section>

          {detail.message && (
            <section aria-label="Message">
              <h4 style={{ margin: '0 0 4px', fontSize: 13 }}>Message</h4>
              <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{detail.message}</p>
            </section>
          )}

          {facts.length > 0 && (
            <section aria-label="Submitted details">
              <h4 style={{ margin: '0 0 6px', fontSize: 13 }}>Submitted details</h4>
              <div className="table-wrap">
                <table className="table">
                  <tbody>
                    {facts.map(([k, v]) => (
                      <tr key={k}>
                        <th scope="row" style={{ width: '38%', fontWeight: 600 }}>{k}</th>
                        <td style={{ whiteSpace: 'pre-wrap' }}>{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section aria-label="Workflow" style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>Status</span>
              <select className="input" value={e.status} disabled={busy}
                onChange={(ev) => run(() => enquiryApi.setStatus(e.id, ev.target.value as EnquiryStatus), 'Status updated')}>
                {(Object.keys(STATUS_META) as EnquiryStatus[]).map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>Assigned to</span>
              <select className="input" value={e.assignedTo ?? ''} disabled={busy}
                onChange={(ev) => run(() => enquiryApi.assign(e.id, ev.target.value || null), 'Assignment updated')}>
                <option value="">Unassigned</option>
                {staff.map((s) => <option key={s.id} value={s.id}>{s.name || s.email}</option>)}
              </select>
            </label>
          </section>

          <section aria-label="Internal note">
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>Internal note (not sent to the customer)</span>
              <textarea className="input input--area" rows={2} maxLength={2000} value={note}
                onChange={(ev) => setNote(ev.target.value)} placeholder="e.g. Called, sending quote by Friday" />
            </label>
            <div style={{ marginTop: 6 }}>
              <Button size="sm" variant="secondary" disabled={busy || !note.trim()}
                onClick={() => run(() => enquiryApi.addNote(e.id, note.trim()), 'Note added').then(() => setNote(''))}>
                Add note
              </Button>
            </div>
          </section>

          <section aria-label="History">
            <h4 style={{ margin: '0 0 6px', fontSize: 13 }}>History</h4>
            <ol style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
              {detail.events.map((ev, i) => (
                <li key={i} style={{ fontSize: 13 }}>
                  <span className="muted">{fmt(ev.createdAt)} · </span>
                  {ev.eventType === 'CREATED' && <>Submitted on the website{ev.note ? ` (${ev.note.replace('Submitted via ', '')})` : ''}</>}
                  {ev.eventType === 'STATUS_CHANGED' && <><strong>{ev.actorName ?? 'Staff'}</strong> changed status {STATUS_META[ev.oldValue as EnquiryStatus]?.label ?? ev.oldValue} → {STATUS_META[ev.newValue as EnquiryStatus]?.label ?? ev.newValue}</>}
                  {ev.eventType === 'ASSIGNED' && <><strong>{ev.actorName ?? 'Staff'}</strong> assigned to {ev.newValue}</>}
                  {ev.eventType === 'NOTE' && <><strong>{ev.actorName ?? 'Staff'}</strong> noted:</>}
                  {ev.note && ev.eventType !== 'CREATED' && <div style={{ whiteSpace: 'pre-wrap' }}>{ev.note}</div>}
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}
    </Dialog>
  );
}
