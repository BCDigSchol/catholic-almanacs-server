#!/usr/bin/env node
// Writes public/page-content/pages.json: every content page under
// public/page-content, from its file name and front matter, newest first.
// Run by `npm start` and `npm run build` (and by hand: `npm run pages:index`),
// so the pages listing and the nav never need keeping by hand.
//
// A page is a .md or .html file (served at /pages/<path without extension>)
// or a folder with index.md / index.html (served at /pages/<folder>). Front
// matter keys read: title, description, date, authors ("Name (Affiliation);
// Name"), draft (true keeps it off the listing and nav), kind (essay, …),
// menu ("The Almanacs > The data": where the page goes in the top nav, groups
// created as needed; without it the page is only in the pages listing),
// editors (true: listed and reachable only for signed-in editors).
// README.md and site files are skipped.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const root = new URL('../public/page-content/', import.meta.url).pathname;
const SKIP = new Set(['README.md', 'pages.json', 'site-nav.json']);

function frontMatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  const meta = {};
  if (!m) return { meta, body: text };
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { meta, body: text.slice(m[0].length) };
}

const firstHeading = body => {
  const md = body.match(/^#\s+(.+)$/m);
  if (md) return md[1].trim();
  const html = body.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return html ? html[1].replace(/<[^>]+>/g, '').trim() : null;
};

const pages = [];
function walk(dir) {
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) { walk(path); continue; }
    if (SKIP.has(name) || name.startsWith('.')) continue;
    const ext = name.endsWith('.md') ? '.md' : name.endsWith('.html') ? '.html' : null;
    if (!ext) continue;
    const rel = relative(root, path).split(sep).join('/');
    let slug = rel.slice(0, -ext.length);
    if (slug.endsWith('/index')) slug = slug.slice(0, -'/index'.length);
    if (slug === 'index') continue;                  // the listing page itself
    if (pages.some(p => p.slug === slug)) continue;  // .md wins over .html of the same name
    const { meta, body } = frontMatter(readFileSync(path, 'utf8'));
    pages.push({
      slug,
      title: meta.title || firstHeading(body) || slug,
      ...(meta.description ? { description: meta.description } : {}),
      ...(meta.date ? { date: meta.date } : {}),
      ...(meta.authors ? { authors: meta.authors.split(';').map(s => s.trim()).filter(Boolean) } : {}),
      ...(meta.kind ? { kind: meta.kind } : {}),
      ...(meta.menu ? { menu: meta.menu.split('>').map(s => s.trim()).filter(Boolean) } : {}),
      ...(/^(true|yes)$/i.test(meta.draft || '') ? { draft: true } : {}),
      ...(/^(true|yes)$/i.test(meta.editors || '') ? { editors: true } : {}),
    });
  }
}
walk(root);
pages.sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.title.localeCompare(b.title));
writeFileSync(join(root, 'pages.json'), JSON.stringify(pages, null, 2) + '\n');
console.log(`[pages] ${pages.length} pages (${pages.filter(p => p.draft).length} drafts) → page-content/pages.json`);
