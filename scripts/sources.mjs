// Keeps a record of every raw source the data is built from, so any figure on the
// site can be checked against the file it came from, even after the publisher
// updates or removes it.
//
//   data/sources/manifest.json   one entry per source: where it was downloaded,
//                                when, and the SHA-256 of the exact file used
//   data/sources/*.csv           the Bukidnon rows of each source, verbatim,
//                                minus any column that holds contact details
//
// Anyone holding the original download can confirm it with the checksum
// (sha256sum file, or Get-FileHash in PowerShell).

import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = resolve(root, 'data/sources');
const MANIFEST = resolve(DIR, 'manifest.json');

export const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

const cell = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const toCsv = (rows) => rows.map((r) => r.map(cell).join(',')).join('\n') + '\n';

// file: the cached original; extract: { name, rows (incl. header) }
export async function recordSource(id, { file, extract, ...entry }) {
  await mkdir(DIR, { recursive: true });
  const original = await readFile(file);
  const info = await stat(file);
  const record = {
    ...entry,
    retrieved: info.mtime.toISOString().slice(0, 10),
    sha256: original.length ? sha256(original) : null,
    bytes: original.length,
  };
  if (extract) {
    const csv = toCsv(extract.rows);
    await writeFile(resolve(DIR, extract.name), csv);
    record.extract = { file: `data/sources/${extract.name}`, rows: extract.rows.length - 1, sha256: sha256(Buffer.from(csv)) };
  }
  let manifest = { note: '', sources: {} };
  try {
    manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
  } catch {}
  manifest.note =
    'Every raw source the data is built from. "sha256" identifies the exact file downloaded on "retrieved"; ' +
    '"extract" is its Bukidnon rows kept verbatim in this folder (contact columns removed). Written by the build scripts; do not edit by hand.';
  manifest.sources[id] = record;
  await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  return record;
}
