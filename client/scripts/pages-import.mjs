#!/usr/bin/env node
// Drops an exported page into public/page-content: `npm run pages:import <zip or folder>`.
// The zip the writing tool exports holds one folder (<slug>/index.md, its
// pictures, style.css); a folder from a contributor is copied as it is. The
// page lands at public/page-content/<slug>/ and the listing is rebuilt, so
// the page is on the site at the next start or build. An existing page of
// the same slug is replaced (its old files kept until you commit, via git).
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import JSZip from 'jszip';

const target = process.argv[2];
if (!target) {
  console.error('usage: npm run pages:import <page.zip | folder> [-- --as <slug>]');
  process.exit(1);
}
const asIndex = process.argv.indexOf('--as');
const forcedSlug = asIndex > 0 ? process.argv[asIndex + 1] : null;
const root = resolve(new URL('../public/page-content/', import.meta.url).pathname);

const safe = slug => /^[\w\-/]+$/.test(slug) && !slug.includes('..');

async function fromZip(path) {
  const zip = await JSZip.loadAsync(readFileSync(path));
  const files = Object.entries(zip.files).filter(([p, e]) => !e.dir && !p.includes('__MACOSX') && !basename(p).startsWith('.') && basename(p) !== 'HOW-TO-ADD.txt');
  const main = files.find(([p]) => /(^|\/)index\.(md|html)$/i.test(p)) ?? files.find(([p]) => /\.(md|html)$/i.test(p));
  if (!main) throw new Error('no page file (index.md or index.html) in the zip');
  const folder = main[0].includes('/') ? main[0].slice(0, main[0].lastIndexOf('/')) : '';
  const slug = forcedSlug ?? (folder || basename(main[0]).replace(/\.(md|html)$/i, ''));
  if (!safe(slug)) throw new Error(`unsafe page address: ${slug}`);
  const dest = join(root, slug);
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  for (const [p, entry] of files) {
    if (folder && !p.startsWith(folder + '/')) continue;
    const rel = folder ? p.slice(folder.length + 1) : basename(p);
    const out = join(dest, folder ? rel : rel);
    mkdirSync(join(out, '..'), { recursive: true });
    writeFileSync(out, await entry.async('nodebuffer'));
  }
  return slug;
}

function fromFolder(path) {
  const slug = forcedSlug ?? basename(path);
  if (!safe(slug)) throw new Error(`unsafe page address: ${slug}`);
  if (!existsSync(join(path, 'index.md')) && !existsSync(join(path, 'index.html'))) throw new Error('the folder has no index.md or index.html');
  const dest = join(root, slug);
  rmSync(dest, { recursive: true, force: true });
  cpSync(path, dest, { recursive: true, filter: src => !basename(src).startsWith('.') && basename(src) !== 'HOW-TO-ADD.txt' });
  return slug;
}

const slug = statSync(target).isDirectory() ? fromFolder(resolve(target)) : await fromZip(resolve(target));
execFileSync(process.execPath, [new URL('./pages-index.mjs', import.meta.url).pathname], { stdio: 'inherit' });
console.log(`[pages] ${slug} → public/page-content/${slug}/ (on the site at /pages/${slug})`);
