import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { Subject, Subscription, combineLatest, of } from 'rxjs';
import { catchError, debounceTime, startWith, switchMap, tap } from 'rxjs/operators';
import { MatIconModule } from '@angular/material/icon';

import { ApiService } from '../../services/api.service';
import { PageHeaderComponent } from '../common/page-header/page-header.component';
import { YearRangeComponent, YearRange } from '../common/year-range/year-range.component';
import { PagerComponent } from '../common/pager/pager.component';
import { SheetComponent } from '../common/sheet/sheet.component';
import { institutionLabel, isUnnamed, personLabel, placeLabel, yearRuns } from '../../utils/record-labels';

export type BrowseEntity = 'institutions' | 'people';

interface FilterDef {
  param: string;        // URL query parameter
  api: string;          // list endpoint parameter
  label: string;
  kind: 'text' | 'select' | 'suggest';
  optionsFile?: string; // public/*.csv with one option per line
  options?: string[];
}

interface FilterGroup {
  label: string;
  filters: FilterDef[];
}

interface EntityConfig {
  noun: [string, string];       // singular, plural
  api: string;
  nameApi: string;              // list endpoint parameter for the name search
  searchPlaceholder: string;
  groups: FilterGroup[];
}

const YEAR_MIN = 1833;
const YEAR_MAX = 1870;
const PAGE_SIZES = [25, 50, 100];

const STATE: FilterDef = { param: 'state', api: 'stateOrig', label: 'State', kind: 'select', optionsFile: 'states.csv' };
const COUNTY: FilterDef = { param: 'county', api: 'countyOrig', label: 'County', kind: 'text' };
const CITY: FilterDef = { param: 'city', api: 'cityOrig', label: 'City or town', kind: 'text' };
const DIOCESE: FilterDef = { param: 'diocese', api: 'diocese', label: 'Diocese', kind: 'suggest', optionsFile: 'diocese.csv' };
const ORDER: FilterDef = { param: 'order', api: 'religiousOrder', label: 'Religious order', kind: 'suggest', optionsFile: 'order.csv' };

const CONFIG: Record<BrowseEntity, EntityConfig> = {
  institutions: {
    noun: ['institution', 'institutions'],
    api: 'institution',
    nameApi: 'instName',
    searchPlaceholder: 'Search institutions by name',
    groups: [
      { label: 'Place', filters: [DIOCESE, STATE, COUNTY, CITY] },
      { label: 'Institution', filters: [
        { param: 'type', api: 'instType', label: 'Type', kind: 'suggest', optionsFile: 'types.csv' },
        { param: 'function', api: 'instFunction', label: 'Function', kind: 'select', optionsFile: 'functions.csv' },
        { param: 'language', api: 'language', label: 'Language', kind: 'text' },
        ORDER,
      ] },
      { label: 'People', filters: [
        { param: 'person', api: 'persName', label: 'Served by (name)', kind: 'text' },
      ] },
    ],
  },
  people: {
    noun: ['person', 'people'],
    api: 'person',
    nameApi: 'persName',
    searchPlaceholder: 'Search people by name',
    groups: [
      { label: 'Place', filters: [DIOCESE, STATE, COUNTY, CITY] },
      { label: 'Service', filters: [
        { param: 'institution', api: 'instName', label: 'Institution name', kind: 'text' },
        ORDER,
      ] },
    ],
  },
};

const SORTS = [
  { value: 'name', label: 'Name' },
  { value: 'year', label: 'First year' },
  { value: 'diocese', label: 'Diocese' },
];

interface Chip {
  label: string;
  clear: () => void;
}

/**
 * Browse institutions or people (route data `entity`). The URL is the single
 * source of truth: every filter, the sort, page and page size live in the
 * query string, so any view can be linked, bookmarked or returned to with Back.
 */
@Component({
  selector: 'app-browse',
  imports: [NgTemplateOutlet, FormsModule, RouterLink, MatIconModule, PageHeaderComponent, YearRangeComponent, PagerComponent, SheetComponent],
  templateUrl: './browse.component.html',
  styleUrl: './browse.component.scss'
})
export class BrowseComponent implements OnInit, OnDestroy {
  @ViewChild('results') results?: ElementRef<HTMLElement>;

  entity: BrowseEntity = 'institutions';
  config = CONFIG.institutions;
  readonly sorts = SORTS;
  readonly pageSizes = PAGE_SIZES;
  readonly yearMin = YEAR_MIN;
  readonly yearMax = YEAR_MAX;

  /** Current values of the name search and filters, keyed by URL param. */
  values: Record<string, string> = {};
  from?: number;
  to?: number;
  sort = 'name';
  page = 1;
  size = PAGE_SIZES[0];

  rows: any[] = [];
  total = 0;
  loading = true;
  failed = false;
  sheetOpen = false;

  readonly isUnnamed = isUnnamed;
  readonly yearRuns = yearRuns;

  private configured = false;
  private appliedKey = '';
  private typing = new Subject<void>();
  private retry = new Subject<void>();
  private subs: Subscription[] = [];
  private loadedOptions = new Set<string>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService,
    private http: HttpClient,
    private title: Title,
  ) {}

  ngOnInit(): void {
    // Text filters apply once typing pauses.
    this.subs.push(this.typing.pipe(debounceTime(400)).subscribe(() => this.apply()));

    this.subs.push(combineLatest([this.route.data, this.route.queryParamMap, this.retry.pipe(startWith(undefined))]).pipe(
      tap(([data, params]) => this.readState(data['entity'], params)),
      switchMap(() => {
        this.loading = true;
        this.failed = false;
        return this.api.getTypeRequest(this.config.api + this.apiQuery()).pipe(
          catchError(() => {
            this.failed = true;
            return of(null);
          }));
      })
    ).subscribe((res: any) => {
      this.loading = false;
      if (!res) return;
      this.rows = res.rows;
      this.total = res.count;
    }));
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  // ---- state <-> URL --------------------------------------------------------

  private readState(entity: BrowseEntity, params: ParamMap): void {
    if (entity !== this.entity || !this.configured) {
      this.configured = true;
      this.entity = entity;
      this.config = CONFIG[entity];
      this.title.setTitle(`${this.capitalised(this.config.noun[1])} · Catholic Almanacs`);
      this.loadOptions();
    }
    // When the URL is what apply() just wrote, the form already holds these
    // values — and possibly newer keystrokes, which re-reading would drop.
    const fromUrl = Object.fromEntries(params.keys.map(k => [k, params.get(k)]));
    if (this.stateKey(fromUrl) !== this.appliedKey) {
      this.values = { name: params.get('name') ?? '' };
      for (const f of this.filters) {
        this.values[f.param] = params.get(f.param) ?? '';
      }
      this.from = this.yearParam(params.get('from'));
      this.to = this.yearParam(params.get('to'));
    }
    this.sort = SORTS.some(s => s.value === params.get('sort')) ? params.get('sort')! : 'name';
    const size = Number(params.get('size'));
    this.size = PAGE_SIZES.includes(size) ? size : PAGE_SIZES[0];
    this.page = Math.max(1, Math.floor(Number(params.get('page')) || 1));
  }

  /** Writes the current state to the URL (which triggers the fetch). */
  apply(changes: { page?: number } = {}): void {
    const queryParams: Record<string, string | number | null> = {};
    for (const [key, value] of Object.entries(this.values)) {
      queryParams[key] = value.trim() || null;
    }
    queryParams['from'] = this.from && this.from !== YEAR_MIN ? this.from : null;
    queryParams['to'] = this.to && this.to !== YEAR_MAX ? this.to : null;
    queryParams['sort'] = this.sort !== 'name' ? this.sort : null;
    queryParams['size'] = this.size !== PAGE_SIZES[0] ? this.size : null;
    const page = changes.page ?? 1;
    queryParams['page'] = page > 1 ? page : null;
    this.appliedKey = this.stateKey(queryParams);
    this.router.navigate([], { relativeTo: this.route, queryParams, replaceUrl: true });
  }

  /** Order-independent fingerprint of a set of query params, ignoring empty ones. */
  private stateKey(params: Record<string, unknown>): string {
    return JSON.stringify(Object.entries(params)
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(([k, v]) => [k, String(v)])
      .sort(([a], [b]) => a.localeCompare(b)));
  }

  private apiQuery(): string {
    const q = new URLSearchParams({ page: String(this.page), size: String(this.size) });
    if (this.values['name']) q.set(this.config.nameApi, this.values['name']);
    for (const f of this.filters) {
      if (this.values[f.param]) q.set(f.api, this.values[f.param]);
    }
    if (this.from) q.set('instStartYear', String(this.from));
    if (this.to) q.set('instEndYear', String(this.to));
    if (this.sort !== 'name') q.set('sort', this.sort);
    return '?' + q.toString();
  }

  private yearParam(value: string | null): number | undefined {
    const n = Number(value);
    return value && Number.isFinite(n) && n >= YEAR_MIN && n <= YEAR_MAX ? n : undefined;
  }

  // ---- interactions ---------------------------------------------------------

  onType(): void {
    this.typing.next();
  }

  onYears(range: YearRange): void {
    this.from = range.from;
    this.to = range.to;
    this.apply();
  }

  goToPage(page: number): void {
    this.apply({ page });
    this.results?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  clearAll(): void {
    for (const key of Object.keys(this.values)) {
      this.values[key] = '';
    }
    this.from = undefined;
    this.to = undefined;
    this.apply();
  }

  reload(): void {
    this.retry.next();
  }

  get filters(): FilterDef[] {
    return this.config.groups.flatMap(g => g.filters);
  }

  get activeCount(): number {
    return this.chips.length;
  }

  get chips(): Chip[] {
    const chips: Chip[] = [];
    if (this.values['name']?.trim()) {
      chips.push({ label: `Name: ${this.values['name'].trim()}`, clear: () => { this.values['name'] = ''; this.apply(); } });
    }
    for (const f of this.filters) {
      const value = this.values[f.param]?.trim();
      if (value) {
        chips.push({ label: `${f.label}: ${value}`, clear: () => { this.values[f.param] = ''; this.apply(); } });
      }
    }
    if (this.from || this.to) {
      chips.push({
        label: `Years: ${this.from ?? YEAR_MIN}–${this.to ?? YEAR_MAX}`,
        clear: () => { this.from = undefined; this.to = undefined; this.apply(); },
      });
    }
    return chips;
  }

  get otherEntity(): BrowseEntity {
    return this.entity === 'institutions' ? 'people' : 'institutions';
  }

  /** The name search carries over when switching between the two tabs. */
  get tabParams(): Record<string, string> | null {
    return this.values['name']?.trim() ? { name: this.values['name'].trim() } : null;
  }

  get rangeLabel(): string {
    if (!this.total) return '';
    const first = (this.page - 1) * this.size + 1;
    const last = Math.min(this.total, this.page * this.size);
    return `${first.toLocaleString()}–${last.toLocaleString()} of ${this.total.toLocaleString()}`;
  }

  get totalLabel(): string {
    const [one, many] = this.config.noun;
    return `${this.total.toLocaleString()} ${this.total === 1 ? one : many}`;
  }

  // ---- row display ----------------------------------------------------------

  rowLink(row: any): string {
    return `/${this.entity}/${row.ID}`;
  }

  rowLabel(row: any): string {
    return this.entity === 'institutions' ? institutionLabel(row.name, row.type) : personLabel(row);
  }

  /** "Louisville, KY" after an institution's name; people have no place of their own. */
  rowPlace(row: any): string {
    return this.entity === 'institutions' ? placeLabel(row.city, row.state) : '';
  }

  /** The italic line beneath an entry: its kind (unless the name already says it) and diocese. */
  rowSub(row: any): string[] {
    const kind = this.entity === 'institutions' && !isUnnamed(row.name) ? row.type : '';
    return [kind, row.diocese && `Diocese of ${row.diocese}`].filter(Boolean);
  }

  // ---- filter options -------------------------------------------------------

  private loadOptions(): void {
    for (const f of this.filters) {
      if (!f.optionsFile || this.loadedOptions.has(f.optionsFile)) continue;
      this.loadedOptions.add(f.optionsFile);
      this.http.get(f.optionsFile, { responseType: 'text' }).subscribe(text => {
        // The CSVs start with a byte-order mark, which would otherwise stick to the first option.
        const options = text.replace(/﻿/g, '').split('\n').map(l => l.trim()).filter(Boolean);
        for (const g of Object.values(CONFIG)) {
          g.groups.flatMap(x => x.filters).filter(x => x.optionsFile === f.optionsFile).forEach(x => x.options = options);
        }
      });
    }
  }

  private capitalised(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
}
