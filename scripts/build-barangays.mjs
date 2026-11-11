#!/usr/bin/env node
// Builds data/barangays.json: the current elected barangay and SK officials of
// every barangay in Bukidnon (punong barangay, kagawads, SK chairperson, SK
// members), with each one's term in the present position.
//
//   DILG masterlist (xlsx) ──▶ Bukidnon rows, elected posts, no phone numbers ──▶ data/barangays.json
//
// Source: DILG Barangay Officials Directory, "Masterlist of Officials" for
// Region X, https://www.dilg.gov.ph/barangay-officials-directory/index (data
// from the DILG Barangay Information System). Works of the Philippine
// government are not subject to copyright (RA 8293, sec. 176).
//
// This is a snapshot of who DILG lists today. It has no start or end dates, so it
// stays separate from the election history in officials.json. It is never a
// source for a family tie. Phone numbers, middle names (beyond an initial) and
// appointed posts (secretaries, treasurers) are discarded on purpose.
//
//   npm run data:brgy            build from the cached download (fetch if missing)
//   npm run data:brgy:refresh    download the masterlist again
//
// No dependencies: the xlsx is a zip, read with node:zlib.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { inflateRawSync } from 'node:zlib';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { recordSource } from './sources.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REGION = '10';
const PROVINCE = 'BUKIDNON';
const MASTERLIST = `https://bis.dilg.gov.ph/bops/default/master?psgc=${REGION}`;
const SOURCE_PAGE = 'https://www.dilg.gov.ph/barangay-officials-directory/index';
const CACHE = resolve(root, `.cache/dilg/official-list-${REGION}.xlsx`);
const OUT = resolve(root, 'data/barangays.json');
const REFRESH = process.argv.includes('--refresh');

// DILG city/municipality name → place id in officials.json.
const PLACE_OF = {
  BAUNGON: 'baungon', CABANGLASAN: 'cabanglasan', 'CITY OF VALENCIA': 'valencia', DAMULOG: 'damulog',
  DANGCAGAN: 'dangcagan', 'DON CARLOS': 'don-carlos', 'IMPASUG-ONG': 'impasug-ong', KADINGILAN: 'kadingilan',
  KALILANGAN: 'kalilangan', KIBAWE: 'kibawe', KITAOTAO: 'kitaotao', LANTAPAN: 'lantapan', LIBONA: 'libona',
  'CITY OF MALAYBALAY': 'malaybalay', 'CITY OF MALAYBALAY (CAPITAL)': 'malaybalay', MALITBOG: 'malitbog',
  'MANOLO FORTICH': 'manolo-fortich', MARAMAG: 'maramag', PANGANTUCAN: 'pangantucan', QUEZON: 'quezon',
  'SAN FERNANDO': 'san-fernando', SUMILAO: 'sumilao', TALAKAG: 'talakag',
};

// Elected posts only.
const ROLE_OF = {
  'PUNONG BARANGAY': 'captain',
  'SANGGUNIANG BARANGAY MEMBER': 'kagawad',
  'SK CHAIRPERSON': 'sk-chair',
  'SK MEMBER': 'sk-member',
};
const ROLE_ORDER = ['captain', 'kagawad', 'sk-chair', 'sk-member'];

// ---------- download ----------

async function masterlist() {
  if (!REFRESH) {
    try { return await readFile(CACHE); } catch {}
  }
  console.log(`Downloading ${MASTERLIST}`);
  const res = await fetch(MASTERLIST);
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.readUInt32LE(0) !== 0x04034b50) throw new Error('The download is not an xlsx file. Has the DILG link changed?');
  await mkdir(dirname(CACHE), { recursive: true });
  await writeFile(CACHE, buf);
  return buf;
}

// ---------- minimal xlsx reader ----------

function unzip(buf, name) {
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error('Not a zip file');
  let p = buf.readUInt32LE(eocd + 16);
  const count = buf.readUInt16LE(eocd + 10);
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const entry = buf.toString('utf8', p + 46, p + 46 + nameLen);
    if (entry === name) {
      const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
      const data = buf.subarray(start, start + size);
      return (method === 8 ? inflateRawSync(data) : data).toString('utf8');
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

const unxml = (s) =>
  s.replace(/&(lt|gt|amp|quot|apos|#\d+|#x[0-9a-f]+);/gi, (m, e) =>
    ({ lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" })[e.toLowerCase()] ??
    String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)));

function sheetRows(buf) {
  const shared = [];
  const sst = unzip(buf, 'xl/sharedStrings.xml') ?? '';
  for (const m of sst.matchAll(/<si>([\s\S]*?)<\/si>/g)) shared.push(unxml([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join('')));
  const xml = unzip(buf, 'xl/worksheets/sheet1.xml');
  if (!xml) throw new Error('No first sheet in the masterlist');
  const col = (ref) => [...ref.replace(/\d+/g, '')].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
  const rows = [];
  for (const r of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const row = [];
    for (const c of r[1].matchAll(/<c r="([A-Z]+\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const [, ref, attrs, inner = ''] = c;
      const type = /t="(\w+)"/.exec(attrs)?.[1];
      let v = '';
      if (type === 'inlineStr') v = unxml([...inner.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join(''));
      else {
        const raw = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1] ?? '';
        v = type === 's' ? shared[Number(raw)] ?? '' : unxml(raw);
      }
      row[col(ref)] = v;
    }
    rows.push(row);
  }
  return rows;
}

// ---------- cleaning ----------

// Typing slips seen in the DILG data: "MA/ ESTELA" for "Ma.", and a zero for an O inside a word.
const fixText = (s) => String(s ?? '')
  .replace(/\bMA\/\s*/gi, 'Ma. ')
  .replace(/(\p{L})0(?=\p{L}|\b)/gu, '$1o')
  .replace(/\s+/g, ' ').trim().normalize('NFC');

const SMALL = new Set(['de', 'del', 'dela', 'la', 'los', 'y', 'van', 'von']);
function titleCase(s) {
  return fixText(s).toLowerCase().split(' ').map((w, i) =>
    i > 0 && SMALL.has(w) ? w : w.replace(/(^|[-'.])(\p{L})/gu, (m, p, c) => p + c.toUpperCase()),
  ).join(' ');
}
// The suffix column also holds nicknames ("DODOY"); keep real suffixes only.
function suffix(s) {
  const w = fixText(s).replace(/[.,\s]+$/, '').replace('.', '').toLowerCase();
  if (w === 'jr' || w === 'sr') return `${w[0].toUpperCase()}${w[1]}.`;
  return /^(ii|iii|iv|v)$/.test(w) ? w.toUpperCase() : '';
}
function personName(first, middle, last, sfx) {
  // Some suffixes were typed into the first-name column: "LINO, II", "RICO, JR".
  const m = /^(.*?),\s*(jr|sr|ii|iii|iv)\.?$/i.exec(fixText(first));
  if (m) [first, sfx] = [m[1], sfx || m[2]];
  first = String(first).replace(/;/g, '');
  last = String(last).replace(/;/g, '');
  const mid = fixText(middle);
  // Middle initial only, as DILG's own directory shows it.
  const mi = mid && !/^(n\/?a|none|-|\.)$/i.test(mid) ? `${mid[0].toUpperCase()}. ` : '';
  const sx = suffix(sfx);
  return `${titleCase(first)} ${mi}${titleCase(last)}${sx ? ' ' + sx : ''}`.replace(/\s+/g, ' ').trim();
}
const termOf = (s) => ({ '1ST': 1, '2ND': 2, '3RD': 3 })[fixText(s).toUpperCase()] ?? null;
const slug = (s) => fixText(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ---------- build ----------

const rows = sheetRows(await masterlist());
const head = rows[0].map((h) => fixText(h).toUpperCase());
const at = (name) => {
  const i = head.indexOf(name);
  if (i < 0) throw new Error(`Masterlist column "${name}" is missing. Has the DILG format changed? Columns: ${head.join(', ')}`);
  return i;
};
const C = {
  term: at('TERM'), province: at('PROVINCE'), town: at('CITY/MUNICIPALITY'), brgy: at('BARANGAY'), position: at('POSITION'),
  inPost: at('TERM IN PRESENT POSITION'), last: at('LASTNAME'), first: at('FIRSTNAME'), middle: at('MIDDLENAME'), suffix: at('SUFFIX'),
};

const mine = rows.slice(1).filter((r) => fixText(r[C.province]).toUpperCase() === PROVINCE);
if (!mine.length) throw new Error(`No ${PROVINCE} rows in the masterlist`);
const unknown = [...new Set(mine.map((r) => fixText(r[C.town]).toUpperCase()))].filter((t) => !PLACE_OF[t]);
if (unknown.length) throw new Error(`Unmapped DILG towns: ${unknown.join(', ')}`);

const brgys = new Map(); // place|barangay → { id, name, officials }
const skipped = {};
for (const r of mine) {
  const place = PLACE_OF[fixText(r[C.town]).toUpperCase()];
  const name = fixText(r[C.brgy]);
  const key = `${place}|${name.toLowerCase()}`;
  if (!brgys.has(key)) brgys.set(key, { place, b: { id: `${place}--${slug(name)}`, name, officials: [] } });
  const pos = fixText(r[C.position]);
  const role = ROLE_OF[pos.toUpperCase()];
  if (!role) { skipped[pos] = (skipped[pos] ?? 0) + 1; continue; }
  if (!fixText(r[C.last])) continue;
  const o = { role, name: personName(r[C.first], r[C.middle], r[C.last], r[C.suffix]), last: titleCase(r[C.last]) };
  const term = termOf(r[C.inPost]);
  if (term) o.term = term;
  brgys.get(key).b.officials.push(o);
}

const ids = new Set();
const places = {};
for (const { place, b } of brgys.values()) {
  if (ids.has(b.id)) throw new Error(`Two barangays share the id ${b.id}`);
  ids.add(b.id);
  b.officials.sort((x, y) => ROLE_ORDER.indexOf(x.role) - ROLE_ORDER.indexOf(y.role) || (x.role === 'captain' || x.role === 'sk-chair' ? 0 : x.last.localeCompare(y.last)));
  b.officials = b.officials.map(({ last, ...o }) => o);
  (places[place] ??= []).push(b);
}
for (const list of Object.values(places)) list.sort((a, b) => a.name.localeCompare(b.name));

const out = {
  pulledAt: new Date().toISOString().slice(0, 10),
  source: {
    publisher: 'Department of the Interior and Local Government (DILG)',
    name: 'Barangay Officials Directory, Masterlist of Officials (Barangay Information System)',
    url: SOURCE_PAGE,
    file: MASTERLIST,
    termLabel: fixText(mine[0][C.term]),
  },
  note: 'Current elected officials as DILG lists them on the pull date. "term" is the term in the present position. Not a source for family ties. Phone numbers are not kept.',
  roles: ROLE_ORDER,
  places,
};
await writeFile(OUT, JSON.stringify(out, null, 1) + '\n');

const all = Object.values(places).flat();
const count = (role) => all.reduce((n, b) => n + b.officials.filter((o) => o.role === role).length, 0);
console.log(`data/barangays.json: ${all.length} barangays, ` +
  ROLE_ORDER.map((r) => `${count(r)} ${r}`).join(', '));
console.log('Left out (appointed):', skipped);

// Keep the Bukidnon rows verbatim for fact-checking, minus the phone column.
const keep = head.map((h, i) => i).filter((i) => !/TEL|PHONE|CONTACT|MOBILE|EMAIL/.test(head[i]));
const src = await recordSource('dilg-bis-masterlist', {
  title: 'Barangay Officials Directory: Masterlist of Officials, Region X',
  publisher: 'Department of the Interior and Local Government (DILG), Barangay Information System',
  page: SOURCE_PAGE,
  url: MASTERLIST,
  usedFor: 'data/barangays.json',
  dropped: head.filter((h, i) => !keep.includes(i)),
  file: CACHE,
  extract: { name: 'dilg-bis-masterlist-bukidnon.csv', rows: [keep.map((i) => rows[0][i]), ...mine.map((r) => keep.map((i) => r[i] ?? ''))] },
});
console.log(`Source recorded: ${src.extract.rows} rows, retrieved ${src.retrieved}, sha256 ${src.sha256.slice(0, 12)}…`);
