import {
  Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, Subscription, of, EMPTY } from 'rxjs';
import { debounceTime, switchMap, tap, catchError } from 'rxjs/operators';
import { MatIconModule } from '@angular/material/icon';
import { ApiService } from '../../../services/api.service';
import { MapVisComponent } from '../../common/map-vis/map-vis.component';
import { LegendEntry } from '../../common/map-vis/map-grouping';
import { spaceName } from '../../../pipes/space-name.pipe';
import { DashboardShellComponent } from '../../common/dashboard-shell/dashboard-shell.component';
import { ControlBarComponent, ControlChip } from '../../common/control-bar/control-bar.component';
import { VizPanelComponent, VizState } from '../../common/viz-panel/viz-panel.component';
import { SegmentedComponent } from '../../common/segmented/segmented.component';
import { UrlState } from '../../../utils/url-state';
import { INKS } from '../../../utils/palette';
import {
  FilterState, Dim, Entity, emptyFilter, totalActive,
  FUNCTION_ORDER, FUNCTION_LABELS, functionColor
} from './overview-aggregate';

interface Bar {
  key: string;
  label: string;
  value: number;
  pct: number;       // 0-100, relative to the biggest bar in its panel
  color: string;
  selected: boolean;
}
interface YearBar {
  year: number;
  value: number;
  pct: number;
  selected: boolean;
  gapBefore: boolean;
}

/** Filter state in the query string; each set is joined with "~" (type names contain commas). */
const DEFAULTS = { entity: 'institutions', years: '', functions: '', types: '', dioceses: '' };
const SEP = '~';
const DIM_LABELS: Record<Dim, string> = { years: 'Year', functions: 'Function', types: 'Type', dioceses: 'Diocese' };

// "The Almanac at a Glance" — a coordinated-views ("god view") dashboard. Every
// panel both displays a breakdown and acts as a filter; clicking anything
// narrows every other panel. All aggregation runs SERVER-SIDE: the browser only
// posts the current filter state to /api/stats/overview and renders the small
// panel payload it gets back (no big corpus download).
@Component({
  selector: 'app-overview-dashboard',
  imports: [DecimalPipe, MatIconModule, MapVisComponent, DashboardShellComponent, ControlBarComponent, VizPanelComponent, SegmentedComponent],
  templateUrl: './overview.component.html',
  styleUrl: './overview.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OverviewDashboardComponent implements OnInit, OnDestroy {
  readonly related = [
    { label: 'Coverage — the Shape of the Data', link: '/dashboards/coverage' },
    { label: 'The Shape of the Church', link: '/dashboards/composition' },
    { label: 'Diocese by Diocese', link: '/dashboards/diocese-tracker' },
    { label: 'Comparing Places', link: '/dashboards/comparison' },
  ];
  readonly entities = [{ value: 'institutions', label: 'Institutions' }, { value: 'people', label: 'People' }];

  loading = true;       // first load (full-panel placeholder)
  fetching = false;     // subsequent refreshes (subtle dim)
  error: string | null = null;
  note = '';
  takeaway = '';

  entity: Entity = 'institutions';
  private filter: FilterState = emptyFilter();
  private url: UrlState<typeof DEFAULTS>;
  private urlSub?: Subscription;

  chips: ControlChip[] = [];
  functionBars: Bar[] = [];
  typeBars: Bar[] = [];
  dioceseBars: Bar[] = [];
  private dioceseNames: Record<string, string> = {};
  yearBars: YearBar[] = [];
  kpis = {
    institutions: 0, people: 0, dioceses: 0, states: 0,
    yearSpan: '—', topFunction: '—'
  };

  mapData: any[] = [];
  legend: LegendEntry[] = [];
  // Default to the (viewport-adaptive) heatmap for the density view; points stay
  // available via the in-map Display control. Click-to-filter works in any mode.
  mapOptions = {
    zoom: 3.5,
    mode: 'heatmap' as const,
    modeControl: true,
    center: { lat: 39, lng: -95 },
    size: { width: '100%', height: `${Math.round(Math.min(520, Math.max(340, window.innerWidth * 0.75)))}px` }
  };

  private refresh$ = new Subject<void>();
  private sub: Subscription | null = null;
  // Cache responses by request body so toggling a filter back is instant.
  private cache = new Map<string, any>();

  constructor(private _api: ApiService, private cdr: ChangeDetectorRef, router: Router, route: ActivatedRoute) {
    this.url = new UrlState(router, route, DEFAULTS);
  }

  ngOnInit(): void {
    this.sub = this.refresh$.pipe(
      debounceTime(90),                 // coalesce rapid clicks
      switchMap(() => {                 // cancel any in-flight request
        const body = this.requestBody();
        const ck = JSON.stringify(body);
        const hit = this.cache.get(ck);
        if (hit) return of(hit);
        this.fetching = true;
        this.cdr.markForCheck();
        return this._api.postTypeRequest('stats/overview', body).pipe(
          tap(r => this.cache.set(ck, r)),
          catchError(err => {
            this.error = err?.error?.message || 'Could not load the overview.';
            this.loading = false;
            this.fetching = false;
            this.cdr.markForCheck();
            return EMPTY;
          })
        );
      })
    ).subscribe(res => this.applyResponse(res));

    // The URL is the source of truth for the filter state: every click writes
    // it, and loading a shared link restores the same filtered board.
    this.urlSub = this.url.changes().subscribe(state => {
      const split = (v: string) => v ? v.split(SEP).filter(Boolean) : [];
      this.entity = state.entity === 'people' ? 'people' : 'institutions';
      this.filter = {
        years: new Set(split(state.years).map(Number).filter(Number.isFinite)),
        functions: new Set(split(state.functions)),
        types: new Set(split(state.types)),
        dioceses: new Set(split(state.dioceses)),
      };
      this.afterFilterChange();
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.urlSub?.unsubscribe();
  }

  get vizState(): VizState {
    return this.error ? 'error' : this.loading ? 'loading' : 'ready';
  }

  retry(): void {
    this.error = null;
    this.loading = true;
    this.refresh$.next();
  }

  get activeCount(): number { return totalActive(this.filter); }
  get fnActive(): boolean { return this.filter.functions.size > 0; }
  get yearActive(): boolean { return this.filter.years.size > 0; }
  /** The map draws a year's state lines when exactly one year is picked. */
  get mapYear(): number | null { return this.filter.years.size === 1 ? [...this.filter.years][0] : null; }

  // --- Filter mutations: update state, reflect selection instantly, refetch ---

  toggleFunction(key: string): void { this.toggleStr('functions', key); }
  toggleType(key: string): void { this.toggleStr('types', key); }
  toggleDiocese(key: string): void { this.toggleStr('dioceses', key); }
  toggleYear(year: number): void {
    const set = new Set(this.filter.years);
    set.has(year) ? set.delete(year) : set.add(year);
    this.writeUrl({ years: set });
  }
  onMapSelect(payload: { select?: string | null }): void {
    if (payload?.select) this.toggleDiocese(payload.select);
  }

  private toggleStr(dim: Exclude<Dim, 'years'>, key: string): void {
    const set = new Set(this.filter[dim]);
    set.has(key) ? set.delete(key) : set.add(key);
    this.writeUrl({ [dim]: set });
  }

  clearAll = (): void => this.writeUrl(emptyFilter());

  setEntity(entity: string): void {
    this.url.set({ entity });
  }

  /** Writes changed filter dimensions to the URL; the URL subscription refetches. */
  private writeUrl(changes: Partial<FilterState>): void {
    const out: Partial<typeof DEFAULTS> = {};
    for (const [dim, set] of Object.entries(changes) as [Dim, Set<string | number>][]) {
      const values = Array.from(set);
      if (dim === 'years') (values as number[]).sort((a, b) => a - b);
      out[dim] = values.join(SEP);
    }
    this.url.set(out);
  }

  // Reflect selection/chips immediately (client-side), then ask the server for
  // refreshed counts. Gives instant feedback even while the request is in flight.
  private afterFilterChange(): void {
    this.markSelectionUI();
    this.refresh$.next();
  }

  private markSelectionUI(): void {
    const mark = (bars: Bar[], set: Set<string>) => bars.forEach(b => b.selected = set.has(b.key));
    mark(this.functionBars, this.filter.functions);
    mark(this.typeBars, this.filter.types);
    mark(this.dioceseBars, this.filter.dioceses);
    this.yearBars.forEach(b => b.selected = this.filter.years.has(b.year));
    this.buildChips();
    this.cdr.markForCheck();
  }

  // --- Request / response ---

  private requestBody(): any {
    return {
      entity: this.entity,
      years: Array.from(this.filter.years),
      functions: Array.from(this.filter.functions),
      types: Array.from(this.filter.types),
      dioceses: Array.from(this.filter.dioceses)
    };
  }

  private applyResponse(res: any): void {
    if (!res) return;
    this.loading = false;
    this.fetching = false;
    this.error = null;
    this.note = res.meta?.note ?? this.note;
    if (res.meta?.dioceseNames) this.dioceseNames = res.meta.dioceseNames;

    this.functionBars = this.toBars(res.functions, this.filter.functions, k => FUNCTION_LABELS[k] ?? k, k => functionColor(k));
    this.typeBars = this.toBars(res.types, this.filter.types, k => this.titleCase(k), () => INKS[0]);
    this.dioceseBars = this.toBars(res.dioceses, this.filter.dioceses, k => this.dioceseName(k), () => INKS[7]);

    const ys = (res.years ?? []) as { year: number; value: number }[];
    const ymax = Math.max(1, ...ys.map(y => y.value));
    this.yearBars = ys.map((y, idx) => ({
      year: y.year,
      value: y.value,
      pct: (y.value / ymax) * 100,
      selected: this.filter.years.has(y.year),
      gapBefore: idx > 0 && y.year - ys[idx - 1].year > 3
    }));

    const k = res.kpis ?? {};
    this.kpis = {
      institutions: k.institutions ?? 0,
      people: k.people ?? 0,
      dioceses: k.dioceses ?? 0,
      states: k.states ?? 0,
      yearSpan: k.yearMin == null ? '—' : (k.yearMin === k.yearMax ? `${k.yearMin}` : `${k.yearMin}–${k.yearMax}`),
      topFunction: k.topFunction ? (FUNCTION_LABELS[k.topFunction] ?? k.topFunction) : '—'
    };

    const present = new Set<string>();
    this.mapData = (res.map ?? []).map((c: any) => {
      present.add(c.f);
      return {
        latitude: c.lat,
        longitude: c.lng,
        title: this.dioceseName(c.d),
        select: c.d,                 // click filters to this location's diocese (canonical id)
        options: {
          color: functionColor(c.f),
          value: c.v,
          radius: Math.min(4 + Math.sqrt(c.v) * 2, 16)
        }
      };
    });
    this.legend = FUNCTION_ORDER
      .filter(x => present.has(x))
      .map(x => ({ label: FUNCTION_LABELS[x] ?? x, color: functionColor(x) }));

    this.buildChips();
    this.takeaway = this.computeTakeaway();
    this.cdr.markForCheck();
  }

  /** The leading diocese's part of the current selection (unless dioceses are already filtered). */
  private computeTakeaway(): string {
    const total = this.entity === 'people' ? this.kpis.people : this.kpis.institutions;
    const top = this.dioceseBars[0];
    if (this.filter.dioceses.size || this.dioceseBars.length < 2 || !top || !total) return '';
    const noun = this.entity === 'people' ? 'people' : 'institutions';
    const scope = totalActive(this.filter) ? 'in this selection' : 'across the almanacs';
    return `${top.label} recorded the most ${noun} ${scope}: ${top.value.toLocaleString()} of ${total.toLocaleString()} (${Math.round(top.value / total * 100)}%).`;
  }

  // Map a server [{key,value}] panel into rendered bars (label/colour/pct/selected).
  private toBars(
    rows: { key: string; value: number }[] = [],
    selected: Set<string>,
    labelOf: (k: string) => string,
    colorOf: (k: string) => string
  ): Bar[] {
    const max = Math.max(1, ...rows.map(r => r.value));
    return rows.map(r => ({
      key: r.key,
      label: labelOf(r.key),
      value: r.value,
      pct: (r.value / max) * 100,
      color: colorOf(r.key),
      selected: selected.has(r.key)
    }));
  }

  private buildChips(): void {
    const chip = (dim: Dim, label: string, clear: () => void): ControlChip => ({ label: `${DIM_LABELS[dim]}: ${label}`, clear });
    this.chips = [
      ...Array.from(this.filter.functions, f => chip('functions', FUNCTION_LABELS[f] ?? f, () => this.toggleFunction(f))),
      ...Array.from(this.filter.types, t => chip('types', this.titleCase(t), () => this.toggleType(t))),
      ...Array.from(this.filter.dioceses, d => chip('dioceses', this.dioceseName(d), () => this.toggleDiocese(d))),
      ...Array.from(this.filter.years).sort((a, b) => a - b).map(y => chip('years', String(y), () => this.toggleYear(y))),
    ];
  }

  private titleCase(value: string): string {
    return spaceName(value).replace(/\b\w/g, c => c.toUpperCase());
  }

  // Canonical diocese id -> display name (from the server), with a graceful fallback.
  private dioceseName(key: string): string {
    return this.dioceseNames[key] || spaceName(key);
  }
}
