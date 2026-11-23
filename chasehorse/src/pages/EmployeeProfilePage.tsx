import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Award,
  Lock,
  LogOut,
  Save,
  Eye,
  EyeOff,
} from 'lucide-react';
import { api } from '@/api';
import { supabase } from '@/config/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { formatDateTime } from '@/utils/format';
import type { WorkerProfileView, WorkerPortfolioView } from '@/types';

export function EmployeeProfilePage() {
  const { user, signOut } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'portfolio' | 'account' | 'support'>('portfolio');
  const [profile, setProfile] = useState<WorkerProfileView | null>(null);
  const [portfolio, setPortfolio] = useState<WorkerPortfolioView | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Support ticket states
  const [tickets, setTickets] = useState<any[]>([]);
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');
  const [submittingTicket, setSubmittingTicket] = useState(false);

  const loadTickets = async () => {
    try {
      const list = await api.listTickets();
      setTickets(list || []);
    } catch {
      setTickets([]);
    }
  };

  useEffect(() => {
    if (activeTab === 'support') {
      loadTickets();
    }
  }, [activeTab]);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketSubject.trim() || !ticketMessage.trim()) {
      notify('Please enter subject and message', 'danger');
      return;
    }
    setSubmittingTicket(true);
    try {
      await api.createTicket({
        subject: ticketSubject.trim(),
        message: ticketMessage.trim(),
        category: 'OPERATIONS',
        urgency: 'NORMAL',
      });
      notify('Support ticket filed successfully', 'success');
      setTicketSubject('');
      setTicketMessage('');
      await loadTickets();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Failed to file ticket', 'danger');
    } finally {
      setSubmittingTicket(false);
    }
  };

  // Form states
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [region, setRegion] = useState('');
  const [skillsStr, setSkillsStr] = useState('');
  const [locationConsent, setLocationConsent] = useState(false);

  // Password change states
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Load worker profile and portfolio
  const loadData = async () => {
    setLoading(true);
    try {
      const p = await api.getWorkerProfile();
      setProfile(p);
      setDisplayName(p.displayName || '');
      setPhone(p.phone || '');
      setRegion(p.region || '');
      setSkillsStr(p.skills ? p.skills.join(', ') : '');
      setLocationConsent(p.locationConsent);

      if (p.id) {
        const port = await api.getWorkerPortfolio(p.id);
        setPortfolio(port);
      }
    } catch (err: unknown) {
      console.error('[EmployeeProfile] Load error:', err);
      notify('Failed to load profile details', 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Update profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const skillsArray = skillsStr
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const updated = await api.updateWorkerProfile({
        displayName,
        phone,
        region,
        skills: skillsArray,
        locationConsent,
      });

      setProfile(updated);
      notify('Profile and preferences updated successfully', 'success');
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Update failed', 'danger');
    } finally {
      setSaving(false);
    }
  };

  // Toggle GPS Consent
  const handleConsentToggle = async (checked: boolean) => {
    setLocationConsent(checked);
    try {
      if (!checked) {
        await api.clearWorkerLocation();
        notify('GPS location cleared and tracking consent withdrawn', 'info');
      } else {
        await api.updateWorkerProfile({ locationConsent: true });
        notify('Location tracking consent enabled', 'success');
      }
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Failed to update consent', 'danger');
    }
  };

  // Password strength calculation
  const passwordStrength = (pwd: string) => {
    if (!pwd) return 0;
    let score = 0;
    if (pwd.length >= 8) score += 25;
    if (/[A-Z]/.test(pwd)) score += 25;
    if (/[0-9]/.test(pwd)) score += 25;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 25;
    return score;
  };

  const strength = passwordStrength(newPassword);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      notify('Password must be at least 8 characters long', 'danger');
      return;
    }
    if (newPassword !== confirmPassword) {
      notify('Passwords do not match', 'danger');
      return;
    }

    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      setNewPassword('');
      setConfirmPassword('');
      notify('Password updated successfully via Supabase Auth', 'success');
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Password update failed', 'danger');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const empCode = profile?.employeeCode || `EMP-${(user?.id || 'CH').slice(0, 6).toUpperCase()}`;

  if (loading && !profile) {
    return (
      <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ height: '180px', borderRadius: '16px', background: 'var(--color-surface, #ffffff)', border: '1px solid var(--color-border, #e2e8f0)', opacity: 0.7 }} />
        <div style={{ height: '400px', borderRadius: '16px', background: 'var(--color-surface, #ffffff)', border: '1px solid var(--color-border, #e2e8f0)', opacity: 0.7 }} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* 1. Header Card */}
      <div
        style={{
          background: 'var(--color-surface, #ffffff)',
          borderRadius: '16px',
          border: '1px solid var(--color-border, #e2e8f0)',
          padding: '1.75rem',
          boxShadow: '0 4px 15px rgba(0,0,0,0.03)',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem' }}>
          {/* Avatar & Worker Info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', minWidth: '300px' }}>
            <div
              style={{
                width: '76px',
                height: '76px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                color: '#ffffff',
                fontSize: '1.75rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
                border: '3px solid var(--accent-orange)',
              }}
            >
              {(profile?.displayName || user?.email || 'CH').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text, #0f172a)' }}>
                  {profile?.displayName || 'Field Operator'}
                </h1>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(16, 185, 129, 0.12)',
                    color: '#10b981',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                  }}
                >
                  ✓ {profile?.accountStatus || 'ACTIVE'}
                </span>
              </div>
              <p style={{ margin: '0 0 6px 0', fontSize: '0.85rem', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span>Code: <strong style={{ color: 'var(--color-text, #1e293b)', fontFamily: 'monospace' }}>{empCode}</strong></span>
                <span>•</span>
                <span>Region: <strong>{profile?.region || 'Hub 01'}</strong></span>
              </p>
              {profile?.skills && profile.skills.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {profile.skills.map((s, idx) => (
                    <span
                      key={idx}
                      style={{
                        fontSize: '0.725rem',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background: 'rgba(232, 84, 30, 0.08)',
                        color: 'var(--accent-orange)',
                      }}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Assigned Manager Card */}
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.03)',
              border: '1px solid var(--color-border, #e2e8f0)',
              borderRadius: '12px',
              padding: '1rem 1.25rem',
              minWidth: '260px',
            }}
          >
            <span style={{ fontSize: '0.725rem', textTransform: 'uppercase', fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>
              Assigned Area Manager
            </span>
            {profile?.manager ? (
              <div>
                <strong style={{ fontSize: '0.95rem', color: 'var(--color-text, #0f172a)', display: 'block' }}>
                  {profile.manager.displayName}
                </strong>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--muted)' }}>
                  {profile.manager.email} • {profile.manager.region || 'Dispatch Ops'}
                </p>
                {profile.manager.phone && (
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--accent-orange)', fontWeight: 600 }}>
                    📞 {profile.manager.phone}
                  </p>
                )}
              </div>
            ) : (
              <div>
                <strong style={{ fontSize: '0.9rem', color: 'var(--color-text, #0f172a)', display: 'block' }}>
                  Regional Operations Desk
                </strong>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.775rem', color: 'var(--muted)' }}>
                  Tenali Central Dispatch Cluster
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--color-border, #e2e8f0)', marginTop: '1.5rem', paddingTop: '1rem' }}>
          <button
            type="button"
            onClick={() => setActiveTab('portfolio')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'portfolio' ? 'var(--accent-orange)' : 'transparent',
              color: activeTab === 'portfolio' ? '#ffffff' : 'var(--muted)',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            Portfolio & Customer Ratings
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('account')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'account' ? 'var(--accent-orange)' : 'transparent',
              color: activeTab === 'account' ? '#ffffff' : 'var(--muted)',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            Account Settings & Security
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('support')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'support' ? 'var(--accent-orange)' : 'transparent',
              color: activeTab === 'support' ? '#ffffff' : 'var(--muted)',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            Helpdesk & Field Support
          </button>
        </div>
      </div>

      {/* 2. TAB CONTENT */}
      {activeTab === 'portfolio' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Key Metrics Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            <div style={{ background: 'var(--color-surface, #ffffff)', padding: '1.25rem', borderRadius: '14px', border: '1px solid var(--color-border, #e2e8f0)' }}>
              <span style={{ fontSize: '0.785rem', color: 'var(--muted)', fontWeight: 600 }}>Tasks Completed</span>
              <p style={{ margin: '4px 0 0 0', fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text, #0f172a)' }}>
                {portfolio?.tasksCompleted ?? 0}
              </p>
            </div>
            <div style={{ background: 'var(--color-surface, #ffffff)', padding: '1.25rem', borderRadius: '14px', border: '1px solid var(--color-border, #e2e8f0)' }}>
              <span style={{ fontSize: '0.785rem', color: 'var(--muted)', fontWeight: 600 }}>Approval Rate</span>
              <p style={{ margin: '4px 0 0 0', fontSize: '1.5rem', fontWeight: 800, color: '#10b981' }}>
                {portfolio?.approvalRate ?? 100}%
              </p>
            </div>
            <div style={{ background: 'var(--color-surface, #ffffff)', padding: '1.25rem', borderRadius: '14px', border: '1px solid var(--color-border, #e2e8f0)' }}>
              <span style={{ fontSize: '0.785rem', color: 'var(--muted)', fontWeight: 600 }}>First-Time Pass</span>
              <p style={{ margin: '4px 0 0 0', fontSize: '1.5rem', fontWeight: 800, color: '#3b82f6' }}>
                {portfolio?.firstTimePassRate ?? 95}%
              </p>
            </div>
            <div style={{ background: 'var(--color-surface, #ffffff)', padding: '1.25rem', borderRadius: '14px', border: '1px solid var(--color-border, #e2e8f0)' }}>
              <span style={{ fontSize: '0.785rem', color: 'var(--muted)', fontWeight: 600 }}>Average Rating</span>
              <p style={{ margin: '4px 0 0 0', fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-orange)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                ★ {portfolio?.averageRating ?? 5.0} <span style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 500 }}>({portfolio?.totalRatingsCount ?? 0})</span>
              </p>
            </div>
            <div style={{ background: 'var(--color-surface, #ffffff)', padding: '1.25rem', borderRadius: '14px', border: '1px solid var(--color-border, #e2e8f0)' }}>
              <span style={{ fontSize: '0.785rem', color: 'var(--muted)', fontWeight: 600 }}>Total Rewards Earned</span>
              <p style={{ margin: '4px 0 0 0', fontSize: '1.5rem', fontWeight: 800, color: '#10b981' }}>
                ₹{(portfolio?.totalEarnedInr ?? 0).toLocaleString('en-IN')}
              </p>
            </div>
          </div>

          {/* Badges Earned */}
          {portfolio?.badges && portfolio.badges.length > 0 && (
            <div style={{ background: 'var(--color-surface, #ffffff)', padding: '1.25rem', borderRadius: '14px', border: '1px solid var(--color-border, #e2e8f0)' }}>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text, #0f172a)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Award size={18} color="var(--accent-orange)" /> Verified Platform Achievements & Badges
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {portfolio.badges.map((b, i) => (
                  <span
                    key={i}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      background: 'rgba(232, 84, 30, 0.08)',
                      color: 'var(--accent-orange)',
                      fontSize: '0.825rem',
                      fontWeight: 700,
                      border: '1px solid rgba(232, 84, 30, 0.2)',
                    }}
                  >
                    🏆 {b}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Customer Feedback List */}
          <div style={{ background: 'var(--color-surface, #ffffff)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--color-border, #e2e8f0)' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 700, color: 'var(--color-text, #0f172a)' }}>
              Customer Written Feedback & Scores
            </h3>

            {portfolio?.feedbackList && portfolio.feedbackList.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {portfolio.feedbackList.map((fb) => (
                  <div
                    key={fb.id}
                    style={{
                      padding: '1rem',
                      borderRadius: '12px',
                      background: 'rgba(15, 23, 42, 0.02)',
                      border: '1px solid var(--color-border, #e2e8f0)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text, #0f172a)' }}>
                          {fb.taskTitle}
                        </h4>
                        <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'var(--muted)' }}>
                          Client: {fb.customerName} • {formatDateTime(fb.createdAt)}
                        </p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-orange)', fontWeight: 800 }}>
                        ★ {fb.overallRating}.0 / 5.0
                      </div>
                    </div>

                    {/* Breakdown sub-scores */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '8px' }}>
                      <span>Quality: <strong>{fb.qualityRating}/5</strong></span>
                      <span>Punctuality: <strong>{fb.punctualityRating}/5</strong></span>
                      <span>Communication: <strong>{fb.communicationRating}/5</strong></span>
                      <span>Evidence Clarity: <strong>{fb.evidenceClarityRating}/5</strong></span>
                    </div>

                    {fb.comment && (
                      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text, #1e293b)', fontStyle: 'italic', background: '#ffffff', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.05)' }}>
                        "{fb.comment}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.85rem' }}>
                No customer ratings recorded yet. Completed tasks will receive feedback here once approved.
              </div>
            )}
          </div>

          {/* Approved Evidence Thumbnails */}
          {portfolio?.approvedEvidenceThumbnails && portfolio.approvedEvidenceThumbnails.length > 0 && (
            <div style={{ background: 'var(--color-surface, #ffffff)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--color-border, #e2e8f0)' }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 700, color: 'var(--color-text, #0f172a)' }}>
                Approved Evidence Gallery
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
                {portfolio.approvedEvidenceThumbnails.map((thumb) => (
                  <div
                    key={thumb.id}
                    style={{
                      borderRadius: '8px',
                      overflow: 'hidden',
                      border: '1px solid var(--color-border, #e2e8f0)',
                      background: '#0f172a',
                    }}
                  >
                    <img
                      src={thumb.storagePath}
                      alt={thumb.caption || 'Approved proof'}
                      style={{ width: '100%', height: '110px', objectFit: 'cover' }}
                    />
                    <div style={{ padding: '6px 8px', fontSize: '0.7rem', color: 'var(--muted)' }}>
                      <p style={{ margin: 0, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {thumb.taskTitle}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : activeTab === 'account' ? (
        /* ACCOUNT SETTINGS & SECURITY TAB */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
          {/* 1. Profile Details Form */}
          <div
            style={{
              background: 'var(--color-surface, #ffffff)',
              borderRadius: '16px',
              border: '1px solid var(--color-border, #e2e8f0)',
              padding: '1.5rem',
            }}
          >
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text, #0f172a)' }}>
              Edit Profile Details
            </h3>

            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px', color: 'var(--muted)' }}>
                  Full Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="input"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px', color: 'var(--muted)' }}>
                  Contact Phone
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="input"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px', color: 'var(--muted)' }}>
                  Field Region / Area
                </label>
                <input
                  type="text"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="input"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px', color: 'var(--muted)' }}>
                  Skills (comma-separated)
                </label>
                <input
                  type="text"
                  value={skillsStr}
                  onChange={(e) => setSkillsStr(e.target.value)}
                  placeholder="e.g. Retail Audit, Solar QC, Delivery"
                  className="input"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              {/* GPS Consent Toggle */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px',
                  borderRadius: '10px',
                  background: 'rgba(15, 23, 42, 0.03)',
                  border: '1px solid var(--color-border, #e2e8f0)',
                  marginTop: '8px',
                }}
              >
                <div>
                  <strong style={{ fontSize: '0.85rem', color: 'var(--color-text, #0f172a)', display: 'block' }}>
                    Live GPS Location Consent
                  </strong>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'var(--muted)' }}>
                    Allow nearest task matching. Withdrawing deletes stored GPS.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={locationConsent}
                  onChange={(e) => handleConsentToggle(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--accent-orange)' }}
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="btn btn--primary"
                style={{
                  marginTop: '8px',
                  backgroundColor: 'var(--accent-orange)',
                  color: '#ffffff',
                  border: 'none',
                  padding: '10px 18px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                <Save size={16} /> {saving ? 'Saving...' : 'Save Profile Changes'}
              </button>
            </form>
          </div>

          {/* 2. Change Password Form via Supabase Auth */}
          <div
            style={{
              background: 'var(--color-surface, #ffffff)',
              borderRadius: '16px',
              border: '1px solid var(--color-border, #e2e8f0)',
              padding: '1.5rem',
            }}
          >
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text, #0f172a)' }}>
              Change Password
            </h3>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.8rem', color: 'var(--muted)' }}>
              Update your Supabase authentication credentials.
            </p>

            <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px', color: 'var(--muted)' }}>
                  New Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 8 characters, 1 uppercase, 1 number"
                    className="input"
                    style={{ width: '100%', boxSizing: 'border-box', paddingRight: '40px' }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {/* Password strength bar */}
                {newPassword && (
                  <div style={{ marginTop: '6px' }}>
                    <div style={{ height: '4px', width: '100%', backgroundColor: 'rgba(15, 23, 42, 0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${strength}%`,
                          backgroundColor: strength <= 50 ? '#ef4444' : strength <= 75 ? '#eab308' : '#10b981',
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                    <span style={{ fontSize: '0.7rem', color: strength <= 50 ? '#ef4444' : strength <= 75 ? '#eab308' : '#10b981', fontWeight: 600 }}>
                      {strength <= 50 ? 'Weak' : strength <= 75 ? 'Moderate' : 'Strong Password'}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px', color: 'var(--muted)' }}>
                  Confirm New Password
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="input"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={changingPassword || !newPassword}
                className="btn btn--primary"
                style={{
                  marginTop: '8px',
                  backgroundColor: '#0f172a',
                  color: '#ffffff',
                  border: 'none',
                  padding: '10px 18px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                <Lock size={16} /> {changingPassword ? 'Updating...' : 'Update Password'}
              </button>
            </form>

            <div style={{ borderTop: '1px solid var(--color-border, #e2e8f0)', marginTop: '1.5rem', paddingTop: '1.25rem' }}>
              <button
                type="button"
                onClick={handleSignOut}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  color: '#ef4444',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                }}
              >
                <LogOut size={16} /> Sign Out of All Sessions
              </button>
            </div>
          </div>
        </div>
      ) : activeTab === 'support' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {/* Create Ticket Card */}
          <div
            style={{
              background: 'var(--color-surface, #ffffff)',
              borderRadius: '16px',
              border: '1px solid var(--color-border, #e2e8f0)',
              padding: '1.5rem',
              boxShadow: '0 4px 15px rgba(0,0,0,0.03)',
            }}
          >
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 6px 0', color: 'var(--color-text, #0f172a)' }}>
              Open Operations Ticket
            </h2>
            <p style={{ fontSize: '0.825rem', color: 'var(--muted)', margin: '0 0 1.25rem 0' }}>
              Report field disputes, payout inquiries, or task issues directly to your Regional Lead.
            </p>
            <form onSubmit={handleCreateTicket} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.785rem', fontWeight: 700, color: 'var(--muted)', marginBottom: '6px' }}>
                  Issue Subject *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bounty settlement delay for task #..."
                  value={ticketSubject}
                  onChange={(e) => setTicketSubject(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-strong)',
                    fontSize: '0.9rem',
                    color: 'var(--ink)',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.785rem', fontWeight: 700, color: 'var(--muted)', marginBottom: '6px' }}>
                  Detailed Description *
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Provide complete details including task IDs, timestamps, and locations..."
                  value={ticketMessage}
                  onChange={(e) => setTicketMessage(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-strong)',
                    fontSize: '0.9rem',
                    color: 'var(--ink)',
                    outline: 'none',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={submittingTicket}
                style={{
                  backgroundColor: 'var(--accent-orange)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px 20px',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  transition: 'opacity 0.15s',
                  opacity: submittingTicket ? 0.7 : 1,
                }}
              >
                {submittingTicket ? 'Transmitting Ticket...' : 'Dispatch Ticket to Support Desk →'}
              </button>
            </form>
          </div>

          {/* Ticket History Card */}
          <div
            style={{
              background: 'var(--color-surface, #ffffff)',
              borderRadius: '16px',
              border: '1px solid var(--color-border, #e2e8f0)',
              padding: '1.5rem',
              boxShadow: '0 4px 15px rgba(0,0,0,0.03)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--color-text, #0f172a)' }}>
                  Support History & Status
                </h2>
                <p style={{ fontSize: '0.825rem', color: 'var(--muted)', margin: 0 }}>
                  Real-time ticket lifecycle tracking
                </p>
              </div>
              <button
                type="button"
                onClick={loadTickets}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border-strong)',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '0.785rem',
                  fontWeight: 600,
                  color: 'var(--muted)',
                  cursor: 'pointer',
                }}
              >
                Refresh
              </button>
            </div>

            {tickets.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--muted)' }}>
                <p style={{ fontSize: '2rem', margin: '0 0 8px 0' }}>🎫</p>
                <p style={{ fontWeight: 600, margin: '0 0 4px 0', color: 'var(--muted)' }}>No Active Tickets</p>
                <p style={{ fontSize: '0.8rem', margin: 0 }}>Your dispute log is completely clean.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {tickets.map((t: any) => (
                  <div
                    key={t.id}
                    style={{
                      padding: '12px',
                      borderRadius: '10px',
                      border: '1px solid var(--line)',
                      backgroundColor: 'var(--surface-elevated)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '0.725rem', fontWeight: 700, color: 'var(--accent-orange)', letterSpacing: '0.5px' }}>
                        {t.ticketNumber || `#${t.id.slice(0, 8)}`}
                      </span>
                      <h4 style={{ margin: '2px 0 4px 0', fontSize: '0.9rem', fontWeight: 700, color: 'var(--ink)' }}>
                        {t.subject}
                      </h4>
                      <p style={{ margin: 0, fontSize: '0.775rem', color: 'var(--muted)' }}>
                        {t.createdAt ? formatDateTime(t.createdAt) : 'Recently logged'}
                      </p>
                    </div>
                    <span
                      style={{
                        fontSize: '0.725rem',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: '6px',
                        backgroundColor: t.status === 'RESOLVED' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(234, 179, 8, 0.15)',
                        color: t.status === 'RESOLVED' ? '#10b981' : '#b45309',
                      }}
                    >
                      {t.status || 'OPEN'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
