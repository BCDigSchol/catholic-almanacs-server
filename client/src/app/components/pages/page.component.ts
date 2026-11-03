import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { PageViewComponent } from './page-view/page-view.component';
import { ReviewAuthService } from '../../services/review-auth.service';
import { firstHeading, PageMeta, parsePage, resolveAssets, sameTitle } from '../../utils/page-render';

/** The files a slug may stand for, in the order they are tried. */
const CANDIDATES = (slug: string) => {
  const parent = slug.includes('/') ? slug.slice(0, slug.lastIndexOf('/')) : '';
  return [
    { file: `${slug}.md`, markdown: true, dir: parent, css: `${slug}.css` },
    { file: `${slug}.html`, markdown: false, dir: parent, css: `${slug}.css` },
    { file: `${slug}/index.md`, markdown: true, dir: slug, css: `${slug}/style.css` },
    { file: `${slug}/index.html`, markdown: false, dir: slug, css: `${slug}/style.css` },
  ];
};

/**
 * A content page from client/public/page-content: `<slug>.md`, `<slug>.html`
 * or a folder `<slug>/index.md|html` beside its images and an optional
 * `style.css` (scoped to the page). Front matter gives the title, authors,
 * date, abstract and the rest (see page-content/README.md). Loads the file
 * and hands it to app-page-view.
 */
@Component({
  selector: 'app-page',
  imports: [PageViewComponent],
  templateUrl: './page.component.html',
  styleUrl: './page.component.scss'
})
export class PageComponent implements OnInit {

  html = '';
  css = '';
  meta: PageMeta | null = null;
  slug = '';

  // Content files live in client/public/page-content/ and render at /pages/<slug>.
  // The folder is deliberately NOT named "pages": otherwise extensionless URLs like
  // /pages/foo can resolve to the raw foo.html file on some servers instead of the app.
  private readonly contentBase = 'page-content';

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private router: Router,
    private title: Title,
    private auth: ReviewAuthService,
  ) {}

  ngOnInit(): void {
    // Re-runs when navigating between pages, since the router reuses this component
    this.route.url.subscribe(segments => this.loadPage(segments.map(s => s.path).join('/')));
  }

  private loadPage(slug: string): void {
    if (!slug || !this.isSafeSlug(slug)) {
      this.router.navigate(['/404']);
      return;
    }
    this.slug = slug;
    this.html = '';
    this.css = '';
    this.meta = null;
    this.tryNext(CANDIDATES(slug), 0);
  }

  private tryNext(candidates: ReturnType<typeof CANDIDATES>, i: number): void {
    if (i >= candidates.length) {
      this.router.navigate(['/404']);
      return;
    }
    const c = candidates[i];
    this.fetch(c.file).subscribe(text => {
      if (text === null || this.isFallbackDocument(text)) this.tryNext(candidates, i + 1);
      else this.render(text, c.markdown, c.dir, c.css);
    });
  }

  // Hosts with a SPA fallback answer missing files with index.html and a 200
  // status. Content pages are body fragments, so a full document means "not found".
  private isFallbackDocument(raw: string): boolean {
    return /^\s*(<!doctype|<html)/i.test(raw);
  }

  private fetch(file: string): Observable<string | null> {
    return this.http.get(`${this.contentBase}/${file}`, { responseType: 'text' }).pipe(catchError(() => of(null)));
  }

  private render(raw: string, isMarkdown: boolean, dir: string, cssFile: string): void {
    const page = parsePage(raw, isMarkdown);
    if (page.meta.editors && !this.auth.isSignedIn) {
      this.router.navigate(['/sign-in'], { queryParams: { next: `/pages/${this.slug}` } });
      return;
    }
    let html = page.html;
    // The page header shows the title, so a body that opens with it loses that heading.
    const heading = firstHeading(html);
    if (!page.meta.title && heading) page.meta.title = heading;
    if (heading && sameTitle(heading, page.meta.title)) html = html.replace(/^\s*<h1[^>]*>[\s\S]*?<\/h1>/i, '');

    this.meta = page.meta;
    this.html = resolveAssets(html, dir);
    this.title.setTitle(page.meta.title ? `${page.meta.title} · Catholic Almanacs` : 'Catholic Almanacs');
    this.fetch(cssFile).subscribe(css => this.css = css && !this.isFallbackDocument(css) ? css : '');
  }

  // Only allow simple relative paths like "history/jesuits-in-maine", and not
  // the folder's README (the contributor guide, not a page of the site)
  private isSafeSlug(slug: string): boolean {
    return /^[\w\-/]+$/.test(slug) && !slug.includes('..') && !/(^|\/)readme$/i.test(slug);
  }
}
