// Turns a content page file (Markdown or HTML, with front matter) into what the
// page shows. Shared by the page view and the writing tool's preview, so the
// two never disagree.
import { Marked } from 'marked';
import markedFootnote from 'marked-footnote';

export interface PageAuthor {
  name: string;
  affiliation?: string;
}

/** The front matter of a content page (every key optional). */
export interface PageMeta {
  title?: string;
  description?: string;
  /** "Name (Affiliation); Name" */
  authors: PageAuthor[];
  /** As written, e.g. "2026-03-01" or "March 2026". */
  date?: string;
  abstract?: string;
  /** Drafts render at their URL but stay out of the listing and nav. */
  draft: boolean;
  /** For signed-in editors only: unlisted for others, and the address sends them to sign in. */
  editors: boolean;
  /** essay, guide, … — how the listing groups it. */
  kind?: string;
  /** Labels of the nav groups the page sits under, outermost first. */
  menu: string[];
  /** A citation the author wrote out, used instead of the generated one. */
  cite?: string;
  /** Anything else the front matter carried. */
  extra: Record<string, string>;
}

export interface ParsedPage {
  meta: PageMeta;
  /** The body as HTML, before asset paths are resolved. */
  html: string;
  /** The raw front-matter text, for editing. */
  frontMatter: string;
}

const md = new Marked(markedFootnote({ description: 'Notes', footnoteDivider: false }));

/** Splits an optional leading block of "key: value" lines between --- fences. */
export function splitFrontMatter(raw: string): { fields: Record<string, string>; body: string; frontMatter: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { fields: {}, body: raw, frontMatter: '' };
  const fields: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(':');
    if (separator > 0) fields[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  return { fields, body: raw.slice(match[0].length), frontMatter: match[1] };
}

/** "Jane Doe (Boston College); John Roe" → authors with affiliations. */
export function parseAuthors(text: string | undefined): PageAuthor[] {
  if (!text) return [];
  return text.split(';').map(s => s.trim()).filter(Boolean).map(s => {
    const m = s.match(/^(.*?)\s*\((.+)\)\s*$/);
    return m ? { name: m[1].trim(), affiliation: m[2].trim() } : { name: s };
  });
}

export function formatAuthors(authors: PageAuthor[]): string {
  return authors.map(a => a.affiliation ? `${a.name} (${a.affiliation})` : a.name).join('; ');
}

export function metaFromFields(fields: Record<string, string>): PageMeta {
  const { title, description, authors, date, abstract, draft, editors, kind, menu, cite, ...extra } = fields;
  return {
    title, description, date, abstract, kind, cite,
    authors: parseAuthors(authors),
    draft: /^(true|yes)$/i.test(draft ?? ''),
    editors: /^(true|yes)$/i.test(editors ?? ''),
    menu: (menu ?? '').split('>').map(s => s.trim()).filter(Boolean),
    extra,
  };
}

/** The front-matter block for a page's fields (only the ones set). */
export function writeFrontMatter(meta: PageMeta): string {
  const lines: string[] = [];
  const put = (key: string, value: string | undefined) => { if (value) lines.push(`${key}: ${value}`); };
  put('title', meta.title);
  put('description', meta.description);
  put('authors', formatAuthors(meta.authors));
  put('date', meta.date);
  put('kind', meta.kind);
  put('menu', meta.menu.join(' > '));
  put('abstract', meta.abstract);
  put('cite', meta.cite);
  if (meta.draft) lines.push('draft: true');
  if (meta.editors) lines.push('editors: true');
  for (const [k, v] of Object.entries(meta.extra)) put(k, v);
  return lines.length ? `---\n${lines.join('\n')}\n---\n\n` : '';
}

export function renderMarkdown(body: string): string {
  return md.parse(body, { async: false }) as string;
}

export function parsePage(raw: string, isMarkdown: boolean): ParsedPage {
  const { fields, body, frontMatter } = splitFrontMatter(raw);
  return { meta: metaFromFields(fields), html: isMarkdown ? renderMarkdown(body) : body, frontMatter };
}

const ABSOLUTE = /^([a-z][a-z0-9+.-]*:|\/|#|data:)/i;

/**
 * Points a page's relative image, link and media paths at its own folder
 * (`page-content/<dir>/`), so a page and its pictures travel together.
 * Absolute paths, full URLs and anchors are left alone; `lookup` may answer
 * a name with another address (the writing tool's in-memory pictures).
 */
export function resolveAssets(html: string, dir: string, lookup?: (name: string) => string | undefined): string {
  const base = dir ? `page-content/${dir}/` : 'page-content/';
  const fix = (value: string) => {
    if (ABSOLUTE.test(value)) return value;
    const name = value.replace(/^\.\//, '');
    return lookup?.(name) ?? base + name;
  };
  return html.replace(/(<(?:img|source|video|audio|a|track)\b[^>]*?\s(?:src|href|poster)=)(["'])([^"']*)\2/gi,
    (_, head: string, quote: string, value: string) => `${head}${quote}${fix(value)}${quote}`)
    .replace(/(<(?:img|source)\b[^>]*?\ssrcset=)(["'])([^"']*)\2/gi,
      (_, head: string, quote: string, value: string) =>
        `${head}${quote}${value.split(',').map(part => {
          const [url, ...rest] = part.trim().split(/\s+/);
          return [fix(url), ...rest].join(' ');
        }).join(', ')}${quote}`);
}

/** The first h1's text, when a page has no title in its front matter. */
export function firstHeading(html: string): string | null {
  const match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return match ? match[1].replace(/<[^>]+>/g, '').trim() : null;
}

/**
 * Prefixes every selector of a page's own stylesheet with the page's
 * container, so an author's CSS reaches their page and nothing else.
 * Handles nested @media/@supports blocks; @font-face and @keyframes pass through.
 */
export function scopeCss(css: string, scope: string): string {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const scopeSelectors = (selectors: string) => selectors.split(',').map(s => {
    const sel = s.trim();
    if (!sel) return '';
    if (/^(html|body|:root)\b/.test(sel)) return scope;
    return `${scope} ${sel}`;
  }).filter(Boolean).join(', ');
  const walk = (text: string): string => {
    let out = '';
    let i = 0;
    while (i < text.length) {
      const open = text.indexOf('{', i);
      if (open < 0) break;
      const head = text.slice(i, open).trim();
      // find the matching close brace
      let depth = 1, j = open + 1;
      while (j < text.length && depth > 0) { if (text[j] === '{') depth++; else if (text[j] === '}') depth--; j++; }
      const inner = text.slice(open + 1, j - 1);
      if (head.startsWith('@')) {
        const passThrough = /^@(font-face|keyframes|-webkit-keyframes|page|counter-style|property)/.test(head);
        out += `${head} {${passThrough ? inner : walk(inner)}}\n`;
      } else if (head) {
        out += `${scopeSelectors(head)} {${inner}}\n`;
      }
      i = j;
    }
    return out;
  };
  return walk(clean);
}

/** A citation of the page in the house style, unless the author wrote one. */
export function citation(meta: PageMeta, permalink: string): string {
  if (meta.cite) return meta.cite;
  const accessed = new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  const names = meta.authors.map(a => a.name);
  const who = names.length > 2 ? `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
    : names.join(' and ');
  const when = meta.date ? ` ${meta.date}.` : '';
  return `${who ? who + '. ' : ''}“${meta.title ?? 'Untitled'}.” Catholic Almanacs Database.${when} ${permalink} (accessed ${accessed}).`;
}
