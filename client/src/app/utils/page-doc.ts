// The writing tool's document: the TipTap nodes a page may hold beyond plain
// prose (figures, layouts, record cards, embedded views, footnotes), the
// Markdown the editor writes out (what the exported page file holds, and
// what the preview renders), and the way a Markdown page is read back in.
import { Extension, JSONContent, mergeAttributes, Node } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import { TableKit } from '@tiptap/extension-table';
import { Marked } from 'marked';

/** The named layouts a block of content may be wrapped in (see page-view styles). */
export const LAYOUT_KINDS = ['pull', 'note', 'columns', 'beside', 'beside right'] as const;
export type LayoutKind = typeof LAYOUT_KINDS[number];

export const LAYOUT_LABELS: Record<LayoutKind, string> = {
  'pull': 'Pull quote',
  'note': 'Note',
  'columns': 'Two columns',
  'beside': 'Picture beside text',
  'beside right': 'Picture beside text, on the right',
};

/**
 * Where the editor finds a page's own images: the writing tool points it at
 * the pictures the author added (object URLs), since the page's folder does
 * not exist yet.
 */
export const assetResolver = { resolve: (src: string): string => src };

/** A picture with a caption; `layout` lets it run wider than the text. */
export const Figure = Image.extend({
  name: 'figure',
  draggable: true,
  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('figure');
      const img = document.createElement('img');
      const caption = document.createElement('figcaption');
      dom.append(img, caption);
      const render = (n: typeof node) => {
        dom.className = n.attrs['layout'] || '';
        img.src = assetResolver.resolve(n.attrs['src'] || '');
        img.alt = n.attrs['alt'] || '';
        caption.textContent = n.attrs['caption'] || '';
        caption.hidden = !n.attrs['caption'];
      };
      render(node);
      return { dom, update: (n: typeof node) => { if (n.type !== node.type) return false; render(n); return true; } };
    };
  },
  addAttributes() {
    return {
      ...this.parent?.(),
      caption: { default: '' },
      layout: { default: '' },
    };
  },
  parseHTML() {
    return [
      {
        tag: 'figure',
        getAttrs: (el: HTMLElement) => {
          const img = el.querySelector('img');
          if (!img) return false;
          return {
            src: img.getAttribute('src'), alt: img.getAttribute('alt') || '',
            caption: el.querySelector('figcaption')?.textContent?.trim() || '',
            layout: el.classList.contains('full') ? 'full' : el.classList.contains('wide') ? 'wide' : '',
          };
        },
      },
      { tag: 'img[src]' },
    ];
  },
  renderHTML({ node }) {
    const { src, alt, caption, layout } = node.attrs;
    const figure: any[] = ['figure', mergeAttributes({ class: layout || null }), ['img', { src, alt: alt || '' }]];
    if (caption) figure.push(['figcaption', {}, caption]);
    return figure as any;
  },
});

/** A wrapper block carrying one of the named layouts. */
export const Layout = Node.create({
  name: 'layout',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return { kind: { default: 'note' } };
  },
  parseHTML() {
    return [{
      tag: 'div',
      getAttrs: (el: HTMLElement) => {
        const kind = LAYOUT_KINDS.find(k => k.split(' ').every(c => el.classList.contains(c)));
        return kind ? { kind } : false;
      },
    }];
  },
  renderHTML({ node }) {
    return ['div', { class: `layout ${node.attrs['kind']}`, 'data-layout': node.attrs['kind'] }, 0];
  },
});

/** `<almanac-record>`: a live card for an institution or person. */
export const AlmanacRecord = Node.create({
  name: 'almanacRecord',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return { record: { default: '' }, year: { default: '' } };
  },
  parseHTML() {
    return [{ tag: 'almanac-record' }];
  },
  renderHTML({ node }) {
    return ['almanac-record', { record: node.attrs['record'], year: node.attrs['year'] || null }];
  },
  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('div');
      dom.className = 'doc-widget';
      dom.contentEditable = 'false';
      const el = document.createElement('almanac-record');
      el.setAttribute('record', node.attrs['record']);
      if (node.attrs['year']) el.setAttribute('year', String(node.attrs['year']));
      dom.appendChild(el);
      return { dom };
    };
  },
});

/** `<almanac-embed>`: a dashboard, map or record page in a given state. */
export const AlmanacEmbed = Node.create({
  name: 'almanacEmbed',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return { src: { default: '' }, height: { default: '560' }, caption: { default: '' }, lazy: { default: false } };
  },
  parseHTML() {
    return [{
      tag: 'almanac-embed',
      getAttrs: (el: HTMLElement) => ({
        src: el.getAttribute('src') || '', height: el.getAttribute('height') || '560',
        caption: el.getAttribute('caption') || '', lazy: el.hasAttribute('lazy'),
      }),
    }];
  },
  renderHTML({ node }) {
    return ['almanac-embed', { src: node.attrs['src'], height: node.attrs['height'], caption: node.attrs['caption'], lazy: node.attrs['lazy'] ? '' : null }];
  },
  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('div');
      dom.className = 'doc-widget doc-embed';
      dom.contentEditable = 'false';
      dom.style.height = `${Math.min(Number(node.attrs['height']) || 560, 320)}px`;
      dom.innerHTML = `<span class="doc-embed-label">Embedded view</span><code>${escapeHtml(node.attrs['src'])}</code>` +
        (node.attrs['caption'] ? `<span class="doc-embed-caption">${escapeHtml(node.attrs['caption'])}</span>` : '') +
        `<span class="doc-embed-hint">Shown live in the preview</span>`;
      return { dom };
    };
  },
});

/** A footnote mark in the text; its text travels with it and is numbered on export. */
export const Footnote = Node.create({
  name: 'footnote',
  group: 'inline',
  inline: true,
  atom: true,
  addAttributes() {
    return {
      text: {
        default: '',
        parseHTML: (el: HTMLElement) => el.getAttribute('data-text') || '',
        renderHTML: attrs => ({ 'data-text': attrs['text'] }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'sup.footnote-ref' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['sup', mergeAttributes(HTMLAttributes, { class: 'footnote-ref', title: HTMLAttributes['data-text'] })];
  },
});

/** Everything the editor loads. */
export function pageExtensions(placeholder: string): Extension[] {
  return [
    StarterKit.configure({ heading: { levels: [2, 3, 4] }, link: { openOnClick: false, autolink: true } }),
    Figure, Layout, AlmanacRecord, AlmanacEmbed, Footnote,
    TableKit.configure({ table: { resizable: false } }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Placeholder.configure({ placeholder }),
  ] as unknown as Extension[];
}

// ---------------------------------------------------------------- Markdown out

function escapeHtml(text: string): string {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeText(text: string): string {
  return text.replace(/([\\`*_[\]<>])/g, '\\$1').replace(/^(\s*)([#+\-]|\d+\.)(\s)/, '$1\\$2$3');
}

function attr(value: unknown): string {
  return escapeHtml(String(value ?? ''));
}

/** Turns the editor's document into the Markdown the page file holds. */
export function docToMarkdown(doc: JSONContent): string {
  const notes: string[] = [];

  const inline = (nodes: JSONContent[] = []): string => nodes.map(n => {
    if (n.type === 'text') {
      let text = escapeText(n.text || '');
      for (const mark of n.marks || []) {
        switch (mark.type) {
          case 'bold': text = `**${text}**`; break;
          case 'italic': text = `*${text}*`; break;
          case 'underline': text = `<u>${text}</u>`; break;
          case 'strike': text = `~~${text}~~`; break;
          case 'code': text = `\`${(n.text || '').replace(/`/g, '``')}\``; break;
          case 'link': text = `[${text}](${mark.attrs?.['href'] || ''})`; break;
        }
      }
      return text;
    }
    if (n.type === 'hardBreak') return '  \n';
    if (n.type === 'footnote') {
      notes.push(n.attrs?.['text'] || '');
      return `[^${notes.length}]`;
    }
    return '';
  }).join('');

  const indent = (text: string, prefix: string, rest = prefix) =>
    text.split('\n').map((line, i) => (i ? rest : prefix) + line).join('\n');

  const blocks = (nodes: JSONContent[] = []): string => nodes.map(block).filter(Boolean).join('\n\n');

  // a centred or right-aligned block travels in a wrapper the site styles
  const aligned = (n: JSONContent, text: string) => {
    const align = n.attrs?.['textAlign'];
    return text && (align === 'center' || align === 'right') ? `<div class="align-${align}">\n\n${text}\n\n</div>` : text;
  };

  const block = (n: JSONContent): string => {
    switch (n.type) {
      case 'paragraph': return aligned(n, inline(n.content));
      case 'heading': return aligned(n, `${'#'.repeat(n.attrs?.['level'] || 2)} ${inline(n.content)}`);
      case 'blockquote': return indent(blocks(n.content), '> ');
      case 'codeBlock': return `\`\`\`${n.attrs?.['language'] || ''}\n${(n.content || []).map(t => t.text || '').join('')}\n\`\`\``;
      case 'horizontalRule': return '---';
      case 'bulletList': return (n.content || []).map(li => indent(blocks(li.content), '- ', '  ')).join('\n');
      case 'orderedList': return (n.content || []).map((li, i) => indent(blocks(li.content), `${i + 1}. `, '   ')).join('\n');
      case 'figure': {
        const { src, alt, caption, layout } = n.attrs || {};
        return `<figure${layout ? ` class="${attr(layout)}"` : ''}>\n<img src="${attr(src)}" alt="${attr(alt)}">\n` +
          (caption ? `<figcaption>${attr(caption)}</figcaption>\n` : '') + `</figure>`;
      }
      case 'layout': return `<div class="${attr(n.attrs?.['kind'])}">\n\n${blocks(n.content)}\n\n</div>`;
      case 'almanacRecord':
        return `<almanac-record record="${attr(n.attrs?.['record'])}"${n.attrs?.['year'] ? ` year="${attr(n.attrs['year'])}"` : ''}></almanac-record>`;
      case 'almanacEmbed':
        return `<almanac-embed src="${attr(n.attrs?.['src'])}" height="${attr(n.attrs?.['height'] || '560')}"` +
          (n.attrs?.['caption'] ? ` caption="${attr(n.attrs['caption'])}"` : '') + (n.attrs?.['lazy'] ? ' lazy' : '') + `></almanac-embed>`;
      case 'table': {
        const rows = (n.content || []).map(row => (row.content || []).map(cell =>
          blocks(cell.content).replace(/\n+/g, ' ').replace(/\|/g, '\\|')));
        if (!rows.length) return '';
        const width = Math.max(...rows.map(r => r.length));
        const line = (cells: string[]) => `| ${Array.from({ length: width }, (_, i) => cells[i] ?? '').join(' | ')} |`;
        return [line(rows[0]), `|${' --- |'.repeat(width)}`, ...rows.slice(1).map(line)].join('\n');
      }
      default: return n.content ? blocks(n.content) : '';
    }
  };

  const body = blocks(doc.content);
  const noteBlock = notes.map((text, i) => `[^${i + 1}]: ${text.replace(/\n/g, '\n    ')}`).join('\n');
  return noteBlock ? `${body}\n\n${noteBlock}\n` : `${body}\n`;
}

// ----------------------------------------------------------------- Markdown in

const plain = new Marked();

/**
 * Reads a page body (Markdown, or HTML) into the HTML the editor loads:
 * footnotes become inline marks carrying their text; everything else is the
 * HTML the site itself would show.
 */
export function bodyToEditorHtml(body: string, isMarkdown: boolean): string {
  if (!isMarkdown) return body;
  const notes = new Map<string, string>();
  // definitions: "[^id]: text", continued by indented lines
  const withoutDefs = body.replace(/^\[\^([^\]]+)\]:[ \t]*(.*(?:\n(?:[ \t]{2,}.*|))*)/gm, (_, id: string, text: string) => {
    notes.set(id, text.split('\n').map(l => l.replace(/^[ \t]{2,}/, '')).join('\n').trim());
    return '';
  });
  const withRefs = withoutDefs.replace(/\[\^([^\]]+)\]/g, (whole, id: string) =>
    notes.has(id) ? `<sup class="footnote-ref" data-text="${escapeHtml(notes.get(id)!)}"></sup>` : whole);
  return unwrapAlignment(plain.parse(withRefs, { async: false }) as string);
}

/** `<div class="align-center">` wrappers become the alignment of the blocks inside. */
function unwrapAlignment(html: string): string {
  if (!/align-(center|right)/.test(html)) return html;
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  for (const div of Array.from(doc.querySelectorAll('div.align-center, div.align-right'))) {
    const align = div.classList.contains('align-center') ? 'center' : 'right';
    for (const child of Array.from(div.children)) (child as HTMLElement).style.textAlign = align;
    div.replaceWith(...Array.from(div.childNodes));
  }
  return doc.body.innerHTML;
}
