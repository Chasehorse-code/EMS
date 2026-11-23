import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Wallet as WalletIcon,
  Clock,
  TrendingUp,
  Download,
  ArrowDownLeft,
  ArrowUpRight,
  Info,
} from 'lucide-react';
import { api } from '@/api';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { formatDateTime, formatSignedInr } from '@/utils/format';
import type { Task, WalletTransaction } from '@/types';

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

export function WalletPage() {
  const { user, profile } = useAuth();
  const { notify } = useToast();

  const workerId = profile?.id || user?.id || '';

  const [loading, setLoading] = useState(true);
  const [availableBalance, setAvailableBalance] = useState(0);
  const [pendingBalance, setPendingBalance] = useState(0);
  const [lifetimeEarned, setLifetimeEarned] = useState(0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [pendingTasks, setPendingTasks] = useState<Task[]>([]);

  // Filtering & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const loadWalletData = async () => {
    setLoading(true);
    try {
      const [workerStats, allTasks, txns] = await Promise.all([
        api.getWorkerStats().catch(() => null),
        api.listTasks().catch(() => [] as Task[]),
        api.listTransactions(workerId).catch(() => [] as WalletTransaction[]),
      ]);

      if (workerStats) {
        setAvailableBalance(workerStats.walletAvailable ?? 0);
        setPendingBalance(workerStats.walletPending ?? 0);
      }

      setTransactions(txns);

      // Lifetime earned calculation from positive credit transactions
      const lifetime = txns
        .filter((t) => t.status === 'completed' && t.amountInr > 0)
        .reduce((sum, t) => sum + t.amountInr, 0);
      setLifetimeEarned(lifetime);

      // Pending tasks awaiting manager or ops approval
      const pending = allTasks.filter(
        (t) => (t.assigneeId === workerId || !t.assigneeId) && (t.status === 'submitted' || t.status === 'in_review')
      );
      setPendingTasks(pending);
    } catch (err: unknown) {
      console.error('[WalletPage] Load error:', err);
      notify('Failed to load wallet ledger', 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWalletData();
  }, [workerId]);

  // Animated numbers
  const countAvailable = useCountUp(availableBalance);
  const countPending = useCountUp(pendingBalance);
  const countLifetime = useCountUp(lifetimeEarned);

  // Filtered transactions
  const filteredTxns = useMemo(() => {
    return transactions.filter((t) => {
      if (typeFilter !== 'all' && t.type !== typeFilter) return false;
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchRef = t.reference.toLowerCase().includes(q);
        const matchTask = t.taskId?.toLowerCase().includes(q);
        if (!matchRef && !matchTask) return false;
      }
      return true;
    });
  }, [transactions, typeFilter, statusFilter, searchQuery]);

  // Paged transactions
  const pagedTxns = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredTxns.slice(start, start + pageSize);
  }, [filteredTxns, page]);

  const totalPages = Math.ceil(filteredTxns.length / pageSize) || 1;

  // CSV Export
  const exportCsv = () => {
    if (filteredTxns.length === 0) {
      notify('No transactions to export', 'info');
      return;
    }

    const headers = ['Date', 'Type', 'Reference', 'Task Number', 'Amount (INR)', 'Status'];
    const rows = filteredTxns.map((t) => [
      t.createdAt,
      t.type,
      `"${t.reference}"`,
      t.taskId || 'N/A',
      t.amountInr,
      t.status,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `chasehorse_wallet_ledger_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify('Ledger transactions exported to CSV', 'success');
  };

  if (loading && transactions.length === 0) {
    return (
      <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ height: '80px', borderRadius: '16px', background: 'var(--color-surface, #ffffff)', border: '1px solid var(--color-border, #e2e8f0)', opacity: 0.7 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ height: '110px', borderRadius: '16px', background: 'var(--color-surface, #ffffff)', border: '1px solid var(--color-border, #e2e8f0)', opacity: 0.7 }} />
          ))}
        </div>
        <div style={{ height: '300px', borderRadius: '16px', background: 'var(--color-surface, #ffffff)', border: '1px solid var(--color-border, #e2e8f0)', opacity: 0.7 }} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* 1. Header */}
      <div
        style={{
          background: 'var(--color-surface, #ffffff)',
          borderRadius: '16px',
          border: '1px solid var(--color-border, #e2e8f0)',
          padding: '1.25rem 1.5rem',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: 'var(--color-text, #0f172a)' }}>
            Rewards Wallet & Internal Ledger
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--muted)' }}>
            Append-only, immutable reward credits from completed and human-verified field tasks.
          </p>
        </div>

        {/* Withdrawal notice badge */}
        <div
          style={{
            padding: '6px 12px',
            borderRadius: '10px',
            background: 'rgba(15, 23, 42, 0.04)',
            border: '1px solid var(--color-border, #e2e8f0)',
            fontSize: '0.785rem',
            color: 'var(--muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <Info size={14} color="#64748b" />
          <span>Withdrawals are not enabled yet</span>
        </div>
      </div>

      {/* 2. Balance Tiles (Animated Count-Up) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
        {/* Available Balance */}
        <div
          style={{
            background: 'var(--color-surface, #ffffff)',
            borderRadius: '16px',
            border: '1px solid var(--color-border, #e2e8f0)',
            padding: '1.5rem',
            boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--muted)' }}>Available Balance</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <WalletIcon size={18} />
            </div>
          </div>
          <p style={{ margin: 0, fontSize: '2rem', fontWeight: 800, color: '#10b981', fontFamily: 'monospace' }}>
            ₹{countAvailable.toLocaleString('en-IN')}
          </p>
          <span style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '6px', display: 'block' }}>
            Fully approved by Operations & credited
          </span>
        </div>

        {/* Pending Approval */}
        <div
          style={{
            background: 'var(--color-surface, #ffffff)',
            borderRadius: '16px',
            border: '1px solid var(--color-border, #e2e8f0)',
            padding: '1.5rem',
            boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--muted)' }}>Pending Approvals</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(234, 179, 8, 0.1)', color: '#eab308', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={18} />
            </div>
          </div>
          <p style={{ margin: 0, fontSize: '2rem', fontWeight: 800, color: '#eab308', fontFamily: 'monospace' }}>
            ₹{countPending.toLocaleString('en-IN')}
          </p>
          <span style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '6px', display: 'block' }}>
            {pendingTasks.length} submitted task(s) awaiting sign-off
          </span>
        </div>

        {/* Lifetime Earned */}
        <div
          style={{
            background: 'var(--color-surface, #ffffff)',
            borderRadius: '16px',
            border: '1px solid var(--color-border, #e2e8f0)',
            padding: '1.5rem',
            boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--muted)' }}>Lifetime Earned</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={18} />
            </div>
          </div>
          <p style={{ margin: 0, fontSize: '2rem', fontWeight: 800, color: 'var(--color-text, #0f172a)', fontFamily: 'monospace' }}>
            ₹{countLifetime.toLocaleString('en-IN')}
          </p>
          <span style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '6px', display: 'block' }}>
            Cumulative field task rewards
          </span>
        </div>
      </div>

      {/* 3. Pending Tasks Awaiting Approval Breakdown */}
      {pendingTasks.length > 0 && (
        <div
          style={{
            background: 'var(--color-surface, #ffffff)',
            borderRadius: '16px',
            border: '1px solid var(--color-border, #e2e8f0)',
            padding: '1.5rem',
          }}
        >
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 700, color: 'var(--color-text, #0f172a)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={16} color="#eab308" /> Staged Rewards Awaiting Approval ({pendingTasks.length})
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {pendingTasks.map((t) => {
              const isManagerStage = t.status === 'submitted';
              const nextStage = isManagerStage ? 'Waiting for Manager Approval' : 'Waiting for Operations / Admin Approval';

              return (
                <div
                  key={t.id}
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    background: 'rgba(15, 23, 42, 0.02)',
                    border: '1px solid var(--color-border, #e2e8f0)',
                    gap: '12px',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                      <Link
                        to={`/tasks`}
                        style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--accent-orange)', textDecoration: 'none' }}
                      >
                        Task CH-{t.id.slice(-6).toUpperCase()}
                      </Link>
                      <span style={{ fontSize: '0.85rem', color: 'var(--color-text, #0f172a)', fontWeight: 600 }}>
                        {t.title}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--muted)' }}>
                      Submitted: {formatDateTime((t as any).updatedAt || t.createdAt || t.dueAt)}
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '4px 10px',
                        borderRadius: '6px',
                        background: isManagerStage ? 'rgba(234, 179, 8, 0.12)' : 'rgba(59, 130, 246, 0.12)',
                        color: isManagerStage ? '#eab308' : '#3b82f6',
                        border: `1px solid ${isManagerStage ? 'rgba(234, 179, 8, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`,
                      }}
                    >
                      ⏳ {nextStage}
                    </span>
                    <strong style={{ fontSize: '1rem', color: '#eab308', fontFamily: 'monospace' }}>
                      +₹{t.rewardInr ?? 0}
                    </strong>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Full Ledger History Table */}
      <div
        style={{
          background: 'var(--color-surface, #ffffff)',
          borderRadius: '16px',
          border: '1px solid var(--color-border, #e2e8f0)',
          padding: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.25rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text, #0f172a)' }}>
              Immutable Transaction Ledger
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.775rem', color: 'var(--muted)' }}>
              Full audit trail of all credited rewards and adjustments
            </p>
          </div>

          <button
            type="button"
            onClick={exportCsv}
            className="btn btn--secondary"
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '0.8rem',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
            }}
          >
            <Download size={14} /> Export CSV
          </button>
        </div>

        {/* Toolbar: Filters & Search */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '1rem' }}>
          <div style={{ flex: '1', minWidth: '200px' }}>
            <input
              type="text"
              placeholder="Search by reference or task number..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="input"
              style={{ width: '100%', boxSizing: 'border-box', height: '36px', fontSize: '0.825rem' }}
            />
          </div>

          <div>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="input"
              style={{ height: '36px', fontSize: '0.825rem' }}
            >
              <option value="all">All Types</option>
              <option value="credit">Reward Credit</option>
              <option value="debit">Debit / Adjustment</option>
              <option value="hold">Hold</option>
            </select>
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="input"
              style={{ height: '36px', fontSize: '0.825rem' }}
            >
              <option value="all">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>

        {/* Transactions Table */}
        {pagedTxns.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border, #e2e8f0)', textAlign: 'left', color: 'var(--muted)' }}>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Date</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Type</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Reference / Task</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600, textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {pagedTxns.map((t) => (
                  <tr
                    key={t.id}
                    style={{
                      borderBottom: '1px solid var(--color-border, #f1f5f9)',
                      transition: 'background-color 0.15s ease',
                    }}
                  >
                    <td style={{ padding: '12px' }}>{formatDateTime(t.createdAt)}</td>
                    <td style={{ padding: '12px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontWeight: 600,
                          fontSize: '0.785rem',
                          color: t.amountInr >= 0 ? '#10b981' : '#ef4444',
                        }}
                      >
                        {t.amountInr >= 0 ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
                        {t.type.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--color-text, #0f172a)' }}>
                        {t.reference}
                      </span>
                      {t.taskId && (
                        <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--accent-orange)', marginTop: '2px' }}>
                          CH-{t.taskId.slice(-6).toUpperCase()}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span
                        style={{
                          fontSize: '0.725rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          backgroundColor:
                            t.status === 'completed'
                              ? 'rgba(16, 185, 129, 0.1)'
                              : t.status === 'pending'
                              ? 'rgba(234, 179, 8, 0.1)'
                              : 'rgba(239, 68, 68, 0.1)',
                          color:
                            t.status === 'completed'
                              ? '#10b981'
                              : t.status === 'pending'
                              ? '#eab308'
                              : '#ef4444',
                        }}
                      >
                        {t.status.toUpperCase()}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: '12px',
                        textAlign: 'right',
                        fontWeight: 800,
                        fontFamily: 'monospace',
                        color: t.amountInr >= 0 ? '#10b981' : '#ef4444',
                      }}
                    >
                      {formatSignedInr(t.amountInr)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingTop: '10px', borderTop: '1px solid var(--color-border, #e2e8f0)' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                  Page {page} of {totalPages} ({filteredTxns.length} records)
                </span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="btn btn--secondary"
                    style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="btn btn--secondary"
                    style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.85rem' }}>
            No transactions match the selected filter criteria.
          </div>
        )}
      </div>
    </div>
  );
}
