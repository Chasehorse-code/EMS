import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Search,
  Truck,
  AlertTriangle,
  Plus,
  X,
  ExternalLink,
  Shield,
  Activity,
  Send,
  Loader2,
} from 'lucide-react';
import { api } from '@/api';
import { useAuth } from '@/context/AuthContext';
import { useRole } from '@/context/RoleContext';

export interface TripData {
  id: string;
  tripId: string;
  truckNumber: string;
  driverPhoneMasked: string;
  driverPhoneRaw: string;
  invoiceNumber: string;
  lrNumber: string;
  status: 'RUNNING' | 'HALTED' | 'COMPLETED' | 'CONSENT_PENDING' | 'CANCELLED';
  originName: string;
  originCoords: [number, number];
  destinationName: string;
  destinationCoords: [number, number];
  currentLat: number;
  currentLng: number;
  locationName: string;
  speedKmH: number;
  lastUpdated: string;
  etaHours: number;
  totalHaltMinutes: number;
  consentStatus: 'RECEIVED' | 'PENDING' | 'DISCONNECTED' | 'NO_RESPONSE';
  consentAttempts: number;
  routeHistory: Array<{
    lat: number;
    lng: number;
    name: string;
    time: string;
    haltMinutes: number;
  }>;
}

export function TrackTruckModule() {
  const { profile } = useAuth();
  const { role } = useRole();

  const isAdmin = role === 'admin' || profile?.roles?.includes('ADMIN');

  const [trips, setTrips] = useState<TripData[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<TripData | null>(null);
  const [loadingTrips, setLoadingTrips] = useState(true);
  const [trackingError, setTrackingError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'AUTO' | 'TRIP_ID' | 'INVOICE' | 'TRUCK' | 'LR'>('AUTO');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Low balance state detection
  const [isLowBalance, setIsLowBalance] = useState<boolean>(false);

  // Create Trip Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [creatingTrip, setCreatingTrip] = useState(false);
  const [createForm, setCreateForm] = useState({
    truckNumber: '',
    driverPhone: '',
    invoiceNumber: '',
    originName: '',
    originLat: '17.3850',
    originLng: '78.4867',
    destinationName: '',
    destinationLat: '13.0827',
    destinationLng: '80.2707',
    etaDays: '1',
    etaHours: '4',
  });

  // End trip confirmation
  const [confirmEndTrip, setConfirmEndTrip] = useState(false);

  // Map Leaflet container ref
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  // Fetch real trips from database
  const fetchTrips = async () => {
    setLoadingTrips(true);
    setTrackingError(null);
    try {
      const res = await fetch(`${(api as any).baseUrl || 'http://localhost:8080/api/v1'}/tracking/trips`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const mapped: TripData[] = data.map((t: any) => ({
            id: t.id ? t.id.toString() : '',
            tripId: t.traqoTripId || (t.id ? t.id.toString().slice(0, 8) : 'TRIP-NEW'),
            truckNumber: t.truckNumber || 'Vehicle',
            driverPhoneMasked: t.driverPhone ? t.driverPhone.replace(/(\d{2})\d+(\d{3})/, '+91 $1*** **$2') : '',
            driverPhoneRaw: t.driverPhone || '',
            invoiceNumber: t.invoiceNumber || '',
            lrNumber: t.lrNumber || '',
            status: (t.status || 'RUNNING').toUpperCase() as any,
            originName: t.originName || 'Origin Terminal',
            originCoords: [t.originLat ? parseFloat(t.originLat) : 17.3850, t.originLng ? parseFloat(t.originLng) : 78.4867],
            destinationName: t.destinationName || 'Destination Terminal',
            destinationCoords: [t.destinationLat ? parseFloat(t.destinationLat) : 13.0827, t.destinationLng ? parseFloat(t.destinationLng) : 80.2707],
            currentLat: t.originLat ? parseFloat(t.originLat) : 17.3850,
            currentLng: t.originLng ? parseFloat(t.originLng) : 78.4867,
            locationName: t.originName || 'Origin Hub',
            speedKmH: 0,
            lastUpdated: t.updatedAt || 'Recent',
            etaHours: 0,
            totalHaltMinutes: 0,
            consentStatus: (t.consentStatus || 'PENDING').toUpperCase() as any,
            consentAttempts: t.consentCount || 0,
            routeHistory: [],
          }));
          setTrips(mapped);
          if (mapped.length > 0 && !selectedTrip) {
            setSelectedTrip(mapped[0]);
          }
        }
      }
    } catch {
      // Backend offline or error
    } finally {
      setLoadingTrips(false);
    }
  };

  useEffect(() => {
    fetchTrips();
  }, []);

  // Initialize or update Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const defaultCenter: [number, number] = selectedTrip
        ? [selectedTrip.currentLat, selectedTrip.currentLng]
        : [20.5937, 78.9629]; // Center on India

      const map = L.map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: selectedTrip ? 7 : 5,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      const markersLayer = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
      markersLayerRef.current = markersLayer;
    }

    const map = mapInstanceRef.current;
    const markers = markersLayerRef.current;
    if (!map || !markers) return;

    markers.clearLayers();

    if (!selectedTrip) {
      map.setView([20.5937, 78.9629], 5);
      return;
    }

    // Custom truck pin
    const truckIcon = L.divIcon({
      className: 'ch-map-truck-icon',
      html: `
        <div style="
          background: #D9531E;
          color: white;
          width: 38px;
          height: 38px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(217,83,30,0.4);
          border: 2px solid white;
        ">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>
            <path d="M15 18H9"/>
            <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/>
            <circle cx="17" cy="18" r="2"/>
            <circle cx="7" cy="18" r="2"/>
          </svg>
        </div>
      `,
      iconSize: [38, 38],
      iconAnchor: [19, 19],
    });

    // Add Live Truck Marker
    L.marker([selectedTrip.currentLat, selectedTrip.currentLng], { icon: truckIcon })
      .addTo(markers)
      .bindPopup(`
        <strong>${selectedTrip.truckNumber}</strong><br/>
        Status: ${selectedTrip.status}<br/>
        Location: ${selectedTrip.locationName}
      `);

    // Route Polyline if history exists
    if (selectedTrip.routeHistory && selectedTrip.routeHistory.length > 0) {
      const routeCoords: [number, number][] = [
        selectedTrip.originCoords,
        ...selectedTrip.routeHistory.map((h) => [h.lat, h.lng] as [number, number]),
        [selectedTrip.currentLat, selectedTrip.currentLng],
        selectedTrip.destinationCoords,
      ];

      const polyline = L.polyline(routeCoords, {
        color: '#D9531E',
        weight: 4,
        dashArray: '8, 8',
        opacity: 0.85,
      }).addTo(markers);

      map.fitBounds(polyline.getBounds(), { padding: [40, 40] });
    } else {
      map.setView([selectedTrip.currentLat, selectedTrip.currentLng], 8);
    }
  }, [selectedTrip]);

  // Handle Search input
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    const q = searchQuery.trim().toLowerCase();
    setTrackingError(null);

    // 1. Look up in locally loaded trips from database
    const found = trips.find((t) => {
      if (searchType === 'TRIP_ID') return t.tripId.toLowerCase().includes(q);
      if (searchType === 'INVOICE') return t.invoiceNumber.toLowerCase().includes(q);
      if (searchType === 'TRUCK') return t.truckNumber.toLowerCase().replace(/\s/g, '').includes(q.replace(/\s/g, ''));
      if (searchType === 'LR') return t.lrNumber.toLowerCase().includes(q);

      return (
        t.tripId.toLowerCase().includes(q) ||
        t.invoiceNumber.toLowerCase().includes(q) ||
        t.truckNumber.toLowerCase().replace(/\s/g, '').includes(q.replace(/\s/g, '')) ||
        t.lrNumber.toLowerCase().includes(q)
      );
    });

    if (found) {
      setSelectedTrip(found);
      return;
    }

    // 2. Query Traqo API live proxy for external invoice / LR
    try {
      const res = await fetch(`${(api as any).baseUrl || 'http://localhost:8080/api/v1'}/tracking/location?invoice=${encodeURIComponent(q)}&tripId=${encodeURIComponent(q)}`);
      if (res.ok) {
        const live = await res.json();
        if (live && (live.lat || live.current_lat || live.truck_number)) {
          const liveTrip: TripData = {
            id: live.trip_id || `traqo-${Date.now()}`,
            tripId: live.trip_id || q.toUpperCase(),
            truckNumber: live.truck_number || 'External Truck',
            driverPhoneMasked: live.driver_phone_masked || '',
            driverPhoneRaw: live.driver_phone || '',
            invoiceNumber: live.invoice || q,
            lrNumber: live.lr_number || '',
            status: 'RUNNING',
            originName: live.srcname || 'Origin Hub',
            originCoords: [17.3850, 78.4867],
            destinationName: live.destname || 'Destination Terminal',
            destinationCoords: [13.0827, 80.2707],
            currentLat: parseFloat(live.current_lat || live.lat || '17.3850'),
            currentLng: parseFloat(live.current_lng || live.lng || '78.4867'),
            locationName: live.location_name || 'Traqo GPS Active Location',
            speedKmH: live.speed_kmh ? parseFloat(live.speed_kmh) : 0,
            lastUpdated: live.last_updated || 'Live',
            etaHours: live.eta_hours ? parseFloat(live.eta_hours) : 0,
            totalHaltMinutes: 0,
            consentStatus: 'RECEIVED',
            consentAttempts: 1,
            routeHistory: [],
          };
          setSelectedTrip(liveTrip);
        } else {
          setTrackingError(`No active shipment found matching "${q}" in database or Traqo gateway.`);
        }
      } else if (res.status === 403) {
        setIsLowBalance(true);
      } else {
        const err = await res.json().catch(() => ({}));
        setTrackingError(err.message || `No shipment found for "${q}".`);
      }
    } catch {
      setTrackingError('Unable to query Traqo live telemetry service.');
    }
  };

  // Filtered trips list
  const filteredTrips = trips.filter((t) => {
    if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
    return true;
  });

  // Resend Consent SMS via backend API
  const handleResendConsent = async () => {
    if (!selectedTrip || selectedTrip.consentAttempts >= 5) return;

    try {
      await fetch(`${(api as any).baseUrl || 'http://localhost:8080/api/v1'}/tracking/consent/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: selectedTrip.driverPhoneRaw }),
      });

      setSelectedTrip((prev) => prev ? ({
        ...prev,
        consentAttempts: prev.consentAttempts + 1,
      }) : null);
    } catch {
      // Backend error
    }
  };

  // End trip action via backend API and database
  const handleEndTrip = async () => {
    if (!selectedTrip) return;
    try {
      await fetch(`${(api as any).baseUrl || 'http://localhost:8080/api/v1'}/tracking/trips/${selectedTrip.id}/end`, {
        method: 'POST',
      });
      setSelectedTrip((prev) => prev ? ({ ...prev, status: 'COMPLETED' }) : null);
      setTrips((prev) =>
        prev.map((t) => (t.id === selectedTrip.id ? { ...t, status: 'COMPLETED' } : t))
      );
      setConfirmEndTrip(false);
    } catch {
      setConfirmEndTrip(false);
    }
  };

  // Create new trip persisted to Database and Traqo API
  const handleCreateTripSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingTrip(true);
    setTrackingError(null);

    try {
      const res = await fetch(`${(api as any).baseUrl || 'http://localhost:8080/api/v1'}/tracking/trips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          truck_number: createForm.truckNumber,
          tel: createForm.driverPhone,
          invoice: createForm.invoiceNumber,
          srcname: createForm.originName,
          src: `${createForm.originLat},${createForm.originLng}`,
          destname: createForm.destinationName,
          dest: `${createForm.destinationLat},${createForm.destinationLng}`,
          eta_days: createForm.etaDays,
          eta_hrs: createForm.etaHours,
        }),
      });

      if (res.ok) {
        setCreateModalOpen(false);
        setCreateForm({
          truckNumber: '',
          driverPhone: '',
          invoiceNumber: '',
          originName: '',
          originLat: '17.3850',
          originLng: '78.4867',
          destinationName: '',
          destinationLat: '13.0827',
          destinationLng: '80.2707',
          etaDays: '1',
          etaHours: '4',
        });
        await fetchTrips();
      } else {
        const err = await res.json().catch(() => ({}));
        setTrackingError(err.message || 'Unable to create tracked trip.');
      }
    } catch {
      setTrackingError('Network error connecting to tracking gateway.');
    } finally {
      setCreatingTrip(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Low Balance Warning Banner */}
      {isLowBalance && (
        <div
          style={{
            background: isAdmin ? 'rgba(176, 74, 58, 0.12)' : 'var(--ch-surface-2)',
            border: isAdmin ? '1px solid #B04A3A' : '1px solid var(--ch-border)',
            borderRadius: '14px',
            padding: '1rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={20} color={isAdmin ? '#B04A3A' : 'var(--ch-muted)'} />
            <div>
              <strong style={{ color: isAdmin ? '#B04A3A' : 'var(--ch-ink)', fontSize: '0.9rem' }}>
                {isAdmin ? 'Traqo API Low Balance Alert' : 'Tracking Status'}
              </strong>
              <div style={{ fontSize: '0.82rem', color: 'var(--ch-muted)' }}>
                {isAdmin
                  ? 'Your Traqo organization wallet balance is low (HTTP 403 status: low_balance). Recharge account to sustain live GPS updates.'
                  : 'Live truck tracking is temporarily unavailable. Please check back shortly.'}
              </div>
            </div>
          </div>
          {isAdmin && (
            <a
              href="https://dashboard.traqo.in"
              target="_blank"
              rel="noopener noreferrer"
              className="ch-btn-orange"
              style={{ fontSize: '0.78rem', padding: '6px 14px' }}
            >
              Recharge Traqo Balance <ExternalLink size={13} />
            </a>
          )}
        </div>
      )}

      {/* Error or status message */}
      {trackingError && (
        <div
          style={{
            background: 'rgba(176, 74, 58, 0.12)',
            border: '1px solid rgba(176, 74, 58, 0.3)',
            borderRadius: '12px',
            padding: '0.85rem 1.25rem',
            color: '#B04A3A',
            fontSize: '0.85rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{trackingError}</span>
          <button
            type="button"
            onClick={() => setTrackingError(null)}
            style={{ background: 'none', border: 'none', color: '#B04A3A', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Universal Search & Dispatch Toolbar */}
      <div
        className="ch-card"
        style={{
          padding: '1.25rem',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', flex: 1, minWidth: '320px' }}>
          {/* Search Selector */}
          <select
            value={searchType}
            onChange={(e) => setSearchType(e.target.value as any)}
            className="ch-select"
            style={{ width: 'auto', fontSize: '0.84rem', padding: '0.65rem 1rem' }}
          >
            <option value="AUTO">Auto-Detect Query</option>
            <option value="TRIP_ID">Trip ID</option>
            <option value="INVOICE">Invoice Number</option>
            <option value="TRUCK">Truck Number</option>
            <option value="LR">LR Number</option>
          </select>

          {/* Search Input */}
          <div style={{ position: 'relative', flex: '1 1 240px' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: 11, color: 'var(--ch-muted)' }} />
            <input
              type="text"
              placeholder="Search Trip ID, Invoice, or Truck Number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="ch-input"
              style={{ paddingLeft: '36px', fontSize: '0.85rem', padding: '0.65rem 0.65rem 0.65rem 36px' }}
            />
          </div>

          <button
            type="button"
            onClick={handleSearch}
            className="ch-btn-pill-black"
            style={{ fontSize: '0.82rem', padding: '0.65rem 1.4rem' }}
          >
            Track Parcel / Truck
          </button>
        </div>

        <button
          type="button"
          onClick={() => setCreateModalOpen(true)}
          className="ch-btn-orange"
          style={{ fontSize: '0.82rem', padding: '0.65rem 1.4rem' }}
        >
          <Plus size={16} /> Create Trip
        </button>
      </div>

      {/* Main Track View: Interactive Map (Left) + Telemetry & Consent (Right) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: '1.5rem' }}>
        {/* Left: Leaflet OpenStreetMap View */}
        <div className="ch-card" style={{ padding: '0', overflow: 'hidden', minHeight: '480px', display: 'flex', flexDirection: 'column' }}>
          {selectedTrip ? (
            <>
              <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--ch-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Truck size={18} color="var(--ch-orange)" />
                  <strong style={{ fontSize: '0.94rem' }}>{selectedTrip.truckNumber}</strong>
                  <span className="ch-mono-badge" style={{ margin: 0, padding: '2px 8px', fontSize: '0.68rem' }}>
                    {selectedTrip.tripId}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: 'var(--ch-muted)' }}>
                  <Activity size={14} color="var(--ch-green)" />
                  <span>Status: {selectedTrip.status}</span>
                </div>
              </div>

              <div
                ref={mapContainerRef}
                style={{ width: '100%', height: '420px', zIndex: 1, background: '#e5e3df' }}
              />

              <div style={{ padding: '0.85rem 1.25rem', background: 'var(--ch-surface-2)', borderTop: '1px solid var(--ch-border)', fontSize: '0.8rem', color: 'var(--ch-muted)', display: 'flex', justifyContent: 'space-between' }}>
                <span>Location: <strong>{selectedTrip.locationName}</strong></span>
                <span>Last Updated: {selectedTrip.lastUpdated}</span>
              </div>
            </>
          ) : (
            <div style={{ padding: '4rem 2rem', textAlign: 'center', margin: 'auto' }}>
              <Truck size={42} color="var(--ch-orange)" style={{ margin: '0 auto 1rem auto' }} />
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.5rem 0' }}>
                No Active Tracked Shipments in Database
              </h3>
              <p style={{ color: 'var(--ch-muted)', fontSize: '0.88rem', maxWidth: '420px', margin: '0 auto 1.5rem auto' }}>
                All trips are stored authoritatively in PostgreSQL and dispatched through Traqo API. Click below to create your first shipment.
              </p>
              <button
                type="button"
                onClick={() => setCreateModalOpen(true)}
                className="ch-btn-orange"
                style={{ margin: '0 auto' }}
              >
                <Plus size={16} /> Create Tracked Trip
              </button>
            </div>
          )}
        </div>

        {/* Right: Telemetry Card & Consent Panel & Route Timeline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {selectedTrip ? (
            <>
              {/* Status & Telemetry Card */}
              <div className="ch-card" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <span
                    style={{
                      fontFamily: 'var(--ch-font-mono)',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      padding: '4px 10px',
                      borderRadius: '9999px',
                      background: selectedTrip.status === 'RUNNING' ? 'rgba(47, 125, 91, 0.12)' : '#FBF4E8',
                      color: selectedTrip.status === 'RUNNING' ? 'var(--ch-green)' : '#B7791F',
                      border: selectedTrip.status === 'RUNNING' ? '1px solid var(--ch-green)' : '1px solid #B7791F',
                    }}
                  >
                    {selectedTrip.status}
                  </span>

                  <button
                    type="button"
                    onClick={() => setConfirmEndTrip(true)}
                    disabled={selectedTrip.status === 'COMPLETED'}
                    className="ch-btn-pill-black"
                    style={{
                      fontSize: '0.74rem',
                      padding: '4px 10px',
                      background: selectedTrip.status === 'COMPLETED' ? '#cccccc' : '#B04A3A',
                    }}
                  >
                    End Trip
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                  <div>
                    <span style={{ color: 'var(--ch-muted)', display: 'block', fontSize: '0.75rem' }}>Driver Phone (Masked)</span>
                    <strong>{selectedTrip.driverPhoneMasked || 'N/A'}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--ch-muted)', display: 'block', fontSize: '0.75rem' }}>Corridor</span>
                    <strong>{selectedTrip.originName} → {selectedTrip.destinationName}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--ch-muted)', display: 'block', fontSize: '0.75rem' }}>Invoice / LR</span>
                    <span>{selectedTrip.invoiceNumber || selectedTrip.lrNumber || 'N/A'}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--ch-muted)', display: 'block', fontSize: '0.75rem' }}>Trip Ref</span>
                    <span>{selectedTrip.tripId}</span>
                  </div>
                </div>

                {/* Consent Panel */}
                <div
                  style={{
                    background: 'var(--ch-surface-2, #EFECE4)',
                    borderRadius: '12px',
                    padding: '1rem',
                    border: '1px solid var(--ch-border)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Shield size={16} color="var(--ch-orange)" />
                      <strong style={{ fontSize: '0.82rem' }}>Telecom GPS Consent</strong>
                    </div>
                    <span
                      style={{
                        fontFamily: 'var(--ch-font-mono)',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        color: selectedTrip.consentStatus === 'RECEIVED' ? 'var(--ch-green)' : '#B7791F',
                      }}
                    >
                      {selectedTrip.consentStatus}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.78rem', color: 'var(--ch-muted)', marginBottom: '0.75rem' }}>
                    Traqo cellular tracking requires driver SMS consent.
                    Sent {selectedTrip.consentAttempts}/5 SMS notifications.
                  </div>

                  <button
                    type="button"
                    onClick={handleResendConsent}
                    disabled={selectedTrip.consentAttempts >= 5}
                    className="ch-btn-pill-black"
                    style={{
                      fontSize: '0.76rem',
                      padding: '5px 12px',
                      width: '100%',
                      opacity: selectedTrip.consentAttempts >= 5 ? 0.5 : 1,
                    }}
                  >
                    <Send size={12} /> Resend Consent SMS ({5 - selectedTrip.consentAttempts} remaining)
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="ch-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--ch-muted)' }}>
              <Shield size={32} style={{ margin: '0 auto 0.75rem auto', color: 'var(--ch-muted)' }} />
              <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--ch-ink)', marginBottom: '0.35rem' }}>
                Select a shipment or search above
              </div>
              <p style={{ fontSize: '0.82rem', margin: 0 }}>
                Enter an Invoice # or Trip ID to query live telematics from the Traqo API.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Trips Table with Filters */}
      <div className="ch-card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h3 className="ch-card-title" style={{ fontSize: '1.15rem', margin: 0 }}>
              Tracked Shipments (Database)
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--ch-muted)' }}>
              Showing {filteredTrips.length} registered trips from PostgreSQL
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="ch-select"
              style={{ width: 'auto', fontSize: '0.8rem', padding: '5px 10px' }}
            >
              <option value="ALL">All Statuses</option>
              <option value="RUNNING">Running</option>
              <option value="CONSENT_PENDING">Consent Pending</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
            <thead>
              <tr style={{ background: 'var(--ch-surface-2)', borderBottom: '1px solid var(--ch-border)' }}>
                <th style={{ padding: '0.75rem', fontFamily: 'var(--ch-font-mono)', fontSize: '0.72rem', textTransform: 'uppercase' }}>Trip ID</th>
                <th style={{ padding: '0.75rem', fontFamily: 'var(--ch-font-mono)', fontSize: '0.72rem', textTransform: 'uppercase' }}>Vehicle</th>
                <th style={{ padding: '0.75rem', fontFamily: 'var(--ch-font-mono)', fontSize: '0.72rem', textTransform: 'uppercase' }}>Corridor</th>
                <th style={{ padding: '0.75rem', fontFamily: 'var(--ch-font-mono)', fontSize: '0.72rem', textTransform: 'uppercase' }}>Invoice</th>
                <th style={{ padding: '0.75rem', fontFamily: 'var(--ch-font-mono)', fontSize: '0.72rem', textTransform: 'uppercase' }}>Status</th>
                <th style={{ padding: '0.75rem', fontFamily: 'var(--ch-font-mono)', fontSize: '0.72rem', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingTrips ? (
                <tr>
                  <td colSpan={6} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--ch-muted)' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Fetching tracked trips from database...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredTrips.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--ch-muted)' }}>
                    No tracked shipments found in database. Click "+ Create Trip" to register a shipment.
                  </td>
                </tr>
              ) : (
                filteredTrips.map((trip) => (
                  <tr
                    key={trip.id}
                    style={{
                      borderBottom: '1px solid var(--ch-border)',
                      background: selectedTrip?.id === trip.id ? 'rgba(217, 83, 30, 0.05)' : 'transparent',
                      cursor: 'pointer',
                    }}
                    onClick={() => setSelectedTrip(trip)}
                  >
                    <td style={{ padding: '0.75rem', fontFamily: 'var(--ch-font-mono)', fontWeight: 700 }}>
                      {trip.tripId}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <strong>{trip.truckNumber}</strong>
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      {trip.originName.split(',')[0]} → {trip.destinationName.split(',')[0]}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      {trip.invoiceNumber || '—'}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <span
                        style={{
                          fontFamily: 'var(--ch-font-mono)',
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '9999px',
                          background: trip.status === 'RUNNING' ? 'rgba(47, 125, 91, 0.12)' : '#FBF4E8',
                          color: trip.status === 'RUNNING' ? 'var(--ch-green)' : '#B7791F',
                        }}
                      >
                        {trip.status}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTrip(trip);
                        }}
                        className="ch-btn-pill-black"
                        style={{ padding: '4px 10px', fontSize: '0.74rem' }}
                      >
                        View Map
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Trip Modal */}
      {createModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            zIndex: 100,
          }}
          onClick={() => setCreateModalOpen(false)}
        >
          <div
            className="ch-card"
            style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', padding: '2rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <span className="ch-mono-badge">Traqo Dispatch & DB Persistence</span>
                <h3 className="ch-card-title" style={{ fontSize: '1.4rem', margin: 0 }}>
                  Create & Track New Trip
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ch-muted)' }}
              >
                <X size={22} />
              </button>
            </div>

            <form onSubmit={handleCreateTripSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                <div className="ch-form-group">
                  <label className="ch-form-label">
                    Truck Number <span className="ch-required-star">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. TS 07 UA 9912"
                    value={createForm.truckNumber}
                    onChange={(e) => setCreateForm({ ...createForm, truckNumber: e.target.value })}
                    className="ch-input"
                  />
                </div>

                <div className="ch-form-group">
                  <label className="ch-form-label">
                    Driver Phone <span className="ch-required-star">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="10-digit phone for SMS"
                    value={createForm.driverPhone}
                    onChange={(e) => setCreateForm({ ...createForm, driverPhone: e.target.value })}
                    className="ch-input"
                  />
                </div>

                <div className="ch-form-group">
                  <label className="ch-form-label">Invoice Number</label>
                  <input
                    type="text"
                    placeholder="e.g. INV-2026-4011"
                    value={createForm.invoiceNumber}
                    onChange={(e) => setCreateForm({ ...createForm, invoiceNumber: e.target.value })}
                    className="ch-input"
                  />
                </div>

                <div className="ch-form-group">
                  <label className="ch-form-label">Estimated Transit Hours</label>
                  <input
                    type="number"
                    placeholder="e.g. 6"
                    value={createForm.etaHours}
                    onChange={(e) => setCreateForm({ ...createForm, etaHours: e.target.value })}
                    className="ch-input"
                  />
                </div>
              </div>

              <div className="ch-form-group" style={{ marginTop: '0.5rem' }}>
                <label className="ch-form-label">Origin Location Name</label>
                <input
                  type="text"
                  placeholder="e.g. Hyderabad Logistics Hub, TG"
                  value={createForm.originName}
                  onChange={(e) => setCreateForm({ ...createForm, originName: e.target.value })}
                  className="ch-input"
                />
              </div>

              <div className="ch-form-group" style={{ marginTop: '0.5rem' }}>
                <label className="ch-form-label">Destination Location Name</label>
                <input
                  type="text"
                  placeholder="e.g. Chennai Port Terminal, TN"
                  value={createForm.destinationName}
                  onChange={(e) => setCreateForm({ ...createForm, destinationName: e.target.value })}
                  className="ch-input"
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="ch-btn-pill-black"
                  style={{ background: 'transparent', color: 'var(--ch-ink)', border: '1px solid var(--ch-border)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingTrip}
                  className="ch-btn-orange"
                >
                  {creatingTrip ? <Loader2 size={16} className="animate-spin" /> : 'Dispatch & Track on Traqo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* End Trip Modal */}
      {confirmEndTrip && selectedTrip && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            zIndex: 100,
          }}
          onClick={() => setConfirmEndTrip(false)}
        >
          <div
            className="ch-card"
            style={{ width: '100%', maxWidth: '440px', padding: '1.75rem', textAlign: 'center' }}
            onClick={(e) => e.stopPropagation()}
          >
            <AlertTriangle size={36} color="#B04A3A" style={{ margin: '0 auto 0.75rem auto' }} />
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.5rem 0' }}>
              End Tracked Trip?
            </h3>
            <p style={{ color: 'var(--ch-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              This will notify Traqo API to terminate GPS pings for truck <strong>{selectedTrip.truckNumber}</strong> and mark status as COMPLETED in the database.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => setConfirmEndTrip(false)}
                className="ch-btn-pill-black"
                style={{ background: 'transparent', color: 'var(--ch-ink)', border: '1px solid var(--ch-border)' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEndTrip}
                className="ch-btn-pill-black"
                style={{ background: '#B04A3A', color: '#fff' }}
              >
                Confirm End Trip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
