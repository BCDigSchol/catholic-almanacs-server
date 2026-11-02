import { Component, ElementRef, Input, OnChanges, OnDestroy, Renderer2, SimpleChanges } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MatIconModule } from '@angular/material/icon';

import { PageHeaderComponent } from '../../common/page-header/page-header.component';
import { citation, PageMeta, scopeCss } from '../../../utils/page-render';

/**
 * How a content page looks: the masthead (kind, title, byline, date), a
 * draft notice, the abstract, the body, and the "How to cite" block. The
 * page route feeds it a file; the writing tool feeds it the editor's text,
 * so the preview is the page itself.
 */
@Component({
  selector: 'app-page-view',
  imports: [RouterLink, MatIconModule, PageHeaderComponent],
  templateUrl: './page-view.component.html',
  styleUrl: './page-view.component.scss'
})
export class PageViewComponent implements OnChanges, OnDestroy {
  @Input() meta: PageMeta | null = null;
  /** The body as HTML, its asset paths already resolved. */
  @Input() html = '';
  /** The page's own stylesheet, unscoped. */
  @Input() css = '';
  /** The page's address under /pages, for the permalink and the style scope. */
  @Input() slug = '';
  /** In the writing tool, links inside the body are left alone. */
  @Input() preview = false;

  content: SafeHtml | null = null;
  copied = false;
  private styleEl: HTMLStyleElement | null = null;

  constructor(private sanitizer: DomSanitizer, private router: Router, private renderer: Renderer2,
              private host: ElementRef<HTMLElement>) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['html']) {
      // Page authors are trusted collaborators, so keep their markup intact
      this.content = this.html ? this.sanitizer.bypassSecurityTrustHtml(this.html) : null;
    }
    if (changes['css'] || changes['slug']) {
      this.dropStyle();
      if (this.css) this.applyStyle(scopeCss(this.css, `.page-content[data-page="${this.slug}"]`));
    }
  }

  ngOnDestroy(): void {
    this.dropStyle();
  }

  get permalink(): string {
    return `${window.location.origin}/pages/${this.slug}`;
  }

  get citation(): string {
    return this.meta ? citation(this.meta, this.permalink) : '';
  }

  get kindLabel(): string {
    return this.meta?.kind || 'Page';
  }

  private applyStyle(css: string): void {
    this.styleEl = this.renderer.createElement('style');
    this.styleEl!.textContent = css;
    this.renderer.appendChild(this.host.nativeElement, this.styleEl);
  }

  private dropStyle(): void {
    if (this.styleEl) { this.styleEl.remove(); this.styleEl = null; }
  }

  async copyCitation(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.citation);
      this.copied = true;
      setTimeout(() => this.copied = false, 2000);
    } catch {
      const text = this.host.nativeElement.querySelector('.cite-text');
      if (text) window.getSelection()?.selectAllChildren(text);
    }
  }

  // Route internal links through the Angular router instead of a full page reload
  onContentClick(event: MouseEvent): void {
    const anchor = (event.target as HTMLElement).closest('a');
    if (!anchor) return;
    const href = anchor.getAttribute('href');
    if (this.preview) { event.preventDefault(); return; }
    if (!href || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
    if (/^(https?:|mailto:|tel:|#|page-content\/|blob:|data:)/.test(href)) return;

    event.preventDefault();
    this.router.navigateByUrl(href);
  }
}
