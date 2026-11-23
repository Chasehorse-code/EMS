import { useEffect, useMemo, useState } from 'react';
import { MapPin, Search, ShieldCheck, AlertTriangle, Users, ClipboardList, UserCog, X } from 'lucide-react';
import { api } from '@/api';
import { useToast } from '@/context/ToastContext';
import { PageHeader, Card, StatCard } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState, Skeleton } from '@/components/ui/States';
import type { AreaCoverageView, ManagerOption } from '@/types';

type FilterTab = 'all' | 'gap' | 'covered' | 'idle';

const zonesOf = (m: ManagerOption) =>
  m.zones ?? (m.stateCode ? [{ stateCode: m.stateCode, stateName: m.stateName || m.stateCode }] : []);

/**
 * Admin: decide which zones (states) each operations manager runs — one or many.
 * A manager sees only the workers, tasks, approvals and tickets of their zones.
 */
export function AdminAreasPage() {
  const { notify } = useToast();

  const [loading, setLoading] = useState(true);
  const [coverage, setCoverage] = useState<AreaCoverageView[]>([]);
  const [managers, setManagers] = useState<ManagerOption[]>([]);
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Zone editor (per manager)
  const [editing, setEditing] = useState<ManagerOption | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [zoneQuery, setZoneQuery] = useState('');
  // Quick "add a manager to this state"
  const [stateTarget, setStateTarget] = useState<AreaCoverageView | null>(null);
  const [targetManagerId, setTargetManagerId] = useState('');
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [covList, mgrList] = await Promise.all([api.getAreaCoverage(), api.getAdminManagers()]);
      setCoverage(covList);
      setManagers(mgrList);
    } catch {
      notify('Could not load zone coverage', 'info');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const metrics = useMemo(() => {
    const coveredStates = coverage.filter((c) => c.status === 'COVERED').length;
    const coverageGaps = coverage.filter((c) => c.status === 'COVERAGE_GAP').length;
    const idle = coverage.filter((c) => c.status === 'NO_ACTIVITY').length;
    const totalWorkers = coverage.reduce((sum, c) => sum + (c.activeWorkers || 0), 0);
    const totalTasks = coverage.reduce((sum, c) => sum + (c.openTasks || 0), 0);
    return { totalStates: coverage.length, coveredStates, coverageGaps, idle, totalWorkers, totalTasks };
  }, [coverage]);

  const visible = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return coverage.filter((c) => {
      if (filterTab === 'gap' && c.status !== 'COVERAGE_GAP') return false;
      if (filterTab === 'covered' && c.status !== 'COVERED') return false;
      if (filterTab === 'idle' && c.status !== 'NO_ACTIVITY') return false;
      if (!q) return true;
      return [c.stateName, c.stateCode, c.managerName, c.managerEmail].some((v) => v && v.toLowerCase().includes(q));
    });
  }, [coverage, filterTab, searchQuery]);

  const zoneChoices = useMemo(() => {
    const q = zoneQuery.trim().toLowerCase();
    return coverage
      .filter((c) => !q || c.stateName.toLowerCase().includes(q) || c.stateCode.toLowerCase().includes(q))
      .sort((a, b) => Number(picked.includes(b.stateCode)) - Number(picked.includes(a.stateCode)) || a.stateName.localeCompare(b.stateName));
  }, [coverage, zoneQuery, picked]);

  const openEditor = (m: ManagerOption) => {
    setEditing(m);
    setPicked(zonesOf(m).map((z) => z.stateCode));
    setZoneQuery('');
  };

  const togglePicked = (code: string) =>
    setPicked((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));

  const saveZones = async (managerId: string, codes: string[], label: string) => {
    setSaving(true);
    try {
      await api.assignManagerZones(managerId, codes);
      notify(label);
      setEditing(null);
      setStateTarget(null);
      await loadData();
    } catch (err: any) {
      notify(err?.message || 'Could not save the zones', 'info');
    } finally {
      setSaving(false);
    }
  };

  const addManagerToState = () => {
    const m = managers.find((x) => x.managerId === targetManagerId);
    if (!m || !stateTarget) return;
    const codes = Array.from(new Set([...zonesOf(m).map((z) => z.stateCode), stateTarget.stateCode]));
    saveZones(m.managerId, codes, `${m.managerName} now also manages ${stateTarget.stateName}.`);
  };

  return (
    <>
      <PageHeader
        title="Zones & Operations Managers"
        description="Give each operations manager one or more zones. Managers only see the field workers, tasks, approvals and tickets inside their zones."
      />

      <div className="grid grid--stats" style={{ marginBottom: '1.5rem' }}>
        <StatCard label="Zones (states & UTs)" value={metrics.totalStates} icon={MapPin} hint="All Indian states & UTs" />
        <StatCard label="Covered" value={metrics.coveredStates} icon={ShieldCheck} tone="success" hint="Have a manager" />
        <StatCard
          label="Coverage gaps"
          value={metrics.coverageGaps}
          icon={AlertTriangle}
          tone={metrics.coverageGaps > 0 ? 'danger' : 'neutral'}
          hint={metrics.coverageGaps > 0 ? 'Workers or open tasks with no manager' : 'Every active zone is managed'}
        />
        <StatCard label="Active field workers" value={metrics.totalWorkers} icon={Users} tone="brand" hint={`${metrics.totalTasks} open tasks`} />
      </div>

      {/* Managers and their zones */}
      <Card>
        <div className="card__header" style={{ marginBottom: '1rem' }}>
          <div>
            <h2 className="card__title">Operations managers</h2>
            <p className="card__subtitle">Click “Edit zones” to give a manager one zone or many.</p>
          </div>
        </div>
        {loading ? (
          <Skeleton lines={3} />
        ) : managers.length === 0 ? (
          <EmptyState
            title="No operations managers yet"
            description="Give someone the Operations Manager role in Employees → Assign Authorized Role, then come back to set their zones."
          />
        ) : (
          <div className="zone-managers">
            {managers.map((m) => {
              const zones = zonesOf(m);
              return (
                <div key={m.managerId} className="zone-manager">
                  <div className="zone-manager__who">
                    <Avatar name={m.managerName || m.managerEmail} size={36} />
                    <div style={{ minWidth: 0 }}>
                      <p className="cell-title">{m.managerName || 'Unnamed manager'}</p>
                      <p className="cell-sub">{m.managerEmail}</p>
                    </div>
                  </div>
                  <div className="zone-manager__zones">
                    {zones.length === 0 ? (
                      <Badge tone="warning">No zone yet</Badge>
                    ) : (
                      zones.map((z) => (
                        <span key={z.stateCode} className="zone-chip" title={z.stateName}>
                          <b>{z.stateCode}</b> {z.stateName}
                        </span>
                      ))
                    )}
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => openEditor(m)}>
                    <UserCog size={14} aria-hidden /> Edit zones
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* State coverage */}
      <Card>
        <div className="toolbar" style={{ marginBottom: '1.25rem', gap: '1rem', flexWrap: 'wrap' }}>
          <div className="segmented" role="group" aria-label="Filter zones">
            {([
              ['all', 'All', coverage.length],
              ['gap', 'Gaps', metrics.coverageGaps],
              ['covered', 'Covered', metrics.coveredStates],
              ['idle', 'No activity', metrics.idle],
            ] as const).map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                className={`segmented__btn ${filterTab === key ? 'segmented__btn--on' : ''}`}
                onClick={() => setFilterTab(key)}
              >
                {label} <span className="segmented__count">{count}</span>
              </button>
            ))}
          </div>
          <div className="search" style={{ flex: 1, maxWidth: 380 }}>
            <Search size={16} aria-hidden />
            <input
              type="search"
              className="input input--search"
              placeholder="Search state, code or manager…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <Skeleton lines={6} />
        ) : visible.length === 0 ? (
          <EmptyState title="No zones match" description="Change the filter or search." />
        ) : (
          <div className="table-wrap">
            <table className="table" aria-label="Zone coverage">
              <thead>
                <tr>
                  <th scope="col">Zone</th>
                  <th scope="col">Manager(s)</th>
                  <th scope="col">Active workers</th>
                  <th scope="col">Open tasks</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="table__action-col">Action</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((c) => (
                  <tr key={c.stateCode} className={c.status === 'COVERAGE_GAP' ? 'row--alert' : undefined}>
                    <td>
                      <span className="zone-chip"><b>{c.stateCode}</b> {c.stateName}</span>
                    </td>
                    <td>
                      {c.managerName ? (
                        <>
                          <p className="cell-title">{c.managerName}</p>
                          <p className="cell-sub">{c.managerEmail}</p>
                        </>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      <span className="inline-metric"><Users size={14} aria-hidden /> {c.activeWorkers}</span>
                    </td>
                    <td>
                      <span className="inline-metric"><ClipboardList size={14} aria-hidden /> {c.openTasks}</span>
                    </td>
                    <td>
                      {c.status === 'COVERED' ? (
                        <Badge tone="success">Covered</Badge>
                      ) : c.status === 'COVERAGE_GAP' ? (
                        <Badge tone="danger">Gap</Badge>
                      ) : (
                        <Badge tone="neutral">No activity</Badge>
                      )}
                    </td>
                    <td className="table__action-col">
                      <Button
                        variant={c.status === 'COVERAGE_GAP' ? 'primary' : 'secondary'}
                        size="sm"
                        disabled={managers.length === 0}
                        onClick={() => {
                          setStateTarget(c);
                          setTargetManagerId(managers[0]?.managerId ?? '');
                        }}
                      >
                        Add manager
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Multi-zone editor */}
      <Dialog
        open={Boolean(editing)}
        onClose={() => !saving && setEditing(null)}
        title={editing ? `Zones for ${editing.managerName || editing.managerEmail}` : 'Zones'}
        footer={
          <div className="btn-row btn-row--end" style={{ width: '100%' }}>
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={saving}>Cancel</Button>
            <Button
              variant="primary"
              disabled={saving}
              onClick={() =>
                editing &&
                saveZones(
                  editing.managerId,
                  picked,
                  picked.length === 0
                    ? `${editing.managerName} no longer manages any zone.`
                    : `${editing.managerName} now manages ${picked.length} zone${picked.length > 1 ? 's' : ''}.`,
                )
              }
            >
              {saving ? 'Saving…' : `Save ${picked.length} zone${picked.length === 1 ? '' : 's'}`}
            </Button>
          </div>
        }
      >
        {editing && (
          <div className="stack" style={{ gap: '1rem' }}>
            <p className="muted" style={{ margin: 0 }}>
              Tick every zone this manager runs. They will see the field workers, tasks, approvals and tickets of these zones
              only; everything else stays hidden from them.
            </p>
            {picked.length > 0 && (
              <div className="chips">
                {picked.map((code) => (
                  <button key={code} type="button" className="zone-chip zone-chip--on" onClick={() => togglePicked(code)}>
                    <b>{code}</b> {coverage.find((c) => c.stateCode === code)?.stateName}
                    <X size={12} aria-label="Remove" />
                  </button>
                ))}
              </div>
            )}
            <div className="search">
              <Search size={16} aria-hidden />
              <input
                type="search"
                className="input input--search"
                placeholder="Search a state or UT…"
                value={zoneQuery}
                onChange={(e) => setZoneQuery(e.target.value)}
                autoFocus
              />
            </div>
            <div className="zone-picker" role="group" aria-label="Zones">
              {zoneChoices.map((c) => {
                const on = picked.includes(c.stateCode);
                return (
                  <label key={c.stateCode} className={`zone-option ${on ? 'zone-option--on' : ''}`}>
                    <input type="checkbox" checked={on} onChange={() => togglePicked(c.stateCode)} />
                    <span className="zone-option__name">{c.stateName}</span>
                    <span className="zone-option__meta">
                      {c.stateCode} · {c.activeWorkers} workers · {c.openTasks} open
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </Dialog>

      {/* Add a manager to one state */}
      <Dialog
        open={Boolean(stateTarget)}
        onClose={() => !saving && setStateTarget(null)}
        title={stateTarget ? `Add a manager to ${stateTarget.stateName}` : 'Add manager'}
        footer={
          <div className="btn-row btn-row--end" style={{ width: '100%' }}>
            <Button variant="ghost" onClick={() => setStateTarget(null)} disabled={saving}>Cancel</Button>
            <Button variant="primary" disabled={saving || !targetManagerId} onClick={addManagerToState}>
              {saving ? 'Saving…' : 'Add zone to manager'}
            </Button>
          </div>
        }
      >
        {stateTarget && (
          <div className="stack" style={{ gap: '1rem' }}>
            <p className="muted" style={{ margin: 0 }}>
              {stateTarget.stateName} is added to the manager's existing zones; nothing they already manage is removed.
            </p>
            <label className="field">
              <span className="field__label">Operations manager</span>
              <select className="input" value={targetManagerId} onChange={(e) => setTargetManagerId(e.target.value)}>
                {managers.map((m) => {
                  const zones = zonesOf(m);
                  return (
                    <option key={m.managerId} value={m.managerId}>
                      {m.managerName} — {zones.length ? zones.map((z) => z.stateCode).join(', ') : 'no zone yet'}
                    </option>
                  );
                })}
              </select>
            </label>
          </div>
        )}
      </Dialog>
    </>
  );
}
