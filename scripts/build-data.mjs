#!/usr/bin/env node
// Builds data/officials.json: every elected official in Bukidnon, 2001–2025.
//
//   Open Halalan winners CSV ──▶ clean names and places ──▶ match people ──▶ data/officials.json
//
// Source: Leung, R. et al. (2026). OpenHalalan: The Philippine National and Local
// Election Dataset. Zenodo. https://doi.org/10.5281/zenodo.17783099 (ODbL 1.0).
// data/officials.json is a derived database and is published under the ODbL as well.
//
// Corrections live in data/corrections.json, each with a reason. Never hand-edit
// data/officials.json. No dependencies (Node 18+).
//
//   node scripts/build-data.mjs            download (cached in .cache/) and build
//   node scripts/build-data.mjs --refresh  re-download the CSV first

import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { recordSource } from './sources.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CSV_URL = 'https://github.com/RobertRLeung/OpenHalalan/releases/download/data-latest/NLE_Winners_2004-2025.csv';
const CACHE = resolve(root, '.cache/winners.csv');
const OUT = resolve(root, 'data/officials.json');
const corrections = JSON.parse(await readFile(resolve(root, 'data/corrections.json'), 'utf8'));

// ---------- Places ----------

// District numbers follow RA 10184 (in effect since the 2013 elections).
const PLACES = [
  ['BAUNGON', 'baungon', 'Baungon', 'municipality', '1st'],
  ['LIBONA', 'libona', 'Libona', 'municipality', '1st'],
  ['MALITBOG', 'malitbog', 'Malitbog', 'municipality', '1st'],
  ['MANOLO FORTICH', 'manolo-fortich', 'Manolo Fortich', 'municipality', '1st'],
  ['SUMILAO', 'sumilao', 'Sumilao', 'municipality', '1st'],
  ['TALAKAG', 'talakag', 'Talakag', 'municipality', '1st'],
  ['MALAYBALAY', 'malaybalay', 'Malaybalay City', 'city', '2nd'],
  ['CABANGLASAN', 'cabanglasan', 'Cabanglasan', 'municipality', '2nd'],
  ['IMPASUG ONG', 'impasug-ong', 'Impasug-ong', 'municipality', '2nd'],
  ['LANTAPAN', 'lantapan', 'Lantapan', 'municipality', '2nd'],
  ['SAN FERNANDO', 'san-fernando', 'San Fernando', 'municipality', '2nd'],
  ['DAMULOG', 'damulog', 'Damulog', 'municipality', '3rd'],
  ['DANGCAGAN', 'dangcagan', 'Dangcagan', 'municipality', '3rd'],
  ['DON CARLOS', 'don-carlos', 'Don Carlos', 'municipality', '3rd'],
  ['KADINGILAN', 'kadingilan', 'Kadingilan', 'municipality', '3rd'],
  ['KIBAWE', 'kibawe', 'Kibawe', 'municipality', '3rd'],
  ['KITAOTAO', 'kitaotao', 'Kitaotao', 'municipality', '3rd'],
  ['MARAMAG', 'maramag', 'Maramag', 'municipality', '3rd'],
  ['QUEZON', 'quezon', 'Quezon', 'municipality', '3rd'],
  ['KALILANGAN', 'kalilangan', 'Kalilangan', 'municipality', '4th'],
  ['PANGANTUCAN', 'pangantucan', 'Pangantucan', 'municipality', '4th'],
  ['VALENCIA', 'valencia', 'Valencia City', 'city', '4th'],
];
const PLACE_ID = Object.fromEntries(PLACES.map(([src, id]) => [src, id]));

const POSITIONS = {
  GOVERNOR: 'governor',
  'VICE GOVERNOR': 'vice-governor',
  'MEMBER, HOUSE OF REPRESENTATIVES': 'representative',
  'PROVINCIAL BOARD MEMBER': 'board-member',
  MAYOR: 'mayor',
  'VICE MAYOR': 'vice-mayor',
  COUNCILOR: 'councilor',
};
const PROVINCIAL = new Set(['governor', 'vice-governor', 'representative', 'board-member']);

// ---------- CSV ----------

async function loadCsv() {
  const refresh = process.argv.includes('--refresh');
  const cached = await stat(CACHE).then(() => true, () => false);
  if (refresh || !cached) {
    console.log(`Downloading ${CSV_URL}`);
    const res = await fetch(CSV_URL);
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    await mkdir(dirname(CACHE), { recursive: true });
    await writeFile(CACHE, Buffer.from(await res.arrayBuffer()));
  }
  return readFile(CACHE, 'utf8');
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') (field += '"'), i++;
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') row.push(field), (field = '');
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field), rows.push(row), (row = []), (field = '');
    } else field += c;
  }
  if (field || row.length) row.push(field), rows.push(row);
  const [head, ...body] = rows;
  const h = head.map((s) => s.replace(/^﻿/, ''));
  return body.filter((r) => r.length > 1).map((r) => Object.fromEntries(h.map((k, i) => [k, r[i] ?? ''])));
}

// ---------- Names ----------

const SUFFIXES = new Set(['JR.', 'JR', 'SR.', 'SR', 'II', 'III', 'IV']);
const PARTICLES = ['DE LA', 'DELA', 'DEL', 'DE'];

function fixText(s) {
  let out = s.trim().replace(/\s+/g, ' ');
  // UTF-8 read as Windows-1252 ("CASIÃ‘O" → "CASIÑO")
  out = out.replace(/Ã‘/g, 'Ñ').replace(/Ã±/g, 'ñ').replace(/Ã©/g, 'é');
  return out.replace(/�/g, corrections.mojibake.default);
}

function splitSuffix(tokens) {
  const keep = [];
  let suffix = '';
  for (const t of tokens) {
    if (SUFFIXES.has(t)) suffix = t.replace(/\.$/, '').replace(/^(JR|SR)$/, '$1.');
    else keep.push(t);
  }
  return { tokens: keep, suffix };
}

function cleanName(r, knownLasts) {
  let last = fixText(r['Last Name']).toUpperCase();
  const firstRaw = splitSuffix(fixText(r['First Name']).toUpperCase().split(' ').filter(Boolean));
  const midRaw = splitSuffix(fixText(r['Middle Name']).toUpperCase().split(' ').filter(Boolean));
  // Office words and titles that leak into name fields ("PIZARRO, MAYOR OMARADJI")
  const noise = (t) => corrections.nameNoise.includes(t);
  let firstToks = firstRaw.tokens.filter((t) => !noise(t));
  let mid = midRaw.tokens.filter((t) => !noise(t));
  if (!firstToks.length && mid.length) firstToks = [mid.shift()];
  let first = firstToks.join(' ');
  const suffix = firstRaw.suffix || midRaw.suffix;

  // "ROSA, OSMUNDO DE LA" → last "DE LA ROSA"; "RABANES, REYNALDO SIO ANG" → "ANG RABANES"
  const midStr = mid.join(' ');
  for (const p of PARTICLES) {
    if (midStr === p || midStr.endsWith(' ' + p)) {
      last = `${p} ${last}`;
      mid = midStr.slice(0, midStr.length - p.length).trim().split(' ').filter(Boolean);
      break;
    }
  }
  if (mid.length && knownLasts.has(`${mid.at(-1)} ${last}`)) last = `${mid.pop()} ${last}`;
  // Garbage middle names: a repeat of the first name ("PABILLARAN, WARREN WARREN")
  if (mid.join(' ') === first) mid = [];

  return { last, first, middle: mid.join(' '), suffix, title: fixText(r.Title) };
}

// Comparison form: no accents (Quiño = Quino), no dots, "MA." = "MARIA", "DE LA" = "DELA".
const norm = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\./g, '')
    .replace(/^DE LA /, 'DELA ')
    .trim();
const normTok = (t) => (norm(t) === 'MA' ? 'MARIA' : norm(t));
// Given names and the middle name as one sequence. The source splits multi-word
// first names inconsistently ("LEANDRO | JOSE HALLAZGO" vs "LEANDRO JOSE | H."),
// so people are compared on the whole sequence.
const givenSeq = (n) => [...n.first.split(' '), ...n.middle.split(' ')].filter(Boolean).map(normTok);
const keyOf = (n) => `${norm(n.last)}|${givenSeq(n)[0] ?? ''}`;

// Two sequences match when every position they share is equal or an initial of the other.
function seqCompatible(a, b) {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const [x, y] = [a[i], b[i]];
    if (x === y) continue;
    if ((x.length === 1 && y.startsWith(x)) || (y.length === 1 && x.startsWith(y))) continue;
    return false;
  }
  return true;
}

// The source's two common slips between elections, where word-by-word comparison fails:
//   a second given name left out   "RHEA RHENNA HALINA" / "RHEA HALINA"
//   a middle name mistyped         "BENJAMIN ALUMBRO"   / "BENJAMIN ALOMBRO"
// The last word is the middle name; the given names must match as a prefix, and the
// middle names must be equal, an initial of each other, or one or two letters apart.
function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
function middleClose(a, b) {
  if (a === b) return true;
  if (a[0] !== b[0]) return false;
  if (a.length <= 2 || b.length <= 2) return true; // "LP." for "LASPIÑAS"
  return a.length >= 5 && b.length >= 5 && editDistance(a, b) <= 2;
}
function looseCompatible(a, b) {
  if (a.length < 2 || b.length < 2) return false;
  const [ga, gb] = [a.slice(0, -1), b.slice(0, -1)];
  const [short, long] = ga.length <= gb.length ? [ga, gb] : [gb, ga];
  return seqCompatible(short, long) && middleClose(a.at(-1), b.at(-1));
}

const SMALL = new Set(['DE', 'DEL', 'DELA', 'LA', 'Y']);
function titleCase(s) {
  return s
    .toLowerCase()
    .split(' ')
    .map((w, i, all) =>
      // Particles stay lowercase inside a name ("Osmundo dela Rosa"), not at its start
      i > 0 && i < all.length - 1 && SMALL.has(w.toUpperCase()) ? w : w.replace(/(^|[-'])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()),
    )
    .join(' ')
    .replace(/\bMa\b(?!\.)/g, 'Ma.')
    .replace(/\b(Ii|Iii|Iv)\b/g, (m) => m.toUpperCase());
}

// "First Second M. Last Jr.": every given name, then the middle name as an initial.
function displayName(n) {
  const seq = [...n.first.split(' '), ...n.middle.split(' ')].filter(Boolean);
  const hasMiddle = n.middle && seq.length > 1;
  const given = hasMiddle ? seq.slice(0, -1) : seq;
  const initial = hasMiddle ? ` ${seq.at(-1)[0]}.` : '';
  return titleCase(`${given.join(' ')}${initial} ${n.last}${n.suffix ? ' ' + n.suffix : ''}`.replace(/\s+/g, ' '));
}

// ---------- Build ----------

const raw = parseCsv(await loadCsv()).filter((r) => r.Province.toUpperCase() === 'BUKIDNON');
const knownLasts = new Set(raw.map((r) => fixText(r['Last Name']).toUpperCase()));
const fixes = [];
const fixId = (reason) => {
  let i = fixes.findIndex((f) => f.reason === reason);
  if (i < 0) i = fixes.push({ id: `fix-${fixes.length + 1}`, reason }) - 1;
  return fixes[i].id;
};

let terms = raw.map((r) => {
  const position = POSITIONS[r.Position];
  if (!position) throw new Error(`Unknown position: ${r.Position}`);
  const name = cleanName(r, knownLasts);
  return {
    name,
    year: Number(r.Year),
    position,
    srcPlace: r.City.toUpperCase().trim(),
    place: PROVINCIAL.has(position) ? null : PLACE_ID[r.City.toUpperCase().trim()] ?? null,
    party: fixText(r.Party),
    ballot: fixText(r['Full Name']),
    sex: r.Sex || null,
  };
});

// 1. Explicit place fixes
for (const f of corrections.placeFixes) {
  const hits = terms.filter(
    (t) => t.year === f.year && t.position === POSITIONS[f.position] && norm(t.name.last) === norm(f.last) && `${t.name.first} ${t.name.middle}`.startsWith(f.first),
  );
  if (hits.length !== 1) throw new Error(`placeFix matched ${hits.length} rows: ${JSON.stringify(f)}`);
  hits[0].place = PLACE_ID[f.place];
  hits[0].fix = fixId(f.reason);
}

// 1b. Winners missing from the source, added from a cited report
for (const a of corrections.addTerms ?? []) {
  terms.push({
    name: { last: a.last, first: a.first, middle: a.middle ?? '', suffix: a.suffix ?? '', title: '' },
    year: a.year,
    position: a.position,
    srcPlace: '',
    place: a.place,
    party: a.party ?? '',
    ballot: a.ballot,
    sex: null,
    fix: fixId(`${a.reason} Source: ${a.source}`),
  });
}

// 1c. Rows assigned to a person by hand: the source gives two people the same name
for (const a of corrections.assign ?? []) {
  for (const spec of a.terms) {
    const hits = terms.filter(
      (t) => t.year === spec.year && t.position === spec.position && norm(t.name.last) === norm(a.last) && (!a.first || givenSeq(t.name)[0] === a.first),
    );
    if (hits.length !== 1) throw new Error(`assign matched ${hits.length} rows: ${a.id} ${JSON.stringify(spec)}`);
    hits[0].assign = a;
  }
}

// samePerson corrections: ballot names that belong to one person (nicknames).
const merge = new Map(); // key → canonical key
for (const s of corrections.samePerson) for (const k of s.keys) merge.set(k, s.keys[0]);
const personKey = (n) => merge.get(keyOf(n)) ?? keyOf(n);

// 2. Merged or blank slates: place each winner by where they held office in other years,
//    under any of their ballot names.
const homeOf = new Map(); // person key → Set of place ids from unambiguous rows
const isAmbiguous = (t) =>
  !PROVINCIAL.has(t.position) &&
  !t.fix &&
  corrections.mergedSlates.some((s) => s.years.includes(t.year) && s.filedUnder === t.srcPlace);
for (const t of terms) {
  if (PROVINCIAL.has(t.position) || isAmbiguous(t) || !t.place) continue;
  const k = personKey(t.name);
  if (!homeOf.has(k)) homeOf.set(k, new Set());
  homeOf.get(k).add(t.place);
}
for (const t of terms) {
  if (!isAmbiguous(t)) continue;
  const slate = corrections.mergedSlates.find((s) => s.years.includes(t.year) && s.filedUnder === t.srcPlace);
  const allowed = slate.candidates === '*' ? PLACES.map((p) => p[1]) : slate.candidates.map((c) => PLACE_ID[c]);
  const homes = [...(homeOf.get(personKey(t.name)) ?? [])].filter((p) => allowed.includes(p));
  t.fix = fixId(slate.reason);
  if (homes.length === 1) t.place = homes[0];
  else {
    t.place = null;
    t.placeCandidates = allowed.length <= 3 ? allowed : undefined;
  }
}

// ---------- People ----------

const groups = new Map();
for (const t of terms) {
  const k0 = keyOf(t.name);
  const k = t.assign ? `ASSIGN|${t.assign.id}` : merge.get(k0) ?? k0;
  const sfx = t.assign || merge.has(k0) ? '' : t.name.suffix;
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push({ t, sfx });
}

const people = [];
const usedIds = new Set();
const slug = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

for (const [k, items] of groups) {
  // Split by suffix: no-suffix rows join the only suffixed group, or stay apart if
  // there are several (e.g. "Jerry Canoy" when both Sr. and Jr. held office).
  const bySfx = new Map();
  for (const it of items) {
    if (!bySfx.has(it.sfx)) bySfx.set(it.sfx, []);
    bySfx.get(it.sfx).push(it.t);
  }
  const suffixed = [...bySfx.keys()].filter(Boolean);
  if (bySfx.has('') && suffixed.length === 1) {
    bySfx.get(suffixed[0]).push(...bySfx.get(''));
    bySfx.delete('');
  }
  const assigned = items[0].t.assign;
  const override = assigned ? { name: assigned.name, reason: assigned.reason } : corrections.samePerson.find((s) => s.keys.includes(k));
  for (const [sfx, ts] of bySfx) {
    // Split again by incompatible given names (two different people, same surname and
    // first name). Longest names first; a short name that fits several people stays apart.
    const clusters = [];
    const sorted = ts.sort((a, b) => givenSeq(b.name).length - givenSeq(a.name).length);
    for (const t of sorted) {
      const seq = givenSeq(t.name);
      const same = clusters.filter((c) => c.seq.join(' ') === seq.join(' '));
      const strict = clusters.filter((c) => seqCompatible(c.seq, seq));
      // Looser match for the source's two common slips, only within one place and
      // never for someone already holding another seat that year.
      const loose = clusters.filter(
        (c) => looseCompatible(c.seq, seq) && t.place && c.terms.some((x) => x.place === t.place) && !c.terms.some((x) => x.year === t.year),
      );
      const fits = override ? clusters.slice(0, 1) : same.length ? same.slice(0, 1) : strict.length ? strict : loose;
      if (fits.length === 1) fits[0].terms.push(t);
      else clusters.push({ seq, terms: [t] });
    }
    for (const c of clusters) {
      const best = c.terms.reduce((a, b) => (givenSeq(b.name).length > givenSeq(a.name).length ? b : a)).name;
      const name = override?.name ?? displayName({ ...best, suffix: sfx });
      const given = best.first.split(' ')[0] === 'MA.' ? best.first : best.first.split(' ')[0];
      let id = assigned?.id ?? override?.id ?? slug(`${best.last} ${given}${sfx ? ' ' + sfx : ''}`);
      for (let n = 2; usedIds.has(id); n++) id = slug(`${best.last} ${given} ${sfx} ${n}`);
      usedIds.add(id);
      const ballots = [...new Set(c.terms.map((t) => t.ballot))].sort();
      people.push({
        id,
        name,
        last: titleCase(`X ${best.last}`).slice(2),
        sex: c.terms.find((t) => t.sex)?.sex ?? null,
        ballots,
        ...(override ? { mergeNote: override.reason } : {}),
        ...(override?.sources ? { mergeSources: override.sources } : {}),
      });
      for (const t of c.terms) t.person = id;
    }
  }
}

// ---------- Gaps: races with no winner in the source ----------

const YEARS = [...new Set(terms.map((t) => t.year))].sort();
const gaps = [];
for (const [, id, name] of PLACES) {
  for (const y of YEARS) {
    for (const pos of ['mayor', 'vice-mayor']) {
      if (!terms.some((t) => t.place === id && t.year === y && t.position === pos)) {
        gaps.push({ year: y, place: id, position: pos });
      }
    }
  }
}

// ---------- Write ----------

const POS_ORDER = Object.values(POSITIONS);
terms.sort((a, b) => a.year - b.year || POS_ORDER.indexOf(a.position) - POS_ORDER.indexOf(b.position) || (a.place ?? '').localeCompare(b.place ?? '') || a.person.localeCompare(b.person));
people.sort((a, b) => a.id.localeCompare(b.id));

const out = {
  generatedAt: new Date().toISOString(),
  source: {
    name: 'OpenHalalan: The Philippine National and Local Election Dataset',
    citation: 'Leung, R., Alejandro, A., Acuna, R., Buot, J., Go, C., & Nable, J. (2026). OpenHalalan: The Philippine National and Local Election Dataset [Data set]. Zenodo.',
    url: 'https://robertrleung.github.io/OpenHalalan/',
    doi: 'https://doi.org/10.5281/zenodo.17783099',
    file: CSV_URL,
    license: 'ODbL-1.0',
    licenseUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
  },
  license: 'This derived database is made available under the Open Database License (ODbL 1.0).',
  years: YEARS,
  places: PLACES.map(([, id, name, type, district]) => ({ id, name, type, district })),
  positions: POS_ORDER,
  fixes,
  gaps,
  people,
  terms: terms.map((t) => ({
    person: t.person,
    year: t.year,
    position: t.position,
    place: t.place,
    ...(t.placeCandidates ? { placeCandidates: t.placeCandidates } : {}),
    party: t.party || null,
    ballot: t.ballot,
    ...(t.fix ? { fix: t.fix } : {}),
  })),
};

// One record per line keeps diffs readable.
const lines = (arr) => '[\n' + arr.map((x) => '    ' + JSON.stringify(x)).join(',\n') + '\n  ]';
const body = Object.entries(out)
  .map(([k, v]) => `  ${JSON.stringify(k)}: ${Array.isArray(v) && typeof v[0] === 'object' ? lines(v) : JSON.stringify(v)}`)
  .join(',\n');
await writeFile(OUT, `{\n${body}\n}\n`);

// Keep the Bukidnon source rows verbatim for fact-checking. The download link
// always points at the latest release, so the checksum pins the exact file used.
const cols = Object.keys(raw[0]);
const src = await recordSource('openhalalan', {
  title: 'OpenHalalan: The Philippine National and Local Election Dataset (winners file)',
  publisher: 'Leung, R. et al. (2026), Zenodo, https://doi.org/10.5281/zenodo.17783099',
  page: 'https://robertrleung.github.io/OpenHalalan/',
  url: CSV_URL,
  license: 'ODbL-1.0',
  usedFor: 'data/officials.json (with the fixes in data/corrections.json)',
  file: CACHE,
  extract: { name: 'openhalalan-winners-bukidnon.csv', rows: [cols, ...raw.map((r) => cols.map((c) => r[c]))] },
});
console.log(`Source recorded: ${src.extract.rows} Bukidnon rows, retrieved ${src.retrieved}, sha256 ${src.sha256.slice(0, 12)}…`);

const unplaced = out.terms.filter((t) => !t.place && !PROVINCIAL.has(t.position));
console.log(`data/officials.json: ${out.people.length} people, ${out.terms.length} terms, ${YEARS[0]}–${YEARS.at(-1)}`);
console.log(`  ${fixes.length} correction rules applied, ${unplaced.length} terms with no confirmed place, ${gaps.length} mayor/vice-mayor races missing`);
for (const g of gaps) console.log(`  missing: ${g.year} ${g.place} ${g.position}`);
