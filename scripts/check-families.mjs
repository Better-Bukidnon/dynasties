#!/usr/bin/env node
// Checks data/families.json against data/officials.json: every member's person id
// exists, every tie joins two members of its family and cites at least one source URL.
// Run by `npm run build`; exits non-zero on any problem.

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const O = JSON.parse(await readFile(resolve(root, 'data/officials.json'), 'utf8'));
const F = JSON.parse(await readFile(resolve(root, 'data/families.json'), 'utf8'));
const people = new Set(O.people.map((p) => p.id));
const ROLES = new Set(['father', 'mother', 'son', 'daughter', 'child', 'parent', 'husband', 'wife', 'spouse', 'brother', 'sister', 'sibling', 'grandfather', 'grandmother', 'grandson', 'granddaughter', 'uncle', 'aunt', 'nephew', 'niece', 'cousin', 'father-in-law', 'mother-in-law', 'son-in-law', 'daughter-in-law', 'brother-in-law', 'sister-in-law', 'relative']);
const problems = [];
const ids = new Set();
for (const f of F.families) {
  if (ids.has(f.id)) problems.push(`${f.id}: duplicate family id`);
  ids.add(f.id);
  const keys = new Set();
  for (const m of f.members) {
    keys.add(m.key);
    if (m.person && !people.has(m.person)) problems.push(`${f.id}: member ${m.key} points to unknown person "${m.person}"`);
    if (!m.person && !m.name) problems.push(`${f.id}: member ${m.key} has no person and no name`);
    if (!m.person && !m.key.startsWith('x-')) problems.push(`${f.id}: member ${m.key} has no person; use an x- key`);
  }
  for (const t of f.ties) {
    const where = `${f.id}: ${t.a} — ${t.b}`;
    if (!keys.has(t.a) || !keys.has(t.b)) problems.push(`${where}: tie member not in family`);
    if (!ROLES.has(t.aIs) || !ROLES.has(t.bIs)) problems.push(`${where}: unknown role ${t.aIs}/${t.bIs}`);
    if (!t.sources?.length || t.sources.some((s) => !/^https:\/\//.test(s.url ?? ''))) problems.push(`${where}: every tie needs a source with an https URL`);
  }
  for (const k of keys) if (!f.ties.some((t) => t.a === k || t.b === k)) problems.push(`${f.id}: member ${k} has no tie`);
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`families.json OK: ${F.families.length} families, ${F.families.reduce((n, f) => n + f.ties.length, 0)} ties`);
