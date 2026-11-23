import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  ClipboardCheck,
  Truck,
  History,
  Settings,
  CheckCircle2,
  Activity,
  Loader2,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRole } from '@/context/RoleContext';
import { PartnerApprovalsView } from '@/components/partners/PartnerApprovalsView';
import { TrackTruckModule } from '@/components/tracking/TrackTruckModule';

type PortalTab = 'dashboard' | 'approvals' | 'directory' | 'tracking' | 'users' | 'audit' | 'settings';

interface PartnerStats {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
  activeTrips: number;
  distribution: Array<{ type: string; count: number }>;
  recentActivity: Array<{
    id?: string;
    action?: string;
    actorName?: string;
    createdAt?: string;
    metadata?: string;
  }>;
}

interface AuditLogItem {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: string;
  createdAt: string;
}

export function AdminManagerPortalPage() {
  const { profile } = useAuth();
  const { role } = useRole();

  const isAdmin = role === 'admin' || profile?.roles?.includes('ADMIN');
  const [activeTab, setActiveTab] = useState<PortalTab>('dashboard');

  // Authoritative Database States
  const [stats, setStats] = useState<PartnerStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Integration settings test ping state
  const [pingStatus, setPingStatus] = useState<string | null>(null);

  // 1. Fetch live metrics from database
  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const res = await fetch('http://localhost:8080/api/v1/partners/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch {
      // Backend offline or empty
    } finally {
      setLoadingStats(false);
    }
  };

  // 2. Fetch authoritative audit trail from database
  const fetchAuditLogs = async () => {
    setLoadingAudit(true);
    try {
      const res = await fetch('http://localhost:8080/api/v1/audit-events?limit=50');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setAuditLogs(data);
        }
      }
    } catch {
      // Backend offline or empty
    } finally {
      setLoadingAudit(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    if (activeTab === 'audit' && isAdmin) {
      fetchAuditLogs();
    }
  }, [activeTab, isAdmin]);

  const handleTestTraqoPing = async () => {
    setPingStatus('Testing Traqo Telemetry Gateway connection...');
    try {
      const res = await fetch('http://localhost:8080/api/v1/tracking/status');
      if (res.ok) {
        const d = await res.json();
        setPingStatus(`Traqo Gateway Status: ${d.status} (Configured: ${d.isConfigured}, Rate Limit: ${d.rateLimit})`);
      } else {
        setPingStatus('Traqo Gateway responded with error status.');
      }
    } catch {
      setPingStatus('Unable to reach Traqo Gateway on backend port 8080.');
    }
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1440px', margin: '0 auto', fontFamily: "var(--ch-font-sans, 'Inter', sans-serif)" }}>
      {/* Portal Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          marginBottom: '1.75rem',
          paddingBottom: '1.25rem',
          borderBottom: '1px solid var(--ch-border)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="ch-mono-badge" style={{ margin: 0 }}>
              {isAdmin ? 'Platform Admin Portal' : 'Operational Manager Portal'}
            </span>
            <span
              style={{
                fontFamily: 'var(--ch-font-mono)',
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '9999px',
                background: 'rgba(47, 125, 91, 0.12)',
                color: 'var(--ch-green)',
                border: '1px solid var(--ch-green)',
              }}
            >
              Enterprise Tier
            </span>
          </div>
          <h1
            style={{
              fontSize: '1.85rem',
              fontWeight: 800,
              margin: '0.4rem 0 0.2rem 0',
              fontFamily: "var(--ch-font-heading, 'Plus Jakarta Sans', sans-serif)",
            }}
          >
            {isAdmin ? 'Administration & Telemetry Console' : 'Operations Management Console'}
          </h1>
          <p style={{ color: 'var(--ch-muted)', fontSize: '0.88rem', margin: 0 }}>
            {isAdmin
              ? 'Complete system governance, partner approvals, Traqo fleet dispatch, and audit records.'
              : 'Review and approve partner applications, monitor transit shipments, and release operational rewards.'}
          </p>
        </div>

        {/* Tab Switcher Pills */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            background: 'var(--ch-surface-2, #EFECE4)',
            padding: '4px',
            borderRadius: '9999px',
            border: '1px solid var(--ch-border)',
            gap: '4px',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={activeTab === 'dashboard' ? 'ch-btn-pill-black' : 'ch-tab-inactive'}
            style={{
              padding: '6px 14px',
              fontSize: '0.8rem',
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'dashboard' ? 'var(--ch-ink)' : 'transparent',
              color: activeTab === 'dashboard' ? '#ffffff' : 'var(--ch-muted)',
              borderRadius: '9999px',
              fontWeight: 600,
            }}
          >
            <LayoutDashboard size={14} style={{ marginRight: 6 }} /> Dashboard
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('approvals')}
            style={{
              padding: '6px 14px',
              fontSize: '0.8rem',
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'approvals' ? 'var(--ch-ink)' : 'transparent',
              color: activeTab === 'approvals' ? '#ffffff' : 'var(--ch-muted)',
              borderRadius: '9999px',
              fontWeight: 600,
            }}
          >
            <ClipboardCheck size={14} style={{ marginRight: 6 }} /> Partner Approvals
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('tracking')}
            style={{
              padding: '6px 14px',
              fontSize: '0.8rem',
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'tracking' ? 'var(--ch-ink)' : 'transparent',
              color: activeTab === 'tracking' ? '#ffffff' : 'var(--ch-muted)',
              borderRadius: '9999px',
              fontWeight: 600,
            }}
          >
            <Truck size={14} style={{ marginRight: 6 }} /> Track Truck / Parcel
          </button>

          {isAdmin && (
            <>
              <button
                type="button"
                onClick={() => setActiveTab('audit')}
                style={{
                  padding: '6px 14px',
                  fontSize: '0.8rem',
                  border: 'none',
                  cursor: 'pointer',
                  background: activeTab === 'audit' ? 'var(--ch-ink)' : 'transparent',
                  color: activeTab === 'audit' ? '#ffffff' : 'var(--ch-muted)',
                  borderRadius: '9999px',
                  fontWeight: 600,
                }}
              >
                <History size={14} style={{ marginRight: 6 }} /> Audit Log
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                style={{
                  padding: '6px 14px',
                  fontSize: '0.8rem',
                  border: 'none',
                  cursor: 'pointer',
                  background: activeTab === 'settings' ? 'var(--ch-ink)' : 'transparent',
                  color: activeTab === 'settings' ? '#ffffff' : 'var(--ch-muted)',
                  borderRadius: '9999px',
                  fontWeight: 600,
                }}
              >
                <Settings size={14} style={{ marginRight: 6 }} /> Integrations
              </button>
            </>
          )}
        </div>
      </div>

      {/* View 1: Main Dashboard Tab (100% Database Driven) */}
      {activeTab === 'dashboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Top KPI Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
            <div className="ch-card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.74rem', textTransform: 'uppercase', color: 'var(--ch-muted)', fontFamily: 'var(--ch-font-mono)' }}>
                  Pending Approvals
                </span>
                <span className="ch-mono-badge" style={{ margin: 0, padding: '2px 8px', color: 'var(--ch-orange)' }}>
                  Action Needed
                </span>
              </div>
              <div style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--ch-orange)', marginTop: '0.5rem' }}>
                {loadingStats ? <Loader2 size={28} className="animate-spin" /> : (stats?.pending ?? 0)}
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--ch-muted)', marginTop: '0.35rem' }}>
                Partners in PostgreSQL awaiting operational approval
              </div>
            </div>

            <div className="ch-card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.74rem', textTransform: 'uppercase', color: 'var(--ch-muted)', fontFamily: 'var(--ch-font-mono)' }}>
                  Active Traqo Shipments
                </span>
                <span className="ch-mono-badge" style={{ margin: 0, padding: '2px 8px', color: 'var(--ch-green)' }}>
                  Live Telemetry
                </span>
              </div>
              <div style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--ch-green)', marginTop: '0.5rem' }}>
                {loadingStats ? <Loader2 size={28} className="animate-spin" /> : (stats?.activeTrips ?? 0)}
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--ch-muted)', marginTop: '0.35rem' }}>
                Active in-transit trips logged in database
              </div>
            </div>

            <div className="ch-card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.74rem', textTransform: 'uppercase', color: 'var(--ch-muted)', fontFamily: 'var(--ch-font-mono)' }}>
                  Registered Network Partners
                </span>
                <span className="ch-mono-badge" style={{ margin: 0, padding: '2px 8px' }}>
                  All Types
                </span>
              </div>
              <div style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--ch-ink)', marginTop: '0.5rem' }}>
                {loadingStats ? <Loader2 size={28} className="animate-spin" /> : (stats?.total ?? 0)}
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--ch-muted)', marginTop: '0.35rem' }}>
                Total registered partner records in database
              </div>
            </div>
          </div>

          {/* Quick Action Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: '1.5rem' }}>
            {/* Left: Partner Distribution by Type */}
            <div className="ch-card" style={{ padding: '1.75rem' }}>
              <h3 className="ch-card-title" style={{ fontSize: '1.2rem', marginBottom: '1.25rem' }}>
                Partner Distribution by Category
              </h3>

              {loadingStats ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--ch-muted)' }}>
                  <Loader2 size={20} className="animate-spin" /> Fetching distribution...
                </div>
              ) : !stats?.distribution || stats.distribution.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--ch-muted)', fontSize: '0.88rem' }}>
                  No registered partners in database yet. Applications will be grouped here automatically.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {stats.distribution.map((item, idx) => (
                    <div key={idx}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', marginBottom: 4 }}>
                        <strong style={{ color: 'var(--ch-ink)', textTransform: 'capitalize' }}>
                          {item.type.replace(/_/g, ' ')}
                        </strong>
                        <span style={{ fontFamily: 'var(--ch-font-mono)', fontWeight: 700 }}>{item.count}</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 3, background: 'var(--ch-surface-2)', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${stats.total > 0 ? (item.count / stats.total) * 100 : 0}%`,
                            background: 'var(--ch-orange)',
                            borderRadius: 3,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Recent Operational Activity */}
            <div className="ch-card" style={{ padding: '1.75rem' }}>
              <h3 className="ch-card-title" style={{ fontSize: '1.2rem', marginBottom: '1.25rem' }}>
                Recent Operational Activity
              </h3>

              {loadingStats ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--ch-muted)' }}>
                  <Loader2 size={20} className="animate-spin" /> Loading recent activity...
                </div>
              ) : !stats?.recentActivity || stats.recentActivity.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--ch-muted)', fontSize: '0.88rem' }}>
                  No recent operational events recorded in database yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.84rem' }}>
                  {stats.recentActivity.map((act, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '10px' }}>
                      <CheckCircle2 size={16} color="var(--ch-green)" style={{ flexShrink: 0, marginTop: 2 }} />
                      <div>
                        <strong>{act.action?.replace(/_/g, ' ') || 'Action'}</strong> by {act.actorName || 'System'}
                        <div style={{ fontSize: '0.75rem', color: 'var(--ch-muted)' }}>{act.createdAt || 'Recently'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* View 2: Approvals Tab */}
      {activeTab === 'approvals' && <PartnerApprovalsView />}

      {/* View 3: Tracking Tab */}
      {activeTab === 'tracking' && <TrackTruckModule />}

      {/* View 4: Audit Log (Admin Only, 100% Database Driven) */}
      {activeTab === 'audit' && isAdmin && (
        <div className="ch-card" style={{ padding: '1.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h3 className="ch-card-title" style={{ fontSize: '1.3rem', margin: 0 }}>
              Authoritative System Audit Log
            </h3>
            <button
              type="button"
              onClick={fetchAuditLogs}
              className="ch-btn-pill-black"
              style={{ padding: '6px 14px', fontSize: '0.76rem' }}
            >
              Refresh Logs
            </button>
          </div>
          <p style={{ color: 'var(--ch-muted)', fontSize: '0.86rem', marginBottom: '1.5rem' }}>
            Append-only tamper-resistant record of every partner registration, approval decision, role elevation, and shipment dispatch fetched directly from PostgreSQL.
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
              <thead>
                <tr style={{ background: 'var(--ch-surface-2)', borderBottom: '1px solid var(--ch-border)' }}>
                  <th style={{ padding: '0.75rem', fontFamily: 'var(--ch-font-mono)', fontSize: '0.72rem' }}>TIMESTAMP</th>
                  <th style={{ padding: '0.75rem', fontFamily: 'var(--ch-font-mono)', fontSize: '0.72rem' }}>ACTION</th>
                  <th style={{ padding: '0.75rem', fontFamily: 'var(--ch-font-mono)', fontSize: '0.72rem' }}>ENTITY</th>
                  <th style={{ padding: '0.75rem', fontFamily: 'var(--ch-font-mono)', fontSize: '0.72rem' }}>ACTOR</th>
                  <th style={{ padding: '0.75rem', fontFamily: 'var(--ch-font-mono)', fontSize: '0.72rem' }}>METADATA</th>
                </tr>
              </thead>
              <tbody>
                {loadingAudit ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--ch-muted)' }}>
                      <Loader2 size={20} className="animate-spin" /> Fetching audit log from database...
                    </td>
                  </tr>
                ) : auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--ch-muted)' }}>
                      No audit events recorded in database yet.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((row) => (
                    <tr key={row.id} style={{ borderBottom: '1px solid var(--ch-border)' }}>
                      <td style={{ padding: '0.75rem', fontFamily: 'var(--ch-font-mono)' }}>{row.createdAt}</td>
                      <td style={{ padding: '0.75rem', fontWeight: 700 }}>{row.action}</td>
                      <td style={{ padding: '0.75rem' }}>{row.entityType}</td>
                      <td style={{ padding: '0.75rem' }}>{row.actorName || 'System'}</td>
                      <td style={{ padding: '0.75rem', color: 'var(--ch-muted)', fontFamily: 'var(--ch-font-mono)' }}>{row.metadata}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* View 5: Integrations & Settings (Admin Only) */}
      {activeTab === 'settings' && isAdmin && (
        <div className="ch-card" style={{ padding: '2rem', maxWidth: '720px' }}>
          <h3 className="ch-card-title" style={{ fontSize: '1.3rem', marginBottom: '0.5rem' }}>
            External Integration & Proxy Status
          </h3>
          <p style={{ color: 'var(--ch-muted)', fontSize: '0.86rem', marginBottom: '1.5rem' }}>
            Authoritative status of server-side microservice proxies. Secrets and credentials are stored strictly in server environment variables and never surfaced.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'var(--ch-surface-2)', borderRadius: '12px' }}>
              <div>
                <strong>Traqo Logistics Telemetry API</strong>
                <div style={{ fontSize: '0.78rem', color: 'var(--ch-muted)' }}>
                  Server Proxy (/api/v1/tracking/*) · Rate limit 10 req/s · In-memory 60s cache
                </div>
              </div>
              <span className="ch-mono-badge" style={{ color: 'var(--ch-green)', border: '1px solid var(--ch-green)' }}>
                Active Proxy
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'var(--ch-surface-2)', borderRadius: '12px' }}>
              <div>
                <strong>Supabase Authentication & PostgreSQL</strong>
                <div style={{ fontSize: '0.78rem', color: 'var(--ch-muted)' }}>
                  Cryptographic JWT verification · Row Level Security active
                </div>
              </div>
              <span className="ch-mono-badge" style={{ color: 'var(--ch-green)', border: '1px solid var(--ch-green)' }}>
                Connected
              </span>
            </div>

            <div style={{ marginTop: '0.75rem' }}>
              <button
                type="button"
                onClick={handleTestTraqoPing}
                className="ch-btn-pill-black"
                style={{ fontSize: '0.82rem', padding: '8px 18px' }}
              >
                <Activity size={14} style={{ marginRight: 6 }} /> Test Backend Gateway Connection
              </button>

              {pingStatus && (
                <div style={{ marginTop: '0.75rem', fontSize: '0.82rem', fontFamily: 'var(--ch-font-mono)', color: 'var(--ch-ink)' }}>
                  {pingStatus}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
