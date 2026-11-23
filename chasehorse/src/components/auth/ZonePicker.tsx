import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { Crosshair, MapPin, X } from 'lucide-react';
import { loadIndiaPlaces, nearestPlace, searchPlaces, type IndiaPlace } from '@/utils/indiaPlaces';

interface ZonePickerProps {
  value: IndiaPlace | null;
  onChange: (place: IndiaPlace | null) => void;
  invalid?: boolean;
}

/**
 * "Primary work operational zone": search any Indian town / mandal / taluk
 * (e.g. "Tenali" → "Tenali, Guntur dist, Andhra Pradesh") or pick the nearest one to the
 * device's GPS position. The lookup runs on the device; the position is never sent anywhere.
 */
export function ZonePicker({ value, onChange, invalid }: ZonePickerProps) {
  const [places, setPlaces] = useState<IndiaPlace[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  useEffect(() => {
    loadIndiaPlaces()
      .then(setPlaces)
      .catch(() => setLoadError('Could not load the list of places. Check your connection and reload.'));
  }, []);

  const results = useMemo(() => (places && query.trim().length >= 2 ? searchPlaces(places, query) : []), [places, query]);

  const choose = (place: IndiaPlace) => {
    onChange(place);
    setQuery('');
    setOpen(false);
    setLocateError(null);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % results.length); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a - 1 + results.length) % results.length); }
    if (e.key === 'Enter') { e.preventDefault(); choose(results[active]); }
    if (e.key === 'Escape') setOpen(false);
  };

  const useMyLocation = () => {
    setLocateError(null);
    if (!navigator.geolocation) {
      setLocateError('Location is not available on this device. Search for your town instead.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const all = places ?? (await loadIndiaPlaces());
          const near = nearestPlace(all, pos.coords.latitude, pos.coords.longitude);
          if (near) choose(near);
          else setLocateError('No nearby place found. Search for your town instead.');
        } catch {
          setLocateError('Could not load the list of places.');
        } finally {
          setLocating(false);
        }
      },
      (err) => {
        setLocating(false);
        setLocateError(err.code === err.PERMISSION_DENIED
          ? 'Location permission was denied. Search for your town instead.'
          : 'Could not get your location. Search for your town instead.');
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 },
    );
  };

  return (
    <div className="ch-reg-field">
      <label htmlFor="zone-search">Primary work operational zone</label>

      {value ? (
        <div className="ch-zone-picked">
          <span><MapPin size={14} style={{ verticalAlign: '-2px' }} /> <strong>{value.name}</strong>, {value.district} dist, {value.stateName}</span>
          <button type="button" className="ch-reg-linkbtn" onClick={() => onChange(null)} aria-label="Change zone">
            <X size={14} style={{ verticalAlign: '-2px' }} /> Change
          </button>
        </div>
      ) : (
        <div className="ch-zone">
          <div className="ch-reg-input-wrap">
            <MapPin size={16} />
            <input
              id="zone-search"
              className="ch-reg-input"
              role="combobox"
              aria-expanded={open && results.length > 0}
              aria-controls="zone-options"
              aria-autocomplete="list"
              aria-invalid={invalid || undefined}
              aria-activedescendant={open && results[active] ? `zone-opt-${active}` : undefined}
              autoComplete="off"
              placeholder={places ? 'Type your town or mandal, e.g. Tenali' : 'Loading places…'}
              disabled={!places && !loadError}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(0); }}
              onFocus={() => setOpen(true)}
              onBlur={() => window.setTimeout(() => setOpen(false), 120)}
              onKeyDown={onKeyDown}
            />
          </div>
          {open && query.trim().length >= 2 && places && (
            <ul id="zone-options" className="ch-zone-list" role="listbox">
              {results.length === 0 && <li className="ch-zone-empty">No match. Try the nearest town or your district name.</li>}
              {results.map((p, i) => (
                <li key={`${p.name}-${p.district}-${p.stateCode}`} id={`zone-opt-${i}`} role="option"
                  aria-selected={i === active} className="ch-zone-option"
                  onMouseDown={(e) => { e.preventDefault(); choose(p); }} onMouseEnter={() => setActive(i)}>
                  {p.name}
                  <small>{p.district} dist, {p.stateName}</small>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!value && (
        <button type="button" className="ch-reg-linkbtn ch-zone-locate" onClick={useMyLocation} disabled={locating}>
          <Crosshair size={14} /> {locating ? 'Finding your location…' : 'Use my current location'}
        </button>
      )}
      {(loadError || locateError) && <p className="ch-reg-hint" data-tone="error">{loadError || locateError}</p>}
      <p className="ch-reg-hint">
        Your zone's operations manager reviews your application. You'll see open tasks within 100 km.
        {' '}<span style={{ opacity: 0.75 }}>Place data © <a href="https://www.geonames.org" target="_blank" rel="noopener noreferrer">GeoNames</a> (CC BY 4.0).</span>
      </p>
    </div>
  );
}
