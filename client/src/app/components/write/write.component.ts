import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, HostListener, NgZone, OnDestroy, ViewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Title } from '@angular/platform-browser';
import { MatIconModule } from '@angular/material/icon';
import { Editor, JSONContent } from '@tiptap/core';
import JSZip from 'jszip';
import { firstValueFrom, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { PageViewComponent } from '../pages/page-view/page-view.component';
import { RecordPickerComponent, RecordPick } from './record-picker/record-picker.component';
import { EmbedPickerComponent, EmbedPick } from './embed-picker/embed-picker.component';
import { NavService, PageEntry } from '../../services/nav.service';
import { assetResolver, bodyToEditorHtml, docToMarkdown, LAYOUT_KINDS, LAYOUT_LABELS, LayoutKind, pageExtensions } from '../../utils/page-doc';
import { firstHeading, metaFromFields, sameTitle, PageAuthor, PageMeta, parsePage, resolveAssets, splitFrontMatter, writeFrontMatter } from '../../utils/page-render';

const DRAFT_KEY = 'almanacs.writeDraft';
const IMAGE = /\.(png|jpe?g|gif|svg|webp|avif)$/i;

interface Draft {
  meta: PageMeta;
  slug: string;
  css: string;
  html: string;
  savedAt: string;
}

/** What the inspector shows for the thing selected in the editor. */
interface Selected {
  type: 'figure' | 'almanacRecord' | 'almanacEmbed' | 'footnote' | 'layout';
  attrs: Record<string, any>;
}

function emptyMeta(): PageMeta {
  return { authors: [], draft: false, editors: false, menu: [], extra: {} };
}

/**
 * The writing tool (/write, editors only): a WYSIWYG editor for content
 * pages with the live page beside it, pictures, record cards, embedded
 * views, footnotes and layouts, a details form for the front matter, and
 * an export of the finished page as a folder (zip) that drops straight
 * into page-content/. Existing pages open for revision the same way.
 */
@Component({
  selector: 'app-write',
  imports: [DatePipe, FormsModule, MatIconModule, PageViewComponent, RecordPickerComponent, EmbedPickerComponent],
  templateUrl: './write.component.html',
  styleUrl: './write.component.scss'
})
export class WriteComponent implements AfterViewInit, OnDestroy {
  @ViewChild('editorHost', { static: true }) editorHost!: ElementRef<HTMLDivElement>;
  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;
  @ViewChild('imageInput') imageInput?: ElementRef<HTMLInputElement>;

  editor!: Editor;
  meta: PageMeta = emptyMeta();
  slug = '';
  slugEdited = false;
  css = '';
  /** The pictures the author added, by the file name the page will use. */
  images = new Map<string, { blob: Blob; url: string }>();

  tab: 'preview' | 'details' | 'source' | 'help' = 'preview';
  panel: 'open' | 'record' | 'embed' | 'link' | 'footnote' | 'markdown' | null = null;
  selected: Selected | null = null;
  readonly layoutKinds = LAYOUT_KINDS;
  readonly layoutLabels = LAYOUT_LABELS;

  markdown = '';
  previewMeta: PageMeta | null = null;
  previewHtml = '';
  previewCss = '';
  pages: PageEntry[] = [];
  linkHref = '';
  footnoteText = '';
  markdownText = '';
  notice = '';
  draftSavedAt: Date | null = null;
  restored = false;
  private dirty = false;
  private renderTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private http: HttpClient, private nav: NavService, private title: Title, private zone: NgZone,
              private cd: ChangeDetectorRef) {
    this.title.setTitle('Write a page · Catholic Almanacs');
    this.nav.pages$.subscribe(pages => this.pages = pages);
    assetResolver.resolve = src => this.images.get(src)?.url ?? (this.slug && !/^([a-z]+:|\/)/i.test(src) ? `page-content/${this.slug}/${src}` : src);
  }

  ngAfterViewInit(): void {
    this.editor = new Editor({
      element: this.editorHost.nativeElement,
      extensions: pageExtensions('Start writing. Paste text, or open a page of the site to revise it.'),
      content: '',
      onUpdate: () => this.zone.run(() => this.changed()),
      onSelectionUpdate: () => this.zone.run(() => this.inspect()),
    });
    // after the first check, so restoring the draft is a change of its own
    setTimeout(() => {
      const draft = this.readDraft();
      if (draft) {
        this.meta = { ...emptyMeta(), ...draft.meta };
        this.slug = draft.slug;
        this.slugEdited = !!draft.slug;
        this.css = draft.css;
        this.editor.commands.setContent(draft.html);
        this.draftSavedAt = new Date(draft.savedAt);
        this.restored = true;
      }
      this.render();
    });
  }

  ngOnDestroy(): void {
    this.editor?.destroy();
    for (const img of this.images.values()) URL.revokeObjectURL(img.url);
    assetResolver.resolve = src => src;
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.dirty && this.images.size) event.preventDefault();
  }

  // ------------------------------------------------------------- the document

  /** After every edit: the Markdown, the preview, the draft. */
  changed(): void {
    this.dirty = true;
    if (this.renderTimer) clearTimeout(this.renderTimer);
    this.renderTimer = setTimeout(() => this.render(), 300);
  }

  render(): void {
    this.renderTimer = null;
    if (!this.slugEdited) this.slug = this.slugFrom(this.meta.title || '');
    this.markdown = docToMarkdown(this.editor.getJSON());
    const page = parsePage(this.markdown, true);
    this.previewMeta = { ...this.meta, title: this.meta.title || firstHeading(page.html) || 'Untitled' };
    this.previewHtml = resolveAssets(page.html, this.slug, name => this.images.get(name)?.url);
    this.previewCss = this.css;
    this.saveDraft();
    this.cd.markForCheck();
  }

  private slugFrom(title: string): string {
    const slug = title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return slug ? `essays/${slug}` : '';
  }

  get slugOk(): boolean {
    return /^[\w\-/]+$/.test(this.slug) && !this.slug.includes('..');
  }

  /** The front matter plus the Markdown: the page file itself. */
  get pageFile(): string {
    return writeFrontMatter(this.meta) + this.markdown;
  }

  // ---------------------------------------------------------------- the draft

  private saveDraft(): void {
    try {
      const draft: Draft = { meta: this.meta, slug: this.slug, css: this.css, html: this.editor.getHTML(), savedAt: new Date().toISOString() };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      this.draftSavedAt = new Date(draft.savedAt);
    } catch { /* storage refused: the export still works */ }
  }

  private readDraft(): Draft | null {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      return raw ? JSON.parse(raw) as Draft : null;
    } catch { return null; }
  }

  newPage(): void {
    if (this.dirty && !confirm('Start a new page? The page here is kept as your draft until you change it.')) return;
    this.meta = emptyMeta();
    this.slug = '';
    this.slugEdited = false;
    this.css = '';
    for (const img of this.images.values()) URL.revokeObjectURL(img.url);
    this.images.clear();
    this.editor.commands.clearContent();
    this.restored = false;
    this.notice = '';
    this.panel = null;
    this.render();
  }

  // ---------------------------------------------------------------- toolbar

  can(command: () => boolean): boolean {
    return command();
  }

  isActive(name: string | Record<string, any>, attrs?: Record<string, any>): boolean {
    if (!this.editor) return false;
    return typeof name === 'string' ? this.editor.isActive(name, attrs) : this.editor.isActive(name);
  }

  align(side: 'left' | 'center' | 'right'): void {
    const chain = this.editor.chain().focus();
    (side === 'left' ? chain.unsetTextAlign() : chain.setTextAlign(side)).run();
  }

  get blockType(): string {
    if (!this.editor) return 'paragraph';
    for (const level of [2, 3, 4]) if (this.editor.isActive('heading', { level })) return `h${level}`;
    return 'paragraph';
  }

  setBlock(type: string): void {
    const chain = this.editor.chain().focus();
    if (type === 'paragraph') chain.setParagraph().run();
    else chain.toggleHeading({ level: Number(type[1]) as 2 | 3 | 4 }).run();
  }

  toggle(mark: 'bold' | 'italic' | 'underline' | 'strike' | 'code'): void {
    const chain = this.editor.chain().focus();
    ({ bold: () => chain.toggleBold(), italic: () => chain.toggleItalic(), underline: () => chain.toggleUnderline(),
      strike: () => chain.toggleStrike(), code: () => chain.toggleCode() })[mark]().run();
  }

  list(kind: 'bullet' | 'ordered'): void {
    const chain = this.editor.chain().focus();
    (kind === 'bullet' ? chain.toggleBulletList() : chain.toggleOrderedList()).run();
  }

  quote(): void { this.editor.chain().focus().toggleBlockquote().run(); }
  rule(): void { this.editor.chain().focus().setHorizontalRule().run(); }
  table(): void { this.editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); }
  undo(): void { this.editor.chain().focus().undo().run(); }
  redo(): void { this.editor.chain().focus().redo().run(); }

  wrap(kind: LayoutKind): void {
    if (this.editor.isActive('layout')) this.editor.chain().focus().updateAttributes('layout', { kind }).run();
    else this.editor.chain().focus().wrapIn('layout', { kind }).run();
  }

  unwrap(): void {
    this.editor.chain().focus().lift('layout').run();
  }

  openPanel(panel: typeof this.panel): void {
    this.panel = this.panel === panel ? null : panel;
    if (panel === 'link') this.linkHref = this.editor.getAttributes('link')['href'] || '';
    if (panel === 'footnote') this.footnoteText = '';
  }

  setLink(): void {
    const href = this.linkHref.trim();
    const chain = this.editor.chain().focus();
    if (!href) chain.unsetLink().run();
    else if (this.editor.state.selection.empty) chain.insertContent({ type: 'text', text: href, marks: [{ type: 'link', attrs: { href } }] }).run();
    else chain.extendMarkRange('link').setLink({ href }).run();
    this.panel = null;
  }

  addFootnote(): void {
    const text = this.footnoteText.trim();
    if (!text) return;
    this.editor.chain().focus().insertContent({ type: 'footnote', attrs: { text } }).run();
    this.footnoteText = '';
    this.panel = null;
  }

  insertCard(pick: RecordPick & { year: string }): void {
    this.editor.chain().focus().insertContent({ type: 'almanacRecord', attrs: { record: pick.id, year: pick.year || '' } }).run();
    this.panel = null;
  }

  insertRecordLink(pick: RecordPick): void {
    this.editor.chain().focus().insertContent([
      { type: 'text', text: pick.name, marks: [{ type: 'link', attrs: { href: pick.link } }] },
      { type: 'text', text: ' ' },
    ]).run();
    this.panel = null;
  }

  insertEmbed(pick: EmbedPick): void {
    this.editor.chain().focus().insertContent({ type: 'almanacEmbed', attrs: pick }).run();
    this.panel = null;
  }

  importMarkdown(): void {
    const text = this.markdownText;
    if (!text.trim()) return;
    this.loadRaw(text, true, this.slug, this.slug);
    this.markdownText = '';
    this.panel = null;
  }

  // ----------------------------------------------------------------- pictures

  pickImages(): void {
    this.imageInput?.nativeElement.click();
  }

  async addImages(files: FileList | File[] | null): Promise<void> {
    if (!files) return;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/') && !IMAGE.test(file.name)) continue;
      const name = this.keepImage(file.name, file);
      this.editor.chain().focus().insertContent({ type: 'figure', attrs: { src: name, alt: '', caption: '', layout: '' } }).run();
    }
    if (this.imageInput) this.imageInput.nativeElement.value = '';
  }

  /** Stores a picture under a safe file name (unique within the page). */
  private keepImage(original: string, blob: Blob): string {
    const dot = original.lastIndexOf('.');
    const ext = dot > 0 ? original.slice(dot).toLowerCase() : '';
    const base = (dot > 0 ? original.slice(0, dot) : original).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'image';
    let name = base + ext;
    for (let i = 2; this.images.has(name); i++) name = `${base}-${i}${ext}`;
    this.images.set(name, { blob, url: URL.createObjectURL(blob) });
    return name;
  }

  // ---------------------------------------------------------------- inspector

  inspect(): void {
    const selection = this.editor.state.selection as any;
    const node = selection.node;
    if (node && ['figure', 'almanacRecord', 'almanacEmbed', 'footnote'].includes(node.type.name)) {
      this.selected = { type: node.type.name, attrs: { ...node.attrs } };
    } else if (this.editor.isActive('layout')) {
      this.selected = { type: 'layout', attrs: { ...this.editor.getAttributes('layout') } };
    } else {
      this.selected = null;
    }
  }

  applySelected(): void {
    if (!this.selected) return;
    this.editor.chain().focus().updateAttributes(this.selected.type, this.selected.attrs).run();
  }

  removeSelected(): void {
    if (!this.selected) return;
    if (this.selected.type === 'layout') this.unwrap();
    else this.editor.chain().focus().deleteSelection().run();
    this.selected = null;
  }

  // ------------------------------------------------------------------ details

  addAuthor(): void {
    this.meta.authors.push({ name: '', affiliation: '' });
  }

  removeAuthor(author: PageAuthor): void {
    this.meta.authors = this.meta.authors.filter(a => a !== author);
    this.changed();
  }

  get menuText(): string {
    return this.meta.menu.join(' > ');
  }

  set menuText(value: string) {
    this.meta.menu = value.split('>').map(s => s.trim()).filter(Boolean);
  }

  slugChanged(): void {
    this.slugEdited = !!this.slug;
    this.changed();
  }

  // --------------------------------------------------------------------- open

  /** A page of the site, for revision. */
  async openSitePage(slug: string): Promise<void> {
    if (!slug) return;
    const tries = [
      { file: `${slug}/index.md`, markdown: true, dir: slug },
      { file: `${slug}.md`, markdown: true, dir: slug.includes('/') ? slug.slice(0, slug.lastIndexOf('/')) : '' },
      { file: `${slug}/index.html`, markdown: false, dir: slug },
      { file: `${slug}.html`, markdown: false, dir: slug.includes('/') ? slug.slice(0, slug.lastIndexOf('/')) : '' },
    ];
    for (const t of tries) {
      const text = await this.fetchText(`page-content/${t.file}`);
      if (text === null) continue;
      this.resetImages();
      this.loadRaw(text, t.markdown, slug, t.dir);
      const css = await this.fetchText(`page-content/${t.dir === slug ? `${slug}/style.css` : `${slug}.css`}`);
      this.css = css ?? '';
      await this.fetchReferencedImages(text, t.dir);
      this.notice = `Opened “${this.meta.title || slug}” for revision. Export it when done and send the file to the team.`;
      this.render();
      return;
    }
    this.notice = `No page at /pages/${slug}.`;
  }

  private async fetchText(path: string): Promise<string | null> {
    const text = await firstValueFrom(this.http.get(path, { responseType: 'text' }).pipe(catchError(() => of(null))));
    return text === null || /^\s*(<!doctype|<html)/i.test(text) ? null : text;
  }

  /** The page's own pictures, so a revision exports with them. */
  private async fetchReferencedImages(text: string, dir: string): Promise<void> {
    const names = new Set<string>();
    for (const m of text.matchAll(/(?:src=["']|\]\()([^"')\s:]+?\.(?:png|jpe?g|gif|svg|webp|avif))/gi)) names.add(m[1].replace(/^\.\//, ''));
    for (const name of names) {
      if (name.startsWith('/') || this.images.has(name)) continue;
      const blob = await firstValueFrom(this.http.get(`page-content/${dir ? dir + '/' : ''}${name}`, { responseType: 'blob' }).pipe(catchError(() => of(null))));
      if (blob && blob.type.startsWith('image/')) this.images.set(name, { blob, url: URL.createObjectURL(blob) });
    }
  }

  /** Reads a page file (front matter and body) into the form and the editor. */
  private loadRaw(raw: string, isMarkdown: boolean, slug: string, _dir: string): void {
    const { fields, body } = splitFrontMatter(raw);
    const meta = metaFromFields(fields);
    let html = bodyToEditorHtml(body, isMarkdown);
    const heading = firstHeading(html);
    if (!meta.title && heading) meta.title = heading;
    if (heading && sameTitle(heading, meta.title)) html = html.replace(/^\s*<h1[^>]*>[\s\S]*?<\/h1>/i, '');
    this.meta = meta;
    this.slug = slug;
    this.slugEdited = !!slug;
    this.editor.commands.setContent(html);
    this.restored = false;
    this.panel = null;
    this.changed();
  }

  pickFiles(): void {
    this.fileInput?.nativeElement.click();
  }

  /** Files from the author's computer: a page file with its pictures, or a zip of a page folder. */
  async openFiles(files: FileList | null): Promise<void> {
    if (!files?.length) return;
    const entries: { name: string; blob: Blob; path: string }[] = [];
    for (const file of Array.from(files)) {
      if (/\.zip$/i.test(file.name)) {
        const zip = await JSZip.loadAsync(file);
        for (const [path, entry] of Object.entries(zip.files)) {
          if (entry.dir || path.includes('__MACOSX') || path.split('/').pop()!.startsWith('.')) continue;
          entries.push({ name: path.split('/').pop()!, path, blob: await entry.async('blob') });
        }
      } else {
        entries.push({ name: file.name, path: (file as any).webkitRelativePath || file.name, blob: file });
      }
    }
    const main = entries.find(e => /^index\.md$/i.test(e.name)) ?? entries.find(e => /\.(md|markdown)$/i.test(e.name))
      ?? entries.find(e => /^index\.html$/i.test(e.name)) ?? entries.find(e => /\.html$/i.test(e.name));
    if (!main) { this.notice = 'No page file (index.md or .html) among those files.'; return; }
    const folder = main.path.includes('/') ? main.path.slice(0, main.path.lastIndexOf('/')) : '';
    const slug = (folder.split('/').filter(Boolean).pop() || main.name.replace(/\.(md|markdown|html)$/i, '')).toLowerCase();
    this.resetImages();
    for (const e of entries) {
      if (e === main) continue;
      if (/\.css$/i.test(e.name)) this.css = await e.blob.text();
      else if (IMAGE.test(e.name) && (!folder || e.path.startsWith(folder))) {
        const rel = folder ? e.path.slice(folder.length + 1) : e.name;
        this.images.set(rel, { blob: e.blob, url: URL.createObjectURL(e.blob) });
      }
    }
    this.loadRaw(await main.blob.text(), /\.(md|markdown)$/i.test(main.name), slug.startsWith('essays/') ? slug : slug, folder);
    if (!this.slug.includes('/')) this.slug = `essays/${this.slug}`;
    this.notice = `Opened ${main.name}${this.images.size ? ` with ${this.images.size} picture${this.images.size > 1 ? 's' : ''}` : ''}.`;
    if (this.fileInput) this.fileInput.nativeElement.value = '';
    this.render();
  }

  private resetImages(): void {
    for (const img of this.images.values()) URL.revokeObjectURL(img.url);
    this.images.clear();
    this.css = '';
  }

  // ------------------------------------------------------------------- export

  /** The page as a folder in a zip: index.md, its pictures, its style.css. */
  async exportZip(): Promise<void> {
    if (!this.slugOk) { this.tab = 'details'; this.notice = 'Give the page an address (letters, numbers and hyphens) before exporting.'; return; }
    this.render();
    const zip = new JSZip();
    const folder = zip.folder(this.slug)!;
    folder.file('index.md', this.pageFile);
    if (this.css.trim()) folder.file('style.css', this.css);
    const used = new Set<string>();
    for (const m of this.markdown.matchAll(/(?:src=["']|\]\()([^"')\s:]+)/g)) used.add(m[1].replace(/^\.\//, ''));
    for (const [name, img] of this.images) if (used.has(name)) folder.file(name, img.blob);
    zip.file('HOW-TO-ADD.txt',
      `This zip holds one page of the Catholic Almanacs site.\n\n` +
      `To publish it, unzip it into client/public/page-content/ so the folder sits at\n` +
      `  client/public/page-content/${this.slug}/index.md\n` +
      `(or run: npm run pages:import <this zip> from client/). The page then appears at\n` +
      `  /pages/${this.slug}\n` +
      `and in the pages listing and nav on the next start or build.${this.meta.draft ? '\n\nIt is marked draft: reachable at its address, but unlisted.' : ''}\n`);
    const blob = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${this.slug.split('/').pop()}.zip`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    this.dirty = false;
  }

  async copySource(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.pageFile);
      this.notice = 'Page file copied.';
    } catch { this.notice = 'Could not copy; select the text and copy it by hand.'; }
  }

  discardDraft(): void {
    localStorage.removeItem(DRAFT_KEY);
    this.restored = false;
    this.newPage();
  }
}
