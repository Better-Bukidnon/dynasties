#!/usr/bin/env node
// Copies the public site into dist/ for Cloudflare Workers static assets.
// Only what's listed here is deployed; scripts, docs and .cache never are.
// Runs scripts/check-families.mjs first, so a broken families.json never ships.

import { cp, rm, mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const PUBLIC = ['index.html', 'assets', 'data/officials.json', 'data/families.json'];

execFileSync(process.execPath, [resolve(root, 'scripts/check-families.mjs')], { stdio: 'inherit' });

await rm(dist, { recursive: true, force: true });
await mkdir(resolve(dist, 'data'), { recursive: true });
for (const entry of PUBLIC) await cp(resolve(root, entry), resolve(dist, entry), { recursive: true });

// Cache-bust local CSS/JS/images so a deploy never pairs new HTML with old assets.
const indexPath = resolve(dist, 'index.html');
const html = await readFile(indexPath, 'utf8');
const versioned = await replaceAsync(html, /(href|src)="(assets\/[^"?#]+)"/g, async (m, attr, path) => {
  const hash = createHash('sha256').update(await readFile(resolve(root, path))).digest('hex').slice(0, 10);
  return `${attr}="${path}?v=${hash}"`;
});
await writeFile(indexPath, versioned);

async function replaceAsync(str, re, fn) {
  const parts = await Promise.all([...str.matchAll(re)].map((m) => fn(...m)));
  let i = 0;
  return str.replace(re, () => parts[i++]);
}

await writeFile(
  resolve(dist, '_headers'),
  `/data/*
  Cache-Control: public, max-age=0, must-revalidate
  Access-Control-Allow-Origin: *
/assets/*
  Cache-Control: public, max-age=3600
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
`,
);

const O = JSON.parse(await readFile(resolve(dist, 'data/officials.json'), 'utf8'));
console.log(`dist/ ready: ${O.people.length} officials, ${O.terms.length} terms, built ${O.generatedAt}`);
