/**
 * India towns and sub-districts (mandals / taluks / tehsils) for the field-worker
 * "Primary work operational zone" picker. Data: GeoNames (CC BY 4.0), built by
 * scripts/build-india-places.mjs into public/data/india-places.json and loaded on demand.
 */

export interface IndiaPlace {
  name: string;
  district: string;
  stateCode: string;
  stateName: string;
  lat: number;
  lng: number;
  /** "Tenali, Guntur dist, Andhra Pradesh" */
  label: string;
}

interface RawPlaces {
  v: number;
  states: string[];
  districts: [string, number][];
  places: [string, number, number, number][];
}

export const STATE_NAMES: Record<string, string> = {
  AP: 'Andhra Pradesh', TG: 'Telangana', KA: 'Karnataka', TN: 'Tamil Nadu', MH: 'Maharashtra',
  DL: 'Delhi', KL: 'Kerala', GJ: 'Gujarat', RJ: 'Rajasthan', UP: 'Uttar Pradesh', WB: 'West Bengal',
  MP: 'Madhya Pradesh', PB: 'Punjab', HR: 'Haryana', OR: 'Odisha', BR: 'Bihar', AS: 'Assam',
  JH: 'Jharkhand', CT: 'Chhattisgarh', UT: 'Uttarakhand', HP: 'Himachal Pradesh', GA: 'Goa',
  TR: 'Tripura', ML: 'Meghalaya', MN: 'Manipur', NL: 'Nagaland', MZ: 'Mizoram',
  AR: 'Arunachal Pradesh', SK: 'Sikkim', JK: 'Jammu and Kashmir', LA: 'Ladakh', PY: 'Puducherry',
  CH: 'Chandigarh', AN: 'Andaman and Nicobar Islands', DN: 'Dadra and Nagar Haveli and Daman and Diu',
  LD: 'Lakshadweep',
};

let cache: Promise<IndiaPlace[]> | null = null;

/** Loads (once) and returns all places. */
export function loadIndiaPlaces(): Promise<IndiaPlace[]> {
  if (!cache) {
    cache = fetch('/data/india-places.json')
      .then((res) => {
        if (!res.ok) throw new Error(`Could not load places (HTTP ${res.status})`);
        return res.json() as Promise<RawPlaces>;
      })
      .then((raw) =>
        raw.places.map(([name, d, lat, lng]) => {
          const [district, s] = raw.districts[d];
          const stateCode = raw.states[s];
          const stateName = STATE_NAMES[stateCode] ?? stateCode;
          return { name, district, stateCode, stateName, lat, lng, label: `${name}, ${district} dist, ${stateName}` };
        }),
      )
      .catch((err) => {
        cache = null; // allow a retry
        throw err;
      });
  }
  return cache;
}

const normalise = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/**
 * Ranked search: name starts with the query first, then district matches, then any substring.
 * "tenali", "guntur", "tenali guntur" and "ap" style partial input all work.
 */
export function searchPlaces(places: IndiaPlace[], query: string, limit = 8): IndiaPlace[] {
  const terms = normalise(query).split(/[\s,]+/).filter(Boolean);
  if (terms.length === 0) return [];
  const [first, ...rest] = terms;

  const scored: { place: IndiaPlace; score: number }[] = [];
  for (const place of places) {
    const name = normalise(place.name);
    const district = normalise(place.district);
    const state = normalise(place.stateName);
    const code = place.stateCode.toLowerCase();

    let score: number;
    if (name === first) score = 0;
    else if (name.startsWith(first)) score = 1;
    else if (district.startsWith(first)) score = 2;
    else if (name.includes(first)) score = 3;
    else continue;

    const restMatch = rest.every((t) => district.startsWith(t) || state.startsWith(t) || code === t || name.includes(t));
    if (!restMatch) continue;
    scored.push({ place, score });
  }
  scored.sort((a, b) => a.score - b.score || a.place.name.length - b.place.name.length || a.place.name.localeCompare(b.place.name));
  return scored.slice(0, limit).map((s) => s.place);
}

/** Closest place to a GPS position (equirectangular approximation is plenty at this scale). */
export function nearestPlace(places: IndiaPlace[], lat: number, lng: number): IndiaPlace | null {
  let best: IndiaPlace | null = null;
  let bestD = Infinity;
  const cosLat = Math.cos((lat * Math.PI) / 180);
  for (const p of places) {
    const dx = (p.lng - lng) * cosLat;
    const dy = p.lat - lat;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}
