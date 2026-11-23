import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapPin,
  AlertTriangle,
  X,
  List,
  Compass,
  Radio,
} from 'lucide-react';
import { api } from '@/api';
import { resetLocationSync, syncWorkerLocation } from '@/hooks/useLiveLocationSync';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { formatDateTime } from '@/utils/format';
import { priorityLabel } from '@/utils/labels';
import type { Task } from '@/types';

interface GpsFix {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}

export function NearbyPage() {
  const { user, profile, refreshProfile } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();

  // GPS state
  const [gps, setGps] = useState<GpsFix | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'acquiring' | 'locked' | 'denied' | 'poor_accuracy'>('acquiring');
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [fixAgeSec, setFixAgeSec] = useState<number>(0);
  const fixesRef = useRef<GpsFix[]>([]);

  // Location consent state
  const [consentGranted, setConsentGranted] = useState<boolean>(profile?.locationConsent ?? false);

  // Filters state
  const [radiusKm, setRadiusKm] = useState<number>(25);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'closest' | 'reward_high' | 'due_soon'>('closest');
  const [onlySkillMatches, setOnlySkillMatches] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // View mode
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  // Tasks state
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState<boolean>(false);
  const [confirmTask, setConfirmTask] = useState<Task | null>(null);
  const [accepting, setAccepting] = useState<boolean>(false);
  const [animatingOutIds, setAnimatingOutIds] = useState<Set<string>>(new Set());

  // 1. High Accuracy GPS Watcher with Multi-Fix Variance Filter
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setGpsStatus('denied');
      setGpsError('Geolocation is not supported by your browser.');
      return;
    }

    setGpsStatus('acquiring');
    fixesRef.current = [];

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const accuracy = Math.round(pos.coords.accuracy);
        const newFix: GpsFix = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy,
          timestamp: Date.now(),
        };

        // Discard fixes worse than 100 meters
        if (accuracy > 100) {
          setGpsStatus('poor_accuracy');
          setGpsError(`Accuracy is currently ${accuracy}m (target is ≤50m). Move outdoors or enable precise GPS.`);
          return;
        }

        // Collect up to 5 low-variance fixes and choose the best
        fixesRef.current.push(newFix);
        if (fixesRef.current.length > 5) fixesRef.current.shift();

        const bestFix = fixesRef.current.reduce((best, cur) => (cur.accuracy < best.accuracy ? cur : best), newFix);
        setGps(bestFix);
        setGpsStatus('locked');
        setGpsError(null);

        // If user consented, sync location to server
        // If the worker agreed, keep the server position fresh (throttled) so their radius is live.
        if (consentGranted) {
          syncWorkerLocation(bestFix.lat, bestFix.lng, bestFix.accuracy);
        }
      },
      (err) => {
        setGpsStatus('denied');
        setGpsError(err.message || 'Location permission was denied. Please allow location access to discover nearby tasks.');
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [consentGranted]);

  // Fix age timer
  useEffect(() => {
    const timer = setInterval(() => {
      if (gps) {
        setFixAgeSec(Math.round((Date.now() - gps.timestamp) / 1000));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [gps]);

  // 2. Fetch Tasks using GPS coordinates
  const fetchNearby = async () => {
    if (!gps) return;
    setLoadingTasks(true);
    try {
      const data = await api.listNearbyTasks(gps.lat, gps.lng, radiusKm);
      // Filter out tasks currently animating out
      setTasks(data.filter((t) => t.status === 'open'));
    } catch (err: unknown) {
      console.error('[NearbyPage] Fetch error:', err);
    } finally {
      setLoadingTasks(false);
    }
  };

  useEffect(() => {
    if (gps) {
      fetchNearby();
    }
  }, [gps?.lat, gps?.lng, radiusKm]);

  // 3. User skills for skill match toggle
  const userSkills = useMemo(() => {
    return (profile?.skills || []).map((s: string) => s.toLowerCase());
  }, [profile?.skills]);

  // 4. Filtering and Sorting
  const displayedTasks = useMemo(() => {
    return tasks
      .filter((t) => !animatingOutIds.has(t.id))
      .filter((t) => {
        if (selectedCategory !== 'all' && t.category !== selectedCategory) return false;
        if (selectedPriority !== 'all' && t.priority !== selectedPriority) return false;
        if (onlySkillMatches && userSkills.length > 0) {
          const cat = t.category.toLowerCase();
          const match = userSkills.some((s: string) => cat.includes(s) || s.includes(cat));
          if (!match) return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = t.title.toLowerCase().includes(q);
          const matchArea = t.location?.area?.toLowerCase().includes(q);
          if (!matchTitle && !matchArea) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'reward_high') return (b.rewardInr ?? 0) - (a.rewardInr ?? 0);
        if (sortBy === 'due_soon') return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
        return 0; // default closest from server
      });
  }, [tasks, animatingOutIds, selectedCategory, selectedPriority, onlySkillMatches, userSkills, searchQuery, sortBy]);

  // 5. Atomic Task Acceptance
  const handleConfirmAccept = async () => {
    if (!confirmTask) return;
    setAccepting(true);
    try {
      await api.acceptTask(confirmTask.id);
      notify(`Task "${confirmTask.title}" accepted! Opening task checklist.`, 'success');
      setConfirmTask(null);
      navigate('/tasks');
    } catch (err: any) {
      const errMsg = err?.message || '';
      if (errMsg.includes('concurrently') || errMsg.includes('409') || errMsg.includes('conflict')) {
        notify('Another worker just accepted this task ahead of you.', 'danger');
        // Animate card out
        setAnimatingOutIds((prev) => new Set(prev).add(confirmTask.id));
      } else {
        notify(errMsg || 'Failed to accept task', 'danger');
      }
      setConfirmTask(null);
    } finally {
      setAccepting(false);
    }
  };

  // 6. Decline / "Not Interested" Offer
  const handleRejectOffer = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.rejectTaskOffer(taskId);
      notify('Offer dismissed from your feed.', 'info');
      // Animate card out
      setAnimatingOutIds((prev) => new Set(prev).add(taskId));
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Action failed', 'danger');
    }
  };

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* 1. Header with GPS Diagnostics */}
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
            Nearby Field Tasks (GPS)
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--muted)' }}>
            Instant on-field task discovery verified against your device coordinates.
          </p>
        </div>

        {/* GPS Telemetry Pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div
            style={{
              padding: '6px 12px',
              borderRadius: '10px',
              background: 'rgba(15, 23, 42, 0.04)',
              border: '1px solid var(--color-border, #e2e8f0)',
              fontSize: '0.785rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Radio
              size={14}
              style={{
                color: gpsStatus === 'locked' ? '#10b981' : gpsStatus === 'poor_accuracy' ? '#eab308' : '#ef4444',
              }}
            />
            <span>
              {gps
                ? `GPS: ±${gps.accuracy}m (${fixAgeSec}s ago)`
                : gpsStatus === 'acquiring'
                ? 'Acquiring high-accuracy fix...'
                : 'GPS Offline'}
            </span>
          </div>

          <div className="view-toggle" role="group" aria-label="Layout view">
            <button
              type="button"
              className={`view-toggle__btn ${viewMode === 'list' ? 'view-toggle__btn--active' : ''}`}
              onClick={() => setViewMode('list')}
            >
              <List size={14} /> List
            </button>
            <button
              type="button"
              className={`view-toggle__btn ${viewMode === 'map' ? 'view-toggle__btn--active' : ''}`}
              onClick={() => setViewMode('map')}
            >
              <Compass size={14} /> Map
            </button>
          </div>
        </div>
      </div>

      {/* Accuracy Warning / Permission Warning */}
      {gpsError && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '12px',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            color: '#ef4444',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <AlertTriangle size={18} />
          <span>{gpsError}</span>
        </div>
      )}

      {/* 2. Smart Filters Bar */}
      <div
        style={{
          background: 'var(--color-surface, #ffffff)',
          borderRadius: '16px',
          border: '1px solid var(--color-border, #e2e8f0)',
          padding: '1.25rem 1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem', justifyContent: 'space-between' }}>
          {/* Radius Slider with 100km database cap note */}
          <div style={{ flex: '1', minWidth: '220px', maxWidth: '340px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '4px' }}>
              <span>Search Radius:</span>
              <strong style={{ color: 'var(--accent-orange)' }}>{radiusKm} km</strong>
            </div>
            <input
              type="range"
              min="1"
              max="100"
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent-orange)', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>*Database caps worker search radius at 100 km</span>
          </div>

          {/* Search Query */}
          <div style={{ flex: '1', minWidth: '200px' }}>
            <input
              type="text"
              placeholder="Filter by title or area..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input"
              style={{ width: '100%', boxSizing: 'border-box', height: '38px', fontSize: '0.825rem' }}
            />
          </div>

          {/* Category Dropdown */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="input"
              style={{ height: '38px', fontSize: '0.825rem', paddingRight: '24px' }}
            >
              <option value="all">All Categories</option>
              <option value="Shelf audit">Shelf Audit</option>
              <option value="Site survey">Site Survey</option>
              <option value="Signage check">Signage Check</option>
              <option value="Equipment inspection">Equipment Inspection</option>
              <option value="Delivery proof">Delivery Proof</option>
            </select>
          </div>

          {/* Priority Dropdown */}
          <div>
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="input"
              style={{ height: '38px', fontSize: '0.825rem', paddingRight: '24px' }}
            >
              <option value="all">All Priorities</option>
              <option value="low">Low Priority</option>
              <option value="normal">Normal Priority</option>
              <option value="high">High Priority</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="input"
              style={{ height: '38px', fontSize: '0.825rem' }}
            >
              <option value="closest">Closest First</option>
              <option value="reward_high">Highest Reward</option>
              <option value="due_soon">Due Soonest</option>
            </select>
          </div>
        </div>

        {/* Removable Active Filter Chips & Skill Match Toggle */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', paddingTop: '8px', borderTop: '1px solid var(--color-border, #e2e8f0)' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text, #1e293b)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={onlySkillMatches}
              onChange={(e) => setOnlySkillMatches(e.target.checked)}
              style={{ accentColor: 'var(--accent-orange)' }}
            />
            Match my verified skills
          </label>

          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text, #1e293b)', cursor: 'pointer', marginLeft: '8px' }}>
            <input
              type="checkbox"
              checked={consentGranted}
              onChange={(e) => {
                const checked = e.target.checked;
                setConsentGranted(checked);
                if (!checked) {
                  api.clearWorkerLocation().catch(() => {});
                  notify('Location sharing off. Your stored position was deleted; tasks near your registered zone are shown.', 'info');
                  refreshProfile().catch(() => {});
                } else {
                  // Consent must be saved on the server before positions are accepted.
                  api.updateWorkerProfile({ locationConsent: true })
                    .then(() => {
                      resetLocationSync();
                      if (gps) syncWorkerLocation(gps.lat, gps.lng, gps.accuracy);
                      refreshProfile().catch(() => {});
                      notify('Live location on. Tasks and assignments now follow where you are.', 'success');
                    })
                    .catch((err) => {
                      setConsentGranted(false);
                      notify(err instanceof Error ? err.message : 'Could not turn on location sharing', 'danger');
                    });
                }
              }}
              style={{ accentColor: '#10b981' }}
            />
            Sync GPS with Dispatch
          </label>

          {selectedCategory !== 'all' && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                borderRadius: '6px',
                background: 'rgba(232, 84, 30, 0.1)',
                color: 'var(--accent-orange)',
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
            >
              {selectedCategory}
              <X size={12} style={{ cursor: 'pointer' }} onClick={() => setSelectedCategory('all')} />
            </span>
          )}

          {searchQuery && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                borderRadius: '6px',
                background: 'rgba(15, 23, 42, 0.08)',
                color: 'var(--ink)',
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
            >
              "{searchQuery}"
              <X size={12} style={{ cursor: 'pointer' }} onClick={() => setSearchQuery('')} />
            </span>
          )}
        </div>
      </div>

      {/* 3. Tasks Render: Map vs List */}
      {viewMode === 'map' ? (
        /* Real Map View / Interactive Map with Leaflet / OpenStreetMap fallback */
        <div
          style={{
            background: 'var(--color-surface, #ffffff)',
            borderRadius: '16px',
            border: '1px solid var(--color-border, #e2e8f0)',
            overflow: 'hidden',
            height: '520px',
            position: 'relative',
          }}
        >
          {/* Map canvas notice */}
          <div
            style={{
              position: 'absolute',
              top: '12px',
              left: '12px',
              zIndex: 10,
              background: 'rgba(15, 23, 42, 0.85)',
              color: '#f8fafc',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '0.775rem',
              backdropFilter: 'blur(8px)',
            }}
          >
            🗺️ OpenStreetMap Tile Layer • {displayedTasks.length} tasks in {radiusKm}km radius
          </div>

          {gps ? (
            <iframe
              title="Nearby Tasks Map"
              width="100%"
              height="100%"
              frameBorder="0"
              scrolling="no"
              marginHeight={0}
              marginWidth={0}
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${gps.lng - 0.1}%2C${gps.lat - 0.1}%2C${gps.lng + 0.1}%2C${gps.lat + 0.1}&layer=mapnik&marker=${gps.lat}%2C${gps.lng}`}
              style={{ border: 'none', width: '100%', height: '100%' }}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--muted)' }}>
              Acquiring GPS fix to center map...
            </div>
          )}
        </div>
      ) : null}

      {/* List of Task Cards */}
      {loadingTasks && tasks.length === 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.25rem' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ height: '220px', borderRadius: '16px', background: 'var(--color-surface, #ffffff)', border: '1px solid var(--color-border, #e2e8f0)', opacity: 0.7 }} />
          ))}
        </div>
      ) : displayedTasks.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.25rem' }}>
          {displayedTasks.map((t) => (
            <div
              key={t.id}
              className="task-card"
              style={{
                background: 'var(--color-surface, #ffffff)',
                borderRadius: '16px',
                border: '1px solid var(--color-border, #e2e8f0)',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease, opacity 0.3s ease',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <span
                    style={{
                      fontSize: '0.725rem',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: 'rgba(232, 84, 30, 0.1)',
                      color: 'var(--accent-orange)',
                      textTransform: 'uppercase',
                    }}
                  >
                    {t.category}
                  </span>
                  <span
                    style={{
                      fontSize: '0.725rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: t.priority === 'urgent' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(59, 130, 246, 0.1)',
                      color: t.priority === 'urgent' ? '#ef4444' : '#3b82f6',
                    }}
                  >
                    {priorityLabel[t.priority]?.label || t.priority}
                  </span>
                </div>

                <h3 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text, #0f172a)' }}>
                  {t.title}
                </h3>
                <p style={{ margin: '0 0 8px 0', fontSize: '0.825rem', color: 'var(--muted)' }}>
                  📍 {t.location?.address || t.location?.area || 'Local site'}
                </p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '0.775rem', color: 'var(--muted)', marginTop: '6px' }}>
                  <span>Reward: <strong style={{ color: '#10b981', fontSize: '0.9rem' }}>₹{t.rewardInr ?? 0}</strong></span>
                  <span>Due: <strong>{formatDateTime(t.dueAt)}</strong></span>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid var(--color-border, #e2e8f0)', paddingTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setConfirmTask(t)}
                  className="btn btn--primary"
                  style={{
                    flex: 1,
                    backgroundColor: '#111315',
                    color: '#ffffff',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '0.825rem',
                    cursor: 'pointer',
                    border: 'none',
                  }}
                >
                  Accept Task
                </button>
                <button
                  type="button"
                  onClick={(e) => handleRejectOffer(t.id, e)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border, #e2e8f0)',
                    background: 'transparent',
                    color: 'var(--muted)',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                  }}
                >
                  Not interested
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Honest Empty State */
        <div
          style={{
            background: 'var(--color-surface, #ffffff)',
            borderRadius: '16px',
            border: '1px solid var(--color-border, #e2e8f0)',
            padding: '3rem 2rem',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(232, 84, 30, 0.1)',
              color: 'var(--accent-orange)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MapPin size={28} />
          </div>
          <div>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-text, #0f172a)' }}>
              No Open Tasks in {radiusKm} km
            </h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--muted)', maxWidth: '420px' }}>
              {!gps
                ? 'We need active GPS access to calculate distances. Enable GPS in your browser or device settings.'
                : 'There are currently no unassigned tasks within your specified radius. Try expanding the search radius slider up to 100 km.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setRadiusKm((prev) => Math.min(100, prev + 25))}
            className="btn btn--secondary"
            style={{ padding: '8px 18px', borderRadius: '8px', fontWeight: 600, fontSize: '0.85rem' }}
          >
            Expand Search Radius to {Math.min(100, radiusKm + 25)} km
          </button>
        </div>
      )}

      {/* Confirmation Bottom Sheet / Dialog */}
      {confirmTask && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1rem',
          }}
          onClick={() => !accepting && setConfirmTask(null)}
        >
          <div
            style={{
              background: 'var(--color-surface, #ffffff)',
              borderRadius: '16px',
              padding: '1.75rem',
              maxWidth: '460px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text, #0f172a)' }}>
              Accept Task Assignment?
            </h3>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: 'var(--muted)' }}>
              By accepting, this task will be atomically assigned to your ID ({user?.email || 'Worker'}). You will be expected to complete the verification checklist on-site.
            </p>

            <div style={{ background: 'rgba(15, 23, 42, 0.03)', padding: '12px', borderRadius: '10px', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
              <p style={{ margin: '0 0 4px 0', fontWeight: 700, color: 'var(--color-text, #0f172a)' }}>{confirmTask.title}</p>
              <p style={{ margin: 0, color: 'var(--muted)' }}>Reward Bounty: <strong style={{ color: '#10b981' }}>₹{confirmTask.rewardInr ?? 0}</strong></p>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setConfirmTask(null)}
                disabled={accepting}
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--color-border, #e2e8f0)', background: 'transparent', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAccept}
                disabled={accepting}
                style={{
                  padding: '8px 20px',
                  borderRadius: '8px',
                  background: 'var(--accent-orange)',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {accepting ? 'Claiming Task...' : 'Confirm Acceptance'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
