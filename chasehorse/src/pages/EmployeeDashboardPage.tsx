import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  MapPin,
  Clock,
  Wallet,
  Play,
  RotateCcw,
  CheckCircle2,
  TrendingUp,
  ArrowRight,
  Activity,
  Radio,
} from 'lucide-react';
import { api } from '@/api';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import type { WorkerDashboardStats } from '@/types';

// Animated Count-Up hook
function useCountUp(endValue: number, durationMs: number = 800) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let startTime: number | null = null;
    let frameId: number;

    const startVal = displayValue;
    const diff = endValue - startVal;

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / durationMs, 1);
      // Ease out cubic
      const ease = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(startVal + diff * ease));

      if (progress < 1) {
        frameId = requestAnimationFrame(step);
      }
    };

    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [endValue, durationMs]);

  return displayValue;
}

export function EmployeeDashboardPage() {
  const { user, profile } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();

  const [stats, setStats] = useState<WorkerDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);

  // Live GPS state with watchPosition
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'acquiring' | 'high' | 'medium' | 'low' | 'denied'>('acquiring');

  const workerName = profile?.displayName || user?.email?.split('@')[0] || 'Field Worker';
  const accountStatus = (profile?.accountStatus || 'ACTIVE').toUpperCase();

  // Watch GPS location with high accuracy
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setGpsStatus('low');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const acc = Math.round(pos.coords.accuracy);
        setGpsAccuracy(acc);
        if (acc <= 30) setGpsStatus('high');
        else if (acc <= 100) setGpsStatus('medium');
        else setGpsStatus('low');
      },
      () => {
        setGpsStatus('denied');
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // Fetch real worker stats
  const fetchStats = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const data = await api.getWorkerStats();
      setStats(data);
      setLastUpdated(new Date());
    } catch (err: unknown) {
      console.error('[EmployeeDashboard] Failed to fetch worker stats:', err);
      if (isManual) notify('Failed to refresh stats from server', 'danger');
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // 20s auto-refresh polling
    const interval = setInterval(() => {
      fetchStats();
    }, 20000);
    return () => clearInterval(interval);
  }, []);

  const todayStr = useMemo(() => {
    return new Date().toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }, []);

  // Animated numbers
  const countOpen = useCountUp(stats?.openTasks ?? 0);
  const countInProgress = useCountUp(stats?.inProgress ?? 0);
  const countAwaiting = useCountUp(stats?.awaitingReview ?? 0);
  const countApprovedMonth = useCountUp(stats?.approvedThisMonth ?? 0);
  const countWalletAvail = useCountUp(stats?.walletAvailable ?? 0);
  const countWalletPending = useCountUp(stats?.walletPending ?? 0);

  // 14-day history chart items
  const historyEntries = useMemo(() => {
    if (!stats?.dailyCompletedHistory) return [];
    return Object.entries(stats.dailyCompletedHistory).map(([day, count]) => ({
      day: day.slice(5), // MM-DD
      count,
    }));
  }, [stats?.dailyCompletedHistory]);

  const maxHistoryCount = useMemo(() => {
    return Math.max(1, ...historyEntries.map((e) => e.count));
  }, [historyEntries]);

  if (loading && !stats) {
    return (
      <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
        <div style={{ height: '80px', borderRadius: '16px', background: 'var(--color-surface, #ffffff)', border: '1px solid var(--color-border, #e2e8f0)', opacity: 0.7 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} style={{ height: '110px', borderRadius: '16px', background: 'var(--color-surface, #ffffff)', border: '1px solid var(--color-border, #e2e8f0)', opacity: 0.7 }} />
          ))}
        </div>
        <div style={{ height: '220px', borderRadius: '16px', background: 'var(--color-surface, #ffffff)', border: '1px solid var(--color-border, #e2e8f0)', opacity: 0.7 }} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* 1. Header Greeting & Status Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          background: 'var(--color-surface, #ffffff)',
          padding: '1.25rem 1.5rem',
          borderRadius: '16px',
          border: '1px solid var(--color-border, #e2e8f0)',
          boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, color: 'var(--color-text, #0f172a)' }}>
              Namaste, {workerName} 👋
            </h1>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: '999px',
                backgroundColor: accountStatus === 'ACTIVE' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(234, 179, 8, 0.15)',
                color: accountStatus === 'ACTIVE' ? '#10b981' : '#eab308',
                border: `1px solid ${accountStatus === 'ACTIVE' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(234, 179, 8, 0.3)'}`,
              }}
            >
              ● {accountStatus} OPERATOR
            </span>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--muted)' }}>
            {todayStr} • Regional Field Dispatch & Execution Hub
          </p>
        </div>

        {/* Live Status Indicators */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* GPS Accuracy Chip */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '10px',
              background: 'rgba(15, 23, 42, 0.04)',
              border: '1px solid var(--color-border, #e2e8f0)',
              fontSize: '0.785rem',
              fontWeight: 600,
              color: 'var(--color-text, #1e293b)',
            }}
          >
            <Radio
              size={14}
              style={{
                color: gpsStatus === 'high' ? '#10b981' : gpsStatus === 'medium' ? '#f59e0b' : '#ef4444',
                animation: gpsStatus === 'high' ? 'pulse 2s infinite' : 'none',
              }}
            />
            <span>
              GPS:{' '}
              {gpsStatus === 'high'
                ? `High Accuracy (±${gpsAccuracy}m)`
                : gpsStatus === 'medium'
                ? `Moderate (±${gpsAccuracy}m)`
                : gpsStatus === 'denied'
                ? 'Permission Denied'
                : 'Acquiring...'}
            </span>
          </div>

          {/* Last Updated + Manual Refresh */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
              Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <button
              type="button"
              onClick={() => fetchStats(true)}
              disabled={refreshing}
              title="Refresh Stats"
              className="icon-btn"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                border: '1px solid var(--color-border, #e2e8f0)',
                background: 'var(--color-surface, #ffffff)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <RotateCcw size={14} className={refreshing ? 'spin' : ''} style={{ color: '#64748b' }} />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Stat Tiles (Count-Up Animation) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem',
        }}
      >
        {/* Open Nearby */}
        <Link
          to="/nearby"
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          <div
            className="stat-card"
            style={{
              background: 'var(--color-surface, #ffffff)',
              padding: '1.25rem',
              borderRadius: '16px',
              border: '1px solid var(--color-border, #e2e8f0)',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--muted)' }}>Nearby Available</span>
              <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(232, 84, 30, 0.1)', color: 'var(--accent-orange)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MapPin size={16} />
              </div>
            </div>
            <p style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: 'var(--accent-orange)', fontFamily: 'monospace' }}>
              {countOpen}
            </p>
            <span style={{ fontSize: '0.725rem', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
              View map & accept <ArrowRight size={12} />
            </span>
          </div>
        </Link>

        {/* In Progress */}
        <Link
          to="/tasks"
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          <div
            className="stat-card"
            style={{
              background: 'var(--color-surface, #ffffff)',
              padding: '1.25rem',
              borderRadius: '16px',
              border: '1px solid var(--color-border, #e2e8f0)',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--muted)' }}>In Progress</span>
              <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Activity size={16} />
              </div>
            </div>
            <p style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-text, #0f172a)', fontFamily: 'monospace' }}>
              {countInProgress}
            </p>
            <span style={{ fontSize: '0.725rem', color: 'var(--muted)', marginTop: '4px', display: 'block' }}>
              Active on-site tasks
            </span>
          </div>
        </Link>

        {/* Awaiting Review */}
        <div
          style={{
            background: 'var(--color-surface, #ffffff)',
            padding: '1.25rem',
            borderRadius: '16px',
            border: '1px solid var(--color-border, #e2e8f0)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--muted)' }}>Awaiting Review</span>
            <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(234, 179, 8, 0.1)', color: '#eab308', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={16} />
            </div>
          </div>
          <p style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-text, #0f172a)', fontFamily: 'monospace' }}>
            {countAwaiting}
          </p>
          <span style={{ fontSize: '0.725rem', color: 'var(--muted)', marginTop: '4px', display: 'block' }}>
            Manager inspection pending
          </span>
        </div>

        {/* Approved This Month */}
        <div
          style={{
            background: 'var(--color-surface, #ffffff)',
            padding: '1.25rem',
            borderRadius: '16px',
            border: '1px solid var(--color-border, #e2e8f0)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--muted)' }}>Approved This Month</span>
            <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={16} />
            </div>
          </div>
          <p style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: '#10b981', fontFamily: 'monospace' }}>
            {countApprovedMonth}
          </p>
          <span style={{ fontSize: '0.725rem', color: 'var(--muted)', marginTop: '4px', display: 'block' }}>
            Total approved: {stats?.approvedTotal ?? 0}
          </span>
        </div>

        {/* Wallet Available */}
        <Link
          to="/wallet"
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          <div
            className="stat-card"
            style={{
              background: 'var(--color-surface, #ffffff)',
              padding: '1.25rem',
              borderRadius: '16px',
              border: '1px solid var(--color-border, #e2e8f0)',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--muted)' }}>Wallet Available</span>
              <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Wallet size={16} />
              </div>
            </div>
            <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#10b981', fontFamily: 'monospace' }}>
              ₹{countWalletAvail.toLocaleString('en-IN')}
            </p>
            <span style={{ fontSize: '0.725rem', color: 'var(--muted)', marginTop: '4px', display: 'block' }}>
              Credited to ledger
            </span>
          </div>
        </Link>

        {/* Wallet Pending */}
        <div
          style={{
            background: 'var(--color-surface, #ffffff)',
            padding: '1.25rem',
            borderRadius: '16px',
            border: '1px solid var(--color-border, #e2e8f0)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--muted)' }}>Pending Rewards</span>
            <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(234, 179, 8, 0.1)', color: '#eab308', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={16} />
            </div>
          </div>
          <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#eab308', fontFamily: 'monospace' }}>
            ₹{countWalletPending.toLocaleString('en-IN')}
          </p>
          <span style={{ fontSize: '0.725rem', color: 'var(--muted)', marginTop: '4px', display: 'block' }}>
            Awaiting final approval
          </span>
        </div>
      </div>

      {/* 3. Continue Where You Left Off Card */}
      {stats?.activeTask ? (
        <div
          style={{
            background: 'var(--surface)',
            color: 'var(--ink)',
            padding: '1.5rem',
            borderRadius: '16px',
            border: '1px solid var(--line)', borderLeft: '4px solid var(--accent-orange)',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1.25rem',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.2)',
          }}
        >
          <div style={{ flex: 1, minWidth: '280px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span
                style={{
                  fontSize: '0.725rem',
                  fontWeight: 800,
                  backgroundColor: 'var(--accent-orange)',
                  color: '#ffffff',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  textTransform: 'uppercase',
                }}
              >
                In Execution
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Task #{stats.activeTask.id.slice(-6).toUpperCase()}</span>
            </div>
            <h2 style={{ margin: '0 0 6px 0', fontSize: '1.25rem', fontWeight: 700, color: 'var(--ink)' }}>
              {stats.activeTask.title}
            </h2>
            <p style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: 'var(--muted)' }}>
              📍 {stats.activeTask.address || stats.activeTask.area || 'Field Site'}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.8rem', color: 'var(--muted)' }}>
              <span>Category: <strong>{stats.activeTask.category || 'General'}</strong></span>
              <span>Reward: <strong style={{ color: '#10b981' }}>₹{stats.activeTask.rewardInr ?? 0}</strong></span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Circular Progress Ring */}
            <div style={{ position: 'relative', width: '64px', height: '64px' }}>
              <svg width="64" height="64" viewBox="0 0 64 64" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="32" cy="32" r="26" stroke="rgba(255,255,255,0.1)" strokeWidth="6" fill="transparent" />
                <circle
                  cx="32"
                  cy="32"
                  r="26"
                  stroke="var(--accent-orange)"
                  strokeWidth="6"
                  fill="transparent"
                  strokeDasharray="163.36"
                  strokeDashoffset="60"
                  strokeLinecap="round"
                />
              </svg>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  color: 'var(--ink)',
                }}
              >
                60%
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate(`/tasks`)}
              className="btn btn--primary"
              style={{
                backgroundColor: 'var(--accent-orange)',
                color: '#ffffff',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '12px',
                fontWeight: 700,
                fontSize: '0.9rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(232, 84, 30, 0.4)',
              }}
            >
              <Play size={16} fill="currentColor" /> Resume Task
            </button>
          </div>
        </div>
      ) : null}

      {/* 4. Animated Charts & Rates Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>
        {/* 14-Day Activity Chart */}
        <div
          style={{
            background: 'var(--color-surface, #ffffff)',
            padding: '1.5rem',
            borderRadius: '16px',
            border: '1px solid var(--color-border, #e2e8f0)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-text, #0f172a)' }}>
                14-Day Task Completion
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.775rem', color: 'var(--muted)' }}>
                Daily approved audits & completed field tasks
              </p>
            </div>
            <TrendingUp size={18} color="var(--accent-orange)" />
          </div>

          {historyEntries.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '140px', paddingTop: '20px' }}>
              {historyEntries.map((item, idx) => {
                const heightPct = Math.max(12, Math.round((item.count / maxHistoryCount) * 100));
                return (
                  <div
                    key={idx}
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '6px',
                      height: '100%',
                      justifyContent: 'flex-end',
                    }}
                  >
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: item.count > 0 ? 'var(--accent-orange)' : 'var(--muted)' }}>
                      {item.count}
                    </span>
                    <div
                      style={{
                        width: '100%',
                        maxWidth: '24px',
                        height: `${heightPct}%`,
                        backgroundColor: item.count > 0 ? 'var(--accent-orange)' : 'rgba(15, 23, 42, 0.08)',
                        borderRadius: '4px',
                        transition: 'height 0.4s ease',
                      }}
                      title={`${item.day}: ${item.count} completed`}
                    />
                    <span style={{ fontSize: '0.65rem', color: 'var(--muted)', transform: 'rotate(-45deg)', transformOrigin: 'top left', marginTop: '4px' }}>
                      {item.day}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: '0.85rem' }}>
              No tasks completed in the last 14 days yet. Accept nearby tasks to begin!
            </div>
          )}
        </div>

        {/* Quality & Efficiency Metrics */}
        <div
          style={{
            background: 'var(--color-surface, #ffffff)',
            padding: '1.5rem',
            borderRadius: '16px',
            border: '1px solid var(--color-border, #e2e8f0)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-text, #0f172a)' }}>
              Execution Quality & SLA
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.775rem', color: 'var(--muted)' }}>
              Automated manager approval & zero-rework scores
            </p>
          </div>

          {/* Approval Rate */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.85rem' }}>
              <span style={{ fontWeight: 600, color: 'var(--color-text, #1e293b)' }}>Manager Approval Rate</span>
              <strong style={{ color: '#10b981' }}>{stats?.approvalRate ?? 100}%</strong>
            </div>
            <div style={{ width: '100%', height: '8px', borderRadius: '4px', backgroundColor: 'rgba(15, 23, 42, 0.08)', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${stats?.approvalRate ?? 100}%`,
                  height: '100%',
                  backgroundColor: '#10b981',
                  borderRadius: '4px',
                  transition: 'width 0.6s ease',
                }}
              />
            </div>
          </div>

          {/* Rework Rate */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.85rem' }}>
              <span style={{ fontWeight: 600, color: 'var(--color-text, #1e293b)' }}>Rework Request Rate</span>
              <strong style={{ color: (stats?.reworkRate ?? 0) > 10 ? '#ef4444' : '#64748b' }}>{stats?.reworkRate ?? 0}%</strong>
            </div>
            <div style={{ width: '100%', height: '8px', borderRadius: '4px', backgroundColor: 'rgba(15, 23, 42, 0.08)', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.min(100, (stats?.reworkRate ?? 0) * 5)}%`,
                  height: '100%',
                  backgroundColor: (stats?.reworkRate ?? 0) > 10 ? '#ef4444' : 'var(--accent-orange)',
                  borderRadius: '4px',
                  transition: 'width 0.6s ease',
                }}
              />
            </div>
          </div>

          {/* Operator Badges preview */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: 'auto', paddingTop: '10px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)' }}>Badges:</span>
            <span style={{ fontSize: '0.725rem', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', background: 'rgba(232, 84, 30, 0.1)', color: 'var(--accent-orange)' }}>
              Verified Field Auditor
            </span>
            <span style={{ fontSize: '0.725rem', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
              Zero Rework
            </span>
            <Link to="/employee/profile" style={{ fontSize: '0.75rem', color: 'var(--accent-orange)', marginLeft: 'auto', textDecoration: 'none', fontWeight: 600 }}>
              View Profile →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
