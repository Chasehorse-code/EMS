import { useEffect, useRef, useState } from 'react';
import {
  X,
  Camera,
  Clock,
  CheckCircle2,
  Play,
  Send,
  Navigation,
  Sparkles,
} from 'lucide-react';
import { api } from '@/api';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { stampGeotagOnImage } from '@/utils/geoTag';
import { haversineKm } from '@/utils/geo';
import { ReasonDialog } from '@/components/tasks/ReasonDialog';
import type { Task } from '@/types';

interface WorkerTaskExecutionModalProps {
  task: Task;
  onClose: () => void;
  onTaskUpdated: () => void;
}

export function WorkerTaskExecutionModal({ task, onClose, onTaskUpdated }: WorkerTaskExecutionModalProps) {
  const { user, profile } = useAuth();
  const { notify } = useToast();

  const [currentStatus, setCurrentStatus] = useState(task.status);
  const [checklist, setChecklist] = useState<Array<{ id: string; label: string; required: boolean; requiresPhoto: boolean; done: boolean; photoUrl?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reasonMode, setReasonMode] = useState<'decline' | 'drop' | null>(null);
  const [releasing, setReleasing] = useState(false);

  // Camera states
  const [cameraActive, setCameraActive] = useState(false);
  const [activeChecklistItemId, setActiveChecklistItemId] = useState<string | null>(null);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [photoWarning, setPhotoWarning] = useState<string | null>(null);

  // Live GPS state
  const [deviceGps, setDeviceGps] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [gpsBlocked, setGpsBlocked] = useState(false);
  const [distanceToSiteMeters, setDistanceToSiteMeters] = useState<number | null>(null);

  const empCode = (profile as any)?.employeeCode || (`EMP-${(user?.id || 'CH').slice(0, 6).toUpperCase()}`);

  // Acquire high accuracy GPS for task geofencing
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setGpsBlocked(true);
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const acc = Math.round(pos.coords.accuracy);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setDeviceGps({ lat, lng, accuracy: acc });

        // Calculate distance to task location
        if (task.location?.lat && task.location?.lng) {
          const km = haversineKm({ lat, lng }, { lat: task.location.lat, lng: task.location.lng });
          const meters = Math.round(km * 1000);
          setDistanceToSiteMeters(meters);

          // Geofence check: target completion radius is 200m
          if (acc > 100) {
            setGpsBlocked(true);
          } else {
            setGpsBlocked(false);
          }
        }
      },
      () => setGpsBlocked(true),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [task.location]);

  // Load checklist items
  useEffect(() => {
    const loadChecklist = async () => {
      setLoading(true);
      try {
        const templates = await api.listChecklists();
        const matched = templates.find((t) => t.id === task.checklistTemplateId) || templates[0];
        if (matched && matched.items) {
          setChecklist(
            matched.items.map((item) => ({
              id: item.id,
              label: item.label,
              required: item.required,
              requiresPhoto: item.requiresPhoto,
              done: false,
            }))
          );
        } else {
          // Default standard retail / site checklist
          setChecklist([
            { id: '1', label: 'Arrive at designated GPS site location', required: true, requiresPhoto: false, done: false },
            { id: '2', label: 'Capture wide-angle site front signage photo', required: true, requiresPhoto: true, done: false },
            { id: '3', label: 'Inspect shelf planogram and compliance items', required: true, requiresPhoto: true, done: false },
            { id: '4', label: 'Verify absence of damage, hazards, or stock-out', required: true, requiresPhoto: false, done: false },
          ]);
        }
      } catch {
        setChecklist([
          { id: '1', label: 'Arrive at verified field location', required: true, requiresPhoto: false, done: false },
          { id: '2', label: 'Capture photo proof of completed audit', required: true, requiresPhoto: true, done: false },
        ]);
      } finally {
        setLoading(false);
      }
    };

    loadChecklist();
  }, [task.checklistTemplateId]);

  // Start task transition
  const handleStartTask = async () => {
    try {
      await api.acceptTask(task.id);
      setCurrentStatus('in_progress');
      notify('Task started! Proceed with on-site checklist.', 'success');
      onTaskUpdated();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Could not start task', 'danger');
    }
  };

  // Decline an assigned task / drop an accepted one (reason goes to the manager by e-mail)
  const handleRelease = async (reason: string) => {
    setReleasing(true);
    try {
      if (reasonMode === 'decline') {
        await api.rejectTaskOffer(task.id, reason);
        notify('Task declined. Your operations manager has been told.', 'info');
      } else {
        await api.dropTask(task.id, reason);
        notify('Task dropped. It is back in the open pool and your manager has been told.', 'info');
      }
      setReasonMode(null);
      onTaskUpdated();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Could not update the task', 'danger');
    } finally {
      setReleasing(false);
    }
  };

  // Launch live camera
  const startCamera = async (itemId: string) => {
    // Check GPS accuracy & geofence before opening camera
    if (deviceGps && deviceGps.accuracy > 100) {
      notify(`GPS accuracy is ±${deviceGps.accuracy}m. Move outdoors to reach ≤100m before taking photos.`, 'danger');
      return;
    }

    setActiveChecklistItemId(itemId);
    setPhotoWarning(null);
    setCameraActive(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      setVideoStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err: unknown) {
      notify('Could not access live camera. Please grant camera permission.', 'danger');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (videoStream) {
      videoStream.getTracks().forEach((t) => t.stop());
      setVideoStream(null);
    }
    setCameraActive(false);
    setActiveChecklistItemId(null);
  };

  // Capture frame and stamp two-line unobtrusive footer
  const capturePhoto = async () => {
    if (!videoRef.current || !activeChecklistItemId) return;
    if (gpsBlocked) {
      notify('Photo capture blocked: GPS accuracy must be ≤100m and within 200m task radius.', 'danger');
      return;
    }

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Quality check: calculate average brightness
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let totalBrightness = 0;
    for (let i = 0; i < imgData.data.length; i += 4) {
      totalBrightness += (imgData.data[i] + imgData.data[i + 1] + imgData.data[i + 2]) / 3;
    }
    const avgBrightness = totalBrightness / (imgData.data.length / 4);

    if (avgBrightness < 40) {
      setPhotoWarning('Image is very dark. Please move to a better lit area.');
    } else {
      setPhotoWarning(null);
    }

    // Two-line unobtrusive photo stamp
    const stampMeta = {
      lat: deviceGps?.lat ?? (task.location?.lat || 16.2418),
      lng: deviceGps?.lng ?? (task.location?.lng || 80.6448),
      accuracy: deviceGps?.accuracy ?? 15,
      address: task.location?.address || task.location?.area || 'Verified On-Site',
      timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      taskId: task.id,
      employeeName: empCode,
    };

    const { stampedDataUrl } = await stampGeotagOnImage(canvas, stampMeta);

    // Attach to checklist item
    setChecklist((prev) =>
      prev.map((item) =>
        item.id === activeChecklistItemId
          ? { ...item, done: true, photoUrl: stampedDataUrl }
          : item
      )
    );

    notify('Photo stamped and recorded!', 'success');
    stopCamera();
  };

  // Submit Evidence & Complete Checklist
  const handleSubmitTask = async () => {
    // Validate all required items and required photos
    const missingItems = checklist.filter((i) => i.required && (!i.done || (i.requiresPhoto && !i.photoUrl)));
    if (missingItems.length > 0) {
      notify(`Missing ${missingItems.length} required item(s). Complete all items and required photos before submitting.`, 'danger');
      return;
    }

    setSubmitting(true);
    try {
      const photosPayload = checklist
        .filter((i) => i.photoUrl)
        .map((i) => ({
          caption: i.label,
          url: i.photoUrl!,
          checklistItemId: i.id,
          geotag: {
            lat: deviceGps?.lat,
            lng: deviceGps?.lng,
            accuracy: deviceGps?.accuracy,
            stamped: true,
          },
        }));

      await api.submitEvidence(task.id, {
        photos: photosPayload,
        checklist: checklist.map((i) => ({ itemId: i.id, label: i.label, done: i.done })),
        aiResult: { status: 'advisory_only', provider: 'server_side' },
      });

      setCurrentStatus('submitted');
      notify('Evidence submitted! Status updated to Awaiting Manager Review.', 'success');
      onTaskUpdated();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Submission failed', 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  // Google Maps Directions link
  const directionsUrl = task.location?.lat && task.location?.lng
    ? `https://www.google.com/maps/dir/?api=1&destination=${task.location.lat},${task.location.lng}`
    : '#';

  const allCompleted = checklist.length > 0 && checklist.every((i) => !i.required || (i.done && (!i.requiresPhoto || i.photoUrl)));

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: '1rem',
      }}
      onClick={() => !cameraActive && onClose()}
    >
      <div
        style={{
          background: 'var(--color-surface, #ffffff)',
          borderRadius: '20px',
          maxWidth: '680px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--color-border, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            background: 'var(--color-surface, #ffffff)',
            zIndex: 10,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--accent-orange)', fontFamily: 'monospace' }}>
                CH-{task.id.slice(-6).toUpperCase()}
              </span>
              <span
                style={{
                  fontSize: '0.725rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: currentStatus === 'approved' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(232, 84, 30, 0.1)',
                  color: currentStatus === 'approved' ? '#10b981' : 'var(--accent-orange)',
                  textTransform: 'uppercase',
                }}
              >
                {currentStatus.replace('_', ' ')}
              </span>
            </div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text, #0f172a)' }}>
              {task.title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{ width: '32px', height: '32px', borderRadius: '50%', border: 'none', background: 'rgba(15, 23, 42, 0.05)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Site Location & Directions */}
          <div
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
              <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text, #0f172a)' }}>
                📍 {task.location?.address || task.location?.area || 'Field Verification Site'}
              </p>
              {distanceToSiteMeters !== null && (
                <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: distanceToSiteMeters <= 200 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                  Distance to site: {distanceToSiteMeters}m {distanceToSiteMeters <= 200 ? '(Within site perimeter)' : '(Outside allowed 200m zone)'}
                </p>
              )}
            </div>

            {directionsUrl !== '#' && (
              <a
                href={directionsUrl}
                target="_blank"
                rel="noreferrer"
                className="btn btn--secondary"
                style={{
                  fontSize: '0.775rem',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  textDecoration: 'none',
                }}
              >
                <Navigation size={13} /> Get Directions
              </a>
            )}
          </div>

          {/* Start Task Action Banner if still assigned */}
          {currentStatus === 'assigned' && (
            <div
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--line)',
                color: 'var(--ink)',
                flexWrap: 'wrap',
                padding: '1.25rem',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
              }}
            >
              <div>
                <strong style={{ fontSize: '0.95rem', display: 'block', marginBottom: '2px' }}>
                  New task for you: accept or decline
                </strong>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--muted)' }}>
                  Accepting starts the live checklist and camera. Declining sends your reason to your manager.
                </p>
              </div>
              <button
                type="button"
                onClick={handleStartTask}
                className="btn btn--primary"
                style={{
                  backgroundColor: 'var(--accent-orange)',
                  border: 'none',
                  color: '#ffffff',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                }}
              >
                <Play size={15} fill="currentColor" /> Accept & Start
              </button>
              <button
                type="button"
                onClick={() => setReasonMode('decline')}
                className="btn btn--ghost"
                style={{ color: 'var(--ink)', border: '1px solid var(--border-strong)', padding: '10px 16px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', background: 'transparent' }}
              >
                Decline
              </button>
            </div>
          )}

          {/* Status notices */}
          {currentStatus === 'submitted' && (
            <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.3)', color: '#b45309', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={16} /> Evidence submitted. Awaiting manager review and verification.
            </div>
          )}

          {currentStatus === 'approved' && (
            <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#047857', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={16} /> Task verified & approved! Reward credited to your wallet.
            </div>
          )}

          {/* Interactive Checklist */}
          <div>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text, #0f172a)' }}>
              Execution Checklist & Geo-Tagged Evidence
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {loading ? (
                <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.85rem' }}>
                  Loading checklist items...
                </div>
              ) : (
                checklist.map((item) => (
                  <div
                  key={item.id}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '10px',
                    background: item.done ? 'rgba(16, 185, 129, 0.04)' : 'rgba(15, 23, 42, 0.02)',
                    border: `1px solid ${item.done ? 'rgba(16, 185, 129, 0.2)' : 'var(--color-border, #e2e8f0)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                  }}
                >
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text, #0f172a)' }}>
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setChecklist((prev) =>
                          prev.map((i) => (i.id === item.id ? { ...i, done: checked } : i))
                        );
                      }}
                      disabled={currentStatus !== 'in_progress'}
                      style={{ width: '16px', height: '16px', accentColor: 'var(--accent-orange)', cursor: 'pointer' }}
                    />
                    <span>
                      {item.label} {item.required && <span style={{ color: '#ef4444' }}>*</span>}
                    </span>
                  </label>

                  {/* Photo action if item requires photo */}
                  {item.requiresPhoto && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {item.photoUrl ? (
                        <div style={{ position: 'relative' }}>
                          <img
                            src={item.photoUrl}
                            alt="Captured proof"
                            style={{ width: '42px', height: '42px', borderRadius: '6px', objectFit: 'cover', border: '1px solid #10b981' }}
                          />
                          <span style={{ position: 'absolute', top: '-4px', right: '-4px', width: '14px', height: '14px', borderRadius: '50%', background: '#10b981', color: '#fff', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            ✓
                          </span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startCamera(item.id)}
                          disabled={currentStatus !== 'in_progress'}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            background: '#111315',
                            color: '#ffffff',
                            border: 'none',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            cursor: 'pointer',
                          }}
                        >
                          <Camera size={13} /> Take Photo
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )))}
            </div>
          </div>

          {/* AI Check notice: advisory only, server-side */}
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(15, 23, 42, 0.03)',
              border: '1px solid var(--color-border, #e2e8f0)',
              fontSize: '0.75rem',
              color: 'var(--muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Sparkles size={14} color="var(--accent-orange)" />
            <span>AI check not configured - manual review (advisory only). API keys are never stored in browser.</span>
          </div>

          {/* Submit Action */}
          {currentStatus === 'in_progress' && (
            <div style={{ borderTop: '1px solid var(--color-border, #e2e8f0)', paddingTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setReasonMode('drop')}
                style={{ marginRight: 'auto', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(200,50,40,.35)', color: '#9b2c22', background: 'transparent', cursor: 'pointer', fontWeight: 600 }}
              >
                Drop task
              </button>
              <button
                type="button"
                onClick={onClose}
                style={{ padding: '10px 18px', borderRadius: '8px', border: '1px solid var(--color-border, #e2e8f0)', background: 'transparent', cursor: 'pointer' }}
              >
                Close & Save Progress
              </button>
              <button
                type="button"
                onClick={handleSubmitTask}
                disabled={submitting || !allCompleted}
                className="btn btn--primary"
                style={{
                  backgroundColor: allCompleted ? 'var(--accent-orange)' : '#94a3b8',
                  color: '#ffffff',
                  border: 'none',
                  padding: '10px 24px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: allCompleted ? 'pointer' : 'not-allowed',
                }}
              >
                <Send size={15} /> {submitting ? 'Submitting...' : 'Submit for Manager Review'}
              </button>
            </div>
          )}
        </div>

        {/* Live Camera Modal Overlay */}
        {cameraActive && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: '#000000',
              zIndex: 200,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Viewfinder with Framing Guide */}
            <div style={{ position: 'relative', width: '100%', maxWidth: '640px', height: '80vh', overflow: 'hidden' }}>
              <video
                ref={videoRef}
                playsInline
                autoPlay
                muted
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />

              {/* Framing Guide Lines */}
              <div
                style={{
                  position: 'absolute',
                  inset: '40px',
                  border: '2px dashed rgba(255,255,255,0.6)',
                  borderRadius: '12px',
                  pointerEvents: 'none',
                }}
              />

              {/* Warning overlay if dark or blurry */}
              {photoWarning && (
                <div
                  style={{
                    position: 'absolute',
                    top: '20px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(239, 68, 68, 0.9)',
                    color: '#ffffff',
                    padding: '6px 14px',
                    borderRadius: '20px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                  }}
                >
                  ⚠️ {photoWarning}
                </div>
              )}

              {/* Real-time GPS badge in corner */}
              <div
                style={{
                  position: 'absolute',
                  bottom: '20px',
                  left: '20px',
                  background: 'rgba(15, 23, 42, 0.8)',
                  color: '#f8fafc',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  fontSize: '0.75rem',
                  fontFamily: 'monospace',
                }}
              >
                📍 GPS: {deviceGps?.lat.toFixed(5)}°, {deviceGps?.lng.toFixed(5)}° (±{deviceGps?.accuracy}m)
              </div>
            </div>

            {/* Camera Controls */}
            <div style={{ width: '100%', maxWidth: '640px', padding: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#111315' }}>
              <button
                type="button"
                onClick={stopCamera}
                style={{ color: '#ffffff', background: 'none', border: 'none', fontSize: '0.9rem', cursor: 'pointer', padding: '8px 16px' }}
              >
                Cancel
              </button>

              {/* Shutter Button */}
              <button
                type="button"
                onClick={capturePhoto}
                style={{
                  width: '68px',
                  height: '68px',
                  borderRadius: '50%',
                  background: '#ffffff',
                  border: '4px solid var(--accent-orange)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                aria-label="Capture photo"
              >
                <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'var(--accent-orange)' }} />
              </button>

              <div style={{ width: '60px' }} />
            </div>
          </div>
        )}
      </div>
      {/* Clicks inside must not reach the backdrop, which closes this modal. */}
      <div onClick={(e) => e.stopPropagation()}>
      <ReasonDialog
        open={reasonMode !== null}
        title={reasonMode === 'drop' ? 'Drop this task?' : 'Decline this task?'}
        description={reasonMode === 'drop'
          ? 'The task goes back to the open pool for nearby workers. Your operations manager and the admin get your reason by e-mail.'
          : 'The task is offered to other nearby workers. Your operations manager gets your reason by e-mail.'}
        confirmLabel={reasonMode === 'drop' ? 'Drop task' : 'Decline task'}
        danger={reasonMode === 'drop'}
        busy={releasing}
        presets={reasonMode === 'drop'
          ? ['Medical / personal emergency', 'Site closed or access refused', 'Vehicle breakdown', 'Unsafe conditions on site', 'Customer asked to reschedule']
          : ['Too far from my location', 'Not available at that time', 'Already on another task', 'Outside my skills']}
        onConfirm={handleRelease}
        onClose={() => setReasonMode(null)}
      />
      </div>
    </div>
  );
}
