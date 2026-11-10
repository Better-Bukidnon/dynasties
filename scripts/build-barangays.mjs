#!/usr/bin/env node
// Builds data/barangays.json: a snapshot of the current elected barangay officials
// in Bukidnon (punong barangay, kagawad, SK chairperson), as listed by the DILG.
//
//   DILG barangay lookup ──▶ keep elected posts, drop contact details ──▶ data/barangays.json
//
// Source: Department of the Interior and Local Government, Local Officials
// directory, https://www.dilg.gov.ph/local-officials/index (data from the DILG
// Barangay Officials Profiling System). Works of the Philippine government are
// not subject to copyright (RA 8293, sec. 176).
//
// This is a snapshot of who DILG lists today. It has no terms or dates, so it
// stays separate from the election history in officials.json. It is never a
// source for a family tie. Emails and phone numbers are discarded on purpose.
//
// The lookup is the same request the DILG page sends. Responses are cached in
// .cache/dilg/ and fetched four at a time, so a re-run doesn't hit DILG again.
//
//   npm run data:brgy            build from cache, fetching what's missing
//   npm run data:brgy:refresh    re-fetch everything (after a barangay election)
//
// www.dilg.gov.ph sends an incomplete certificate chain, so the npm scripts run
// Node with --use-system-ca (Node 22.15+), which verifies it against the
// operating system's certificate store. TLS checks are never turned off.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = resolve(root, '.cache/dilg');
const OUT = resolve(root, 'data/barangays.json');
const REFRESH = process.argv.includes('--refresh');

const SOURCE_PAGE = 'https://www.dilg.gov.ph/local-officials/index';
const GEO = 'https://www.dilg.gov.ph/barangay-officials-directory';
const OFFICIALS = 'https://bis.dilg.gov.ph/bops/default/master-filter';
const REGION = '10';
const PROVINCE = '013'; // Bukidnon

// DILG city/municipality name → place id in officials.json.
const PLACE_OF = {
  BAUNGON: 'baungon', CABANGLASAN: 'cabanglasan', 'CITY OF VALENCIA': 'valencia', DAMULOG: 'damulog',
  DANGCAGAN: 'dangcagan', 'DON CARLOS': 'don-carlos', 'IMPASUG-ONG': 'impasug-ong', KADINGILAN: 'kadingilan',
  KALILANGAN: 'kalilangan', KIBAWE: 'kibawe', KITAOTAO: 'kitaotao', LANTAPAN: 'lantapan', LIBONA: 'libona',
  'CITY OF MALAYBALAY (CAPITAL)': 'malaybalay', 'CITY OF MALAYBALAY': 'malaybalay', MALITBOG: 'malitbog',
  'MANOLO FORTICH': 'manolo-fortich', MARAMAG: 'maramag', PANGANTUCAN: 'pangantucan', QUEZON: 'quezon',
  'SAN FERNANDO': 'san-fernando', SUMILAO: 'sumilao', TALAKAG: 'talakag',
};

// Elected posts only. Secretaries and treasurers are appointed, so they're left out.
const ROLE_OF = {
  'PUNONG BARANGAY': 'captain',
  'SANGGUNIANG BARANGAY MEMBER': 'kagawad',
  'SK CHAIRPERSON': 'sk-chair',
};
const ROLE_ORDER = ['captain', 'kagawad', 'sk-chair'];

// ---------- fetching ----------

async function cached(name, url) {
  const file = resolve(CACHE, name);
  if (!REFRESH) {
    try { return JSON.parse(await readFile(file, 'utf8')); } catch {}
  }
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      await writeFile(file, JSON.stringify(data));
      return data;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
  const code = lastErr?.cause?.code ?? '';
  const hint = /VERIFY|CERT/.test(code) ? ' (run through `npm run data:brgy`, which adds --use-system-ca)' : '';
  throw new Error(`Couldn't fetch ${url}: ${lastErr?.message} ${code}${hint}`);
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }));
  return out;
}

// ---------- cleaning ----------

// Typing slips seen in the DILG data: "MA/ ESTELA" for "Ma.", and a zero for an O inside a word.
const fixText = (s) => String(s ?? '')
  .replace(/\bMA\/\s*/gi, 'Ma. ')
  .replace(/(\p{L})0(?=\p{L}|\b)/gu, '$1o')
  .replace(/\s+/g, ' ').trim();

const SMALL = new Set(['de', 'del', 'dela', 'la', 'los', 'y', 'van', 'von']);
function titleCase(s) {
  return fixText(s).toLowerCase().split(' ').map((w, i) =>
    i > 0 && SMALL.has(w) ? w : w.replace(/(^|[-'.])(\p{L})/gu, (m, p, c) => p + c.toUpperCase()),
  ).join(' ');
}
const SUFFIX = /^(jr|sr|ii|iii|iv|v)\.?$/i;
function suffix(s) {
  const t = fixText(s);
  if (!t || /^n\/?a$/i.test(t)) return '';
  if (!SUFFIX.test(t)) return '';
  const w = t.replace('.', '').toLowerCase();
  return w === 'jr' || w === 'sr' ? `${w[0].toUpperCase()}${w[1]}.` : w.toUpperCase();
}
function personName(r) {
  const first = titleCase(r.FIRSTNAME);
  const mid = fixText(r.MIDDLENAME);
  const last = titleCase(r.LASTNAME);
  const sx = suffix(r.SUFFIX);
  // Middle initial only, as DILG's own page shows it.
  const mi = mid && !/^(n\/?a|-|\.)$/i.test(mid) ? `${mid[0].toUpperCase()}. ` : '';
  return { name: `${first} ${mi}${last}${sx ? ' ' + sx : ''}`.replace(/\s+/g, ' ').trim(), last };
}

// ---------- build ----------

await mkdir(CACHE, { recursive: true });

const towns = (await cached(`citymun-${PROVINCE}.json`, `${GEO}/get-citymun?regionId=${REGION}&provinceId=${PROVINCE}`))
  .filter((c) => c.id);
const unknown = towns.filter((t) => !PLACE_OF[t.text.toUpperCase()]);
if (unknown.length) throw new Error(`Unmapped DILG towns: ${unknown.map((t) => t.text).join(', ')}`);

const jobs = [];
for (const t of towns) {
  const brgys = (await cached(`brgy-${PROVINCE}-${t.id}.json`,
    `${GEO}/get-barangay?regionId=${REGION}&provinceId=${PROVINCE}&citymunId=${t.id}`)).filter((b) => b.id);
  for (const b of brgys) jobs.push({ town: t, brgy: b });
}
console.log(`${towns.length} cities and municipalities, ${jobs.length} barangays`);

let done = 0;
const results = await pool(jobs, 4, async ({ town, brgy }) => {
  const rows = await cached(`off-${PROVINCE}-${town.id}-${brgy.id}.json`,
    `${OFFICIALS}?region=${REGION}&province=${PROVINCE}&citymun=${town.id}&brgy=${brgy.id}`);
  if (++done % 50 === 0) console.log(`  ${done}/${jobs.length}`);
  return { town, brgy, rows: Array.isArray(rows) ? rows : [] };
});

const places = {};
const skipped = {};
let people = 0;
const empty = [];
for (const { town, brgy, rows } of results) {
  const place = PLACE_OF[town.text.toUpperCase()];
  const officials = [];
  for (const r of rows) {
    const role = ROLE_OF[fixText(r.POSITION).toUpperCase()];
    if (!role) { skipped[fixText(r.POSITION)] = (skipped[fixText(r.POSITION)] ?? 0) + 1; continue; }
    if (!fixText(r.LASTNAME)) continue;
    officials.push({ role, ...personName(r) });
  }
  officials.sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role)
    || (a.role === 'kagawad' ? a.last.localeCompare(b.last) : 0));
  if (!officials.length) empty.push(`${brgy.text}, ${town.text}`);
  people += officials.length;
  (places[place] ??= []).push({ id: `${town.id}-${brgy.id}`, name: fixText(brgy.text), officials: officials.map(({ role, name }) => ({ role, name })) });
}
for (const list of Object.values(places)) list.sort((a, b) => a.name.localeCompare(b.name));

const out = {
  pulledAt: new Date().toISOString().slice(0, 10),
  source: {
    publisher: 'Department of the Interior and Local Government (DILG)',
    name: 'Local Officials directory (Barangay Officials Profiling System)',
    url: SOURCE_PAGE,
  },
  note: 'Current officials as DILG lists them on the pull date. No terms or dates. Not a source for family ties. Contact details are not kept.',
  roles: ROLE_ORDER,
  places,
};
await writeFile(OUT, JSON.stringify(out, null, 1) + '\n');

const count = (role) => Object.values(places).flat().reduce((n, b) => n + b.officials.filter((o) => o.role === role).length, 0);
console.log(`data/barangays.json: ${jobs.length} barangays, ${people} officials ` +
  `(${count('captain')} captains, ${count('kagawad')} kagawads, ${count('sk-chair')} SK chairpersons)`);
if (Object.keys(skipped).length) console.log('Left out (not elected):', skipped);
if (empty.length) console.log(`No elected officials listed for ${empty.length} barangays:`, empty.slice(0, 20).join('; '));
