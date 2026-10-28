import { Component, ElementRef, EventEmitter, HostBinding, HostListener, Input, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, Subscription, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, switchMap, tap } from 'rxjs/operators';
import { MatIconModule } from '@angular/material/icon';

import { ApiService } from '../../../services/api.service';

export type SearchScope = 'all' | 'institutions' | 'people';

interface SearchHit {
  kind: 'institution' | 'person';
  label: string;
  detail: string;
  link: string;
}

// /api/all returns at most this many matches of each kind.
const API_CAP = 30;
// How many of each kind the dropdown shows before "See all".
const SHOWN = 6;

/**
 * Site-wide quick search in the header. Searches institution and person
 * names (GET /api/all) as you type, scoped by the selector beside the input;
 * Enter or "See all" opens the matching Browse page pre-filtered by name.
 */
@Component({
  selector: 'app-header-search',
  imports: [FormsModule, MatIconModule],
  templateUrl: './header-search.component.html',
  styleUrl: './header-search.component.scss'
})
export class HeaderSearchComponent implements OnInit, OnDestroy {
  @Input() autofocus = false;
  /** 'large' is the prominent version used on the home page. */
  @Input() @HostBinding('attr.data-size') size: 'compact' | 'large' = 'compact';
  /** Open results in a new tab (used when the site is embedded in another page). */
  @Input() newTab = false;
  /** Prefix for element ids, so several search boxes can share a page. */
  @Input() idPrefix = 'header-search';
  @Output() navigated = new EventEmitter<void>();
  @ViewChild('input', { static: true }) input!: ElementRef<HTMLInputElement>;

  scope: SearchScope = 'all';
  query = '';
  institutions: SearchHit[] = [];
  people: SearchHit[] = [];
  open = false;
  loading = false;
  activeIndex = -1;

  readonly scopes: { value: SearchScope; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'institutions', label: 'Institutions' },
    { value: 'people', label: 'People' },
  ];

  private queries = new Subject<string>();
  private sub?: Subscription;

  constructor(private api: ApiService, private router: Router, private host: ElementRef<HTMLElement>) {}

  get placeholder(): string {
    switch (this.scope) {
      case 'institutions': return 'Search institutions by name';
      case 'people': return 'Search people by name';
      default: return 'Search institutions and people';
    }
  }

  get shownInstitutions(): SearchHit[] {
    return this.scope === 'people' ? [] : this.institutions.slice(0, SHOWN);
  }

  get shownPeople(): SearchHit[] {
    return this.scope === 'institutions' ? [] : this.people.slice(0, SHOWN);
  }

  /** Hits in on-screen order, for keyboard navigation. */
  get visibleHits(): SearchHit[] {
    return [...this.shownInstitutions, ...this.shownPeople];
  }

  get hasResults(): boolean {
    return this.visibleHits.length > 0;
  }

  ngOnInit(): void {
    this.sub = this.queries.pipe(
      debounceTime(250),
      distinctUntilChanged(),
      tap(q => { this.loading = q.length >= 2; }),
      switchMap(q => q.length < 2
        ? of([])
        : this.api.getTypeRequest('all?name=' + encodeURIComponent(q)).pipe(catchError(() => of([]))))
    ).subscribe((rows: any) => {
      this.loading = false;
      this.activeIndex = -1;
      this.institutions = (rows as any[]).filter(r => r.type === 'institution').map(r => ({
        kind: 'institution' as const,
        label: r.instName,
        detail: r.diocese ? `Diocese of ${r.diocese}` : '',
        link: '/institutions/' + r.instID,
      }));
      this.people = (rows as any[]).filter(r => r.type === 'person').map(r => ({
        kind: 'person' as const,
        label: [r.title, r.name, r.suffix].filter(Boolean).join(' '),
        detail: r.yearStart === r.yearEnd ? `${r.yearStart}` : `${r.yearStart}–${r.yearEnd}`,
        link: '/people/' + r.persID,
      }));
    });
    if (this.autofocus) {
      setTimeout(() => this.input.nativeElement.focus());
    }
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  onInput(): void {
    this.open = true;
    this.queries.next(this.query.trim());
  }

  onScopeChange(): void {
    this.activeIndex = -1;
    this.input.nativeElement.focus();
    this.open = this.query.trim().length >= 2;
  }

  /** "See all" label. The API caps results, so say "30+" rather than a false total. */
  seeAllLabel(kind: 'institutions' | 'people'): string {
    const n = (kind === 'institutions' ? this.institutions : this.people).length;
    const noun = kind === 'institutions' ? (n === 1 ? 'institution' : 'institutions') : (n === 1 ? 'person' : 'people');
    if (n >= API_CAP) return `See all ${API_CAP}+ ${noun} in Browse`;
    return n === 1 ? `See this ${noun} in Browse` : `See all ${n} ${noun} in Browse`;
  }

  onKeydown(event: KeyboardEvent): void {
    const hits = this.visibleHits;
    if (event.key === 'ArrowDown' && hits.length) {
      event.preventDefault();
      this.open = true;
      this.activeIndex = (this.activeIndex + 1) % hits.length;
    } else if (event.key === 'ArrowUp' && hits.length) {
      event.preventDefault();
      this.activeIndex = this.activeIndex <= 0 ? hits.length - 1 : this.activeIndex - 1;
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (this.activeIndex >= 0 && hits[this.activeIndex]) {
        this.go(hits[this.activeIndex].link);
      } else {
        this.seeAll(this.scope === 'people' ? 'people' : 'institutions');
      }
    } else if (event.key === 'Escape') {
      this.open = false;
    }
  }

  isActive(hit: SearchHit): boolean {
    return this.activeIndex >= 0 && this.visibleHits[this.activeIndex] === hit;
  }

  go(link: string): void {
    this.open_(link);
    this.reset();
  }

  seeAll(kind: 'institutions' | 'people'): void {
    const q = this.query.trim();
    this.open_(this.router.serializeUrl(this.router.createUrlTree(['/' + kind], q ? { queryParams: { name: q } } : {})));
    this.reset();
  }

  private open_(url: string): void {
    if (this.newTab) {
      const base = (document.querySelector('base')?.href || '/').replace(/\/$/, '');
      window.open(base + url, '_blank');
    } else {
      this.router.navigateByUrl(url);
    }
  }

  private reset(): void {
    this.open = false;
    this.query = '';
    this.institutions = [];
    this.people = [];
    this.queries.next('');
    this.navigated.emit();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.open = false;
    }
  }
}
