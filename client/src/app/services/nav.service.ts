import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, combineLatest, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { Settings } from '../app.settings';
import { ReviewAuthService } from './review-auth.service';

/** One entry of the site's navigation: a link, or a label over children (to any depth). */
export interface NavItem {
  label: string;
  link?: string;
  children?: NavItem[];
  /** True for the entry that stands for the generated pages listing. */
  pages?: boolean;
}

/** An entry of page-content/pages.json (written by `npm run pages:index` from the page files). */
export interface PageEntry {
  slug: string;
  title: string;
  description?: string;
  date?: string;
  authors?: string[];
  draft?: boolean;
  /** Listed and reachable only for signed-in editors. */
  editors?: boolean;
  kind?: string;
  /** Where the page sits in the nav: the labels of the groups above it, outermost first. */
  menu?: string[];
}

/** The nav's built-in items, always first; the config file only adds after them. */
const BUILT_IN: NavItem[] = [
  { label: 'Institutions', link: '/institutions' },
  { label: 'People', link: '/people' },
  { label: 'Dashboards', link: '/dashboards' },
];

/**
 * The site's navigation: the built-in items, then whatever
 * page-content/site-nav.json adds (nested to any depth), with `"pages": true`
 * standing for the listing of content pages generated from the files
 * (page-content/pages.json), and each page's own `menu` placing it under the
 * groups it names (created after the config's items when absent). Both files
 * are optional; without them the nav is the built-in items alone.
 */
@Injectable({ providedIn: 'root' })
export class NavService {
  private readonly items = new BehaviorSubject<NavItem[]>(this.builtIn());
  readonly items$ = this.items.asObservable();
  private readonly pagesSubject = new BehaviorSubject<PageEntry[]>([]);
  /** Every published content page, newest first. */
  readonly pages$ = this.pagesSubject.asObservable();

  constructor(private http: HttpClient, private auth: ReviewAuthService) {
    const files = forkJoin({
      nav: this.http.get<{ items?: NavItem[] }>('page-content/site-nav.json').pipe(catchError(() => of({ items: [] }))),
      pages: this.http.get<PageEntry[]>('page-content/pages.json').pipe(catchError(() => of([] as PageEntry[]))),
    });
    // editors-only pages appear once the browser is signed in
    combineLatest([files, this.auth.signedIn$]).subscribe(([{ nav, pages }, signedIn]) => {
      const published = (Array.isArray(pages) ? pages : []).filter(p => !p.draft && (signedIn || !p.editors));
      this.pagesSubject.next(published);
      // the listing item lists the pages nothing else in the nav links to
      const linked = new Set<string>();
      const collect = (list: NavItem[]) => list.forEach(i => { if (i.link) linked.add(i.link); if (i.children) collect(i.children); });
      collect(nav?.items ?? []);
      const unlinked = published.filter(p => !linked.has(`/pages/${p.slug}`) && !p.menu?.length);
      const items = (nav?.items ?? []).map(i => this.resolve(i, unlinked)).filter((i): i is NavItem => !!i);
      for (const page of published) if (page.menu?.length) this.place(items, page);
      this.items.next([...this.builtIn(), ...items]);
    });
  }

  private builtIn(): NavItem[] {
    return Settings.exportEnabled ? [...BUILT_IN, { label: 'Export', link: '/export' }] : [...BUILT_IN];
  }

  /** Puts a page under the groups its `menu` names, making any that are missing. */
  private place(items: NavItem[], page: PageEntry): void {
    let level = items;
    for (const label of page.menu!) {
      let group = level.find(i => i.label.toLowerCase() === label.toLowerCase() && !i.pages);
      if (!group) { group = { label }; level.push(group); }
      group.children ??= [];
      level = group.children;
    }
    const link = `/pages/${page.slug}`;
    if (!level.some(i => i.link === link)) level.push({ label: page.title, link });
  }

  /** A config entry, with `"pages": true` turned into links to the pages given. */
  private resolve(item: NavItem, pages: PageEntry[]): NavItem | null {
    if (!item || typeof item.label !== 'string') return null;
    if (item.pages) {
      const links = pages.map(p => ({ label: p.title, link: `/pages/${p.slug}` }));
      return { label: item.label, link: item.link ?? '/pages', pages: true, children: links.length ? links : undefined };
    }
    const children = (item.children ?? []).map(c => this.resolve(c, pages)).filter((c): c is NavItem => !!c);
    return { label: item.label, link: item.link, children: children.length ? children : undefined };
  }
}
