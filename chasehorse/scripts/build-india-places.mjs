#!/usr/bin/env node
/**
 * Builds public/data/india-places.json — the town / sub-district list used by the
 * worker "Primary work operational zone" picker and the 100 km task radius.
 *
 * Source: GeoNames (https://www.geonames.org), licensed CC BY 4.0.
 * Download these three files from https://download.geonames.org/export/dump/ into a folder:
 *   IN.zip (unzip it to IN.txt), admin1CodesASCII.txt, admin2Codes.txt
 *
 * Usage: node scripts/build-india-places.mjs <folder-with-geonames-files> [out.json]
 *
 * Kept: sub-districts (ADM3: mandals / taluks / tehsils) and populated places that
 * have a population figure or are administrative seats. One entry per name+district.
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const [srcDir, outArg] = process.argv.slice(2);
if (!srcDir) {
  console.error('Usage: node scripts/build-india-places.mjs <geonames-folder> [out.json]');
  process.exit(1);
}
const outFile = outArg ?? path.resolve('public/data/india-places.json');

// GeoNames admin1 name -> the app's state codes (database table `states`).
const STATE_CODES = {
  'Andhra Pradesh': 'AP', Telangana: 'TG', Karnataka: 'KA', 'Tamil Nadu': 'TN', Maharashtra: 'MH',
  Delhi: 'DL', Kerala: 'KL', Gujarat: 'GJ', Rajasthan: 'RJ', 'Uttar Pradesh': 'UP', 'West Bengal': 'WB',
  'Madhya Pradesh': 'MP', Punjab: 'PB', Haryana: 'HR', Odisha: 'OR', Bihar: 'BR', Assam: 'AS',
  Jharkhand: 'JH', Chhattisgarh: 'CT', Uttarakhand: 'UT', 'Himachal Pradesh': 'HP', Goa: 'GA',
  Tripura: 'TR', Meghalaya: 'ML', Manipur: 'MN', Nagaland: 'NL', Mizoram: 'MZ',
  'Arunachal Pradesh': 'AR', Sikkim: 'SK', 'Jammu and Kashmir': 'JK', Ladakh: 'LA', Puducherry: 'PY',
  Chandigarh: 'CH', 'Andaman and Nicobar': 'AN', 'Dadra and Nagar Haveli and Daman and Diu': 'DN',
  Lakshadweep: 'LD',
};

const readTsv = (file) =>
  fs.readFileSync(path.join(srcDir, file), 'utf8').split('\n').filter(Boolean).map((l) => l.split('\t'));

// admin1: "IN.02" -> state code
const admin1 = new Map();
for (const [code, name] of readTsv('admin1CodesASCII.txt')) {
  if (!code.startsWith('IN.')) continue;
  const stateCode = STATE_CODES[name];
  if (!stateCode) throw new Error(`No state code mapping for GeoNames admin1 "${name}"`);
  admin1.set(code, stateCode);
}

// admin2: "IN.02.548" -> district ascii name
const admin2 = new Map();
for (const [code, , ascii] of readTsv('admin2Codes.txt')) {
  if (code.startsWith('IN.')) admin2.set(code, ascii);
}

const states = [...new Set(admin1.values())].sort();
const stateIdx = new Map(states.map((s, i) => [s, i]));
const districts = []; // [name, stateIdx]
const districtIdx = new Map();
const places = new Map(); // key -> [name, districtIdx, lat, lng, kind]

const rl = readline.createInterface({ input: fs.createReadStream(path.join(srcDir, 'IN.txt'), 'utf8') });
for await (const line of rl) {
  const c = line.split('\t');
  const [, , ascii, , lat, lng, fclass, fcode, , , a1, a2] = c;
  const population = Number(c[14]) || 0;
  const isSubDistrict = fclass === 'A' && fcode === 'ADM3';
  const isTown = fclass === 'P' && (population > 0 || fcode.startsWith('PPLA') || fcode === 'PPLC');
  if (!isSubDistrict && !isTown) continue;

  const stateCode = admin1.get(`IN.${a1}`);
  if (!stateCode || !ascii) continue;

  const dKey = `IN.${a1}.${a2}`;
  let dIdx = -1;
  if (a2 && admin2.has(dKey)) {
    if (!districtIdx.has(dKey)) {
      districtIdx.set(dKey, districts.length);
      districts.push([admin2.get(dKey), stateIdx.get(stateCode)]);
    }
    dIdx = districtIdx.get(dKey);
  }
  if (dIdx === -1) continue; // a place without a district can't be shown as "Town, District, State"

  const key = `${ascii.toLowerCase()}|${dIdx}`;
  const entry = [ascii, dIdx, Number(Number(lat).toFixed(4)), Number(Number(lng).toFixed(4)), isTown ? 1 : 0];
  // Prefer the town point over the sub-district centroid when both exist.
  if (!places.has(key) || (isTown && places.get(key)[4] === 0)) places.set(key, entry);
}

const sorted = [...places.values()].sort((a, b) => a[0].localeCompare(b[0]));
const out = {
  v: 1,
  source: 'GeoNames (www.geonames.org), CC BY 4.0',
  states,
  districts,
  // [name, districtIndex, lat, lng]
  places: sorted.map(([n, d, la, ln]) => [n, d, la, ln]),
};
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(out));
console.log(`states=${states.length} districts=${districts.length} places=${sorted.length} -> ${outFile} (${Math.round(fs.statSync(outFile).size / 1024)} KB)`);
