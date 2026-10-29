import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, Subscription } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import * as d3 from 'd3';

import { ApiService } from '../../../services/api.service';
import { SpaceNamePipe, spaceName } from '../../../pipes/space-name.pipe';
import { DashboardShellComponent } from '../../common/dashboard-shell/dashboard-shell.component';
import { ControlBarComponent } from '../../common/control-bar/control-bar.component';
import { VizPanelComponent, VizState } from '../../common/viz-panel/viz-panel.component';
import { SegmentedComponent } from '../../common/segmented/segmented.component';
import { UrlState } from '../../../utils/url-state';
import { US_STATES, loadOptions, stateName } from '../../../utils/options';

interface CompositionRow {
  year: number;
  group: string;
  count: number;
  total: number;
  share: number;
}
interface CompositionData {
  rows: CompositionRow[];
  years: number[];
}
type ScopeKind = 'national' | 'diocese' | 'state';
interface Scope {
  kind: ScopeKind;
  place: string;   // diocese name or state abbr; '' for national
  year: number;
  color: string;
  label: string;
  /** Records in this place and year; null until loaded. */
  total: number | null;
}

/** Places travel in the URL as `d:NewYorkCity:1864,s:IA:1864,n::1870`. */
const KIND_CODES: Record<ScopeKind, string> = { national: 'n', diocese: 'd', state: 's' };
const DEFAULTS = { places: 'd:NewYorkCity:1864,d:Dubuque:1864', mode: 'share' };

@Component({
  selector: 'app-comparison-dashboard',
  imports: [MatIconModule, SpaceNamePipe, DashboardShellComponent, ControlBarComponent, VizPanelComponent, SegmentedComponent],
  templateUrl: './comparison.component.html',
  styleUrl: './comparison.component.scss'
})
export class ComparisonDashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('chart', { static: true }) chartRef!: ElementRef<HTMLDivElement>;

  readonly related = [
    { label: 'Comparing People', link: '/dashboards/people-comparison' },
    { label: 'The Shape of the Church', link: '/dashboards/composition' },
    { label: 'A Part Against the Whole', link: '/dashboards/subset-vs-whole' },
    { label: 'Diocese by Diocese', link: '/dashboards/diocese-tracker' },
  ];
  readonly modes = [{ value: 'share', label: 'Share' }, { value: 'count', label: 'Count' }];
  readonly kinds: { value: ScopeKind; label: string }[] = [
    { value: 'national', label: 'National' }, { value: 'diocese', label: 'Diocese' }, { value: 'state', label: 'State' },
  ];
  readonly usStates = US_STATES;
  readonly maxScopes = 4;
  dioceseOptions: string[] = [];

  state = { ...DEFAULTS };
  vizState: VizState = 'loading';
  takeaway = '';
  years: number[] = [];
  scopes: Scope[] = [];

  private readonly scopeColors = ['#2f6f9f', '#d98a2b', '#3f9e7a', '#9b4f9e'];
  private cache = new Map<string, CompositionData>();
  private url: UrlState<typeof DEFAULTS>;
  private subs: Subscription[] = [];
  private fetchSub?: Subscription;
  private resizeObserver?: ResizeObserver;
  private lastWidth = 0;

  private readonly entity: string = 'institutions';
  private readonly noun = { one: 'institution', many: 'institutions' };
  private readonly buckets = [
    'religious institutions', 'educational institutions', 'consecrated life institutions',
    'charitable institutions', 'healthcare institutions', 'other'
  ];
  private readonly labels: Record<string, string> = {
    'religious institutions': 'Religious',
    'educational institutions': 'Educational',
    'consecrated life institutions': 'Consecrated life',
    'charitable institutions': 'Charitable',
    'healthcare institutions': 'Healthcare',
    'other': 'Other'
  };

  constructor(private api: ApiService, private http: HttpClient, router: Router, route: ActivatedRoute) {
    this.url = new UrlState(router, route, DEFAULTS);
  }

  ngOnInit(): void {
    this.subs.push(loadOptions(this.http, 'diocese.csv').subscribe(o => this.dioceseOptions = o));
    // Places change what is fetched (cached per place); Share/Count just redraws.
    this.subs.push(this.url.changes().subscribe(state => {
      const placesChanged = state.places !== this.state.places || !this.scopes.length;
      this.state = state;
      if (placesChanged) {
        this.scopes = this.parse(state.places);
        this.load();
      } else {
        this.render();
      }
    }));
  }

  ngAfterViewInit(): void {
    this.resizeObserver = new ResizeObserver(() => {
      const w = this.chartRef.nativeElement.clientWidth;
      if (w > 0 && w !== this.lastWidth) this.render();
    });
    this.resizeObserver.observe(this.chartRef.nativeElement);
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    this.fetchSub?.unsubscribe();
    this.resizeObserver?.disconnect();
  }

  // ---- controls -------------------------------------------------------------

  setMode(mode: string): void {
    this.url.set({ mode });
  }

  setKind(i: number, kind: string): void {
    this.update(i, { kind: kind as ScopeKind, place: '' });
  }

  setPlace(i: number, place: string): void {
    this.update(i, { place });
  }

  setYear(i: number, year: string): void {
    this.update(i, { year: Number(year) });
  }

  addScope(): void {
    if (this.scopes.length >= this.maxScopes) return;
    const year = this.years[this.years.length - 1] ?? 1870;
    this.write([...this.scopes, { kind: 'national', place: '', year } as Scope]);
  }

  removeScope(i: number): void {
    if (this.scopes.length <= 1) return;
    this.write(this.scopes.filter((_, j) => j !== i));
  }

  private update(i: number, patch: Partial<Scope>): void {
    this.write(this.scopes.map((s, j) => j === i ? { ...s, ...patch } : s));
  }

  private write(scopes: Pick<Scope, 'kind' | 'place' | 'year'>[]): void {
    this.url.set({ places: scopes.map(s => `${KIND_CODES[s.kind]}:${s.place}:${s.year}`).join(',') });
  }

  private parse(places: string): Scope[] {
    const byCode = Object.fromEntries(Object.entries(KIND_CODES).map(([k, c]) => [c, k as ScopeKind]));
    const scopes = places.split(',').map(p => p.split(':'))
      .filter(([code]) => byCode[code])
      .slice(0, this.maxScopes)
      .map(([code, place, year], i) => {
        const kind = byCode[code];
        const s: Scope = { kind, place: kind === 'national' ? '' : (place ?? ''), year: Number(year) || 1870, color: this.scopeColors[i], label: '', total: null };
        s.label = this.labelFor(s);
        return s;
      });
    return scopes.length ? scopes : this.parse(DEFAULTS.places);
  }

  isReady(scope: Scope): boolean {
    return scope.kind === 'national' || !!scope.place;
  }

  private labelFor(scope: Pick<Scope, 'kind' | 'place' | 'year'>): string {
    const place = scope.kind === 'national' ? 'National'
      : scope.kind === 'diocese' ? spaceName(scope.place) : stateName(scope.place);
    return `${place} ${scope.year}`;
  }

  // ---- data -----------------------------------------------------------------

  private placeKey(scope: Scope): string {
    return scope.kind === 'national' ? 'national' : `${scope.kind}:${scope.place}`;
  }

  private queryFor(scope: Scope): string {
    const q = new URLSearchParams();
    if (this.entity !== 'institutions') q.set('entity', this.entity);
    if (scope.kind !== 'national') q.set(scope.kind, scope.place);
    return 'stats/composition' + (q.toString() ? '?' + q : '');
  }

  /** Fetches national (for the year list) and any place not yet cached, then renders. */
  load(): void {
    const national = { kind: 'national', place: '', year: 0 } as Scope;
    const wanted = [national, ...this.scopes.filter(s => this.isReady(s))];
    const missing = [...new Map(wanted.filter(s => !this.cache.has(this.placeKey(s))).map(s => [this.placeKey(s), s])).values()];
    this.fetchSub?.unsubscribe();
    if (!missing.length) { this.afterLoad(); return; }
    this.vizState = 'loading';
    this.fetchSub = forkJoin(missing.map(s => this.api.getTypeRequest(this.queryFor(s)))).subscribe({
      next: (results: any[]) => {
        results.forEach((res, i) => this.cache.set(this.placeKey(missing[i]), { rows: res.rows ?? [], years: res.meta?.years ?? [] }));
        this.afterLoad();
      },
      error: () => this.vizState = 'error',
    });
  }

  private afterLoad(): void {
    this.years = this.cache.get('national')?.years ?? [];
    for (const s of this.scopes) {
      const data = this.isReady(s) ? this.cache.get(this.placeKey(s)) : undefined;
      s.total = data ? (data.rows.find(r => r.year === s.year)?.total ?? 0) : null;
    }
    this.takeaway = this.computeTakeaway();
    this.vizState = this.categories().length ? 'ready' : 'empty';
    requestAnimationFrame(() => this.render());
  }

  private valueFor(scope: Scope, bucket: string): { count: number; share: number } {
    const row = this.cache.get(this.placeKey(scope))?.rows.find(r => r.year === scope.year && r.group === bucket);
    return row ? { count: row.count, share: row.share } : { count: 0, share: 0 };
  }

  private active(): Scope[] {
    return this.scopes.filter(s => this.isReady(s) && this.cache.has(this.placeKey(s)));
  }

  /** Function categories with a value in at least one place. */
  private categories(): string[] {
    const active = this.active();
    return this.buckets.filter(b => active.some(s => this.valueFor(s, b).count > 0));
  }

  /** The category whose share differs most between the first two places. */
  private computeTakeaway(): string {
    const [a, b] = this.active().filter(s => s.total);
    if (!a || !b) return '';
    const top = this.buckets.filter(k => k !== 'other')
      .map(k => ({ k, a: this.valueFor(a, k).share, b: this.valueFor(b, k).share }))
      .sort((p, q) => Math.abs(q.a - q.b) - Math.abs(p.a - p.b))[0];
    if (!top || Math.abs(top.a - top.b) < 0.02) return '';
    const pct = (v: number) => `${Math.round(v * 100)}%`;
    return `${this.capital(top.k)} made up ${pct(top.a)} of those recorded in ${a.label}, against ${pct(top.b)} in ${b.label}.`;
  }

  private capital(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // ---- chart ----------------------------------------------------------------

  private render(): void {
    const host = this.chartRef?.nativeElement;
    if (!host || host.clientWidth === 0) return;
    d3.select(host).selectAll('*').remove();
    const active = this.active();
    const categories = this.categories();
    if (!active.length || !categories.length) return;

    const width = host.clientWidth;
    this.lastWidth = width;
    const compact = width < 560;
    const margin = { top: 12, right: 8, bottom: compact ? 64 : 34, left: compact ? 40 : 56 };
    const height = Math.round(Math.min(440, Math.max(300, width * 0.5)));
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;
    const isShare = this.state.mode === 'share';

    const svg = d3.select(host).append('svg').attr('width', width).attr('height', height)
      .attr('role', 'img').attr('aria-label', `${this.capital(this.noun.many)} by function: ${active.map(s => s.label).join(', ')}`);
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const x0 = d3.scaleBand<string>().domain(categories).range([0, innerW]).paddingInner(0.25);
    const x1 = d3.scaleBand<number>().domain(active.map((_, i) => i)).range([0, x0.bandwidth()]).padding(0.06);
    const maxVal = d3.max(active, s => d3.max(categories, b => isShare ? this.valueFor(s, b).share : this.valueFor(s, b).count)) ?? 1;
    const y = d3.scaleLinear().domain([0, maxVal || 1]).nice().range([innerH, 0]);

    const yTicks = y.ticks(5);
    g.append('g').attr('class', 'gridline').selectAll('line').data(yTicks).join('line')
      .attr('x1', 0).attr('x2', innerW).attr('y1', d => y(d)).attr('y2', d => y(d));
    g.append('g').call(d3.axisLeft(y).tickValues(yTicks).tickSize(0).tickPadding(6)
      .tickFormat(isShare ? d3.format('.0%') : d3.format('~s')))
      .call(sel => sel.select('.domain').remove());

    // Category labels: rotated on narrow screens so they never collide.
    const xAxis = g.append('g').attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x0).tickSize(0).tickPadding(8).tickFormat(d => this.labels[d] ?? d));
    xAxis.selectAll('text').style('font-size', '11px');
    if (compact) {
      xAxis.selectAll('text').attr('transform', 'rotate(-35)').style('text-anchor', 'end').attr('dx', '-0.2em').attr('dy', '0.6em');
    }

    const tooltip = d3.select(host).append('div').attr('class', 'chart-tooltip');
    for (const bucket of categories) {
      const groupG = g.append('g').attr('transform', `translate(${x0(bucket)},0)`);
      active.forEach((scope, i) => {
        const v = this.valueFor(scope, bucket);
        const val = isShare ? v.share : v.count;
        groupG.append('rect')
          .attr('x', x1(i)!).attr('width', x1.bandwidth())
          .attr('y', y(val)).attr('height', Math.max(0, innerH - y(val)))
          .attr('fill', scope.color)
          .on('mousemove', (event: MouseEvent) => {
            const [mx, my] = d3.pointer(event, host);
            tooltip.style('opacity', '1')
              .style('left', `${Math.min(mx + 12, width - 200)}px`).style('top', `${my + 12}px`)
              .html(`<strong>${scope.label}</strong><br>` +
                `${this.labels[bucket]}: ${v.count.toLocaleString()} ${v.count === 1 ? this.noun.one : this.noun.many} (${(v.share * 100).toFixed(1)}%)`);
          })
          .on('mouseleave', () => tooltip.style('opacity', '0'));
      });
    }
  }
}
