import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { DecimalPipe, PercentPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import * as d3 from 'd3';

import { ApiService } from '../../../services/api.service';
import { MapVisComponent } from '../../common/map-vis/map-vis.component';
import { DashboardShellComponent } from '../../common/dashboard-shell/dashboard-shell.component';
import { ControlBarComponent, ControlChip } from '../../common/control-bar/control-bar.component';
import { SegmentedComponent } from '../../common/segmented/segmented.component';
import { VizPanelComponent, VizState } from '../../common/viz-panel/viz-panel.component';
import { YearPlayerComponent } from '../../common/year-player/year-player.component';
import { UrlState } from '../../../utils/url-state';
import { yearScale, drawYearAxis } from '../../../utils/year-scale';
import { INKS } from '../../../utils/palette';

/** GET /api/stats/railroads */
interface RailroadsResponse {
  years: { year: number; n: number; nearRail: number; nearWater: number; nearEither: number; nearTrail: number; medianRail: number | null; bands: number[]; trailBands: number[] }[];
  /** for the requested year: [lat, lng, railMiles|null, instID, trailMiles|null, isNew 0|1 (first listed that year)] */
  points: [number, number, number | null, string, number | null, number?][];
  dioceses: Record<string, string>;
  /** trails: whether the trail distances are built on this server */
  meta: { nearMiles: number; bands: number[]; trails: boolean };
}
type YearRow = RailroadsResponse['years'][number];

const FUNCTIONS = [
  { id: 'religious', key: 'religious institutions', label: 'Religious' },
  { id: 'educational', key: 'educational institutions', label: 'Educational' },
  { id: 'consecrated', key: 'consecrated life institutions', label: 'Consecrated life' },
  { id: 'charitable', key: 'charitable institutions', label: 'Charitable' },
  { id: 'healthcare', key: 'healthcare institutions', label: 'Healthcare' },
  { id: 'other', key: 'other', label: 'Other' },
];

/** Distance to a railroad (or a trail), near to far: slate on the line, ochre far from any. */
const BANDS = [
  { label: 'Within 1 mile', color: INKS[0] },
  { label: '1–5 miles', color: '#6f88a8' },
  { label: '5–15 miles', color: INKS[5] },
  { label: '15–50 miles', color: '#dcb36a' },
  { label: 'Farther, or none yet', color: INKS[1] },
];
const RAIL_INK = INKS[0];
const WATER_INK = INKS[7];

/** by: what the map and the bands measure the distance to. */
const DEFAULTS = { year: 0, diocese: '', fn: '', by: 'rail' };

@Component({
  selector: 'app-rails-rivers',
  imports: [DecimalPipe, PercentPipe, MapVisComponent, DashboardShellComponent, ControlBarComponent, SegmentedComponent,
    VizPanelComponent, YearPlayerComponent],
  templateUrl: './rails-rivers.component.html',
  styleUrl: './rails-rivers.component.scss'
})
export class RailsRiversComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('trend', { static: true }) trendRef!: ElementRef<HTMLDivElement>;
  @ViewChild('bandChart', { static: true }) bandsRef!: ElementRef<HTMLDivElement>;

  readonly related = [
    { label: 'Mission Circuits', link: '/dashboards/circuits' },
    { label: 'The Spread of the Church', link: '/dashboards/spread' },
    { label: 'Coverage — the Shape of the Data', link: '/dashboards/coverage' },
  ];
  readonly functions = FUNCTIONS;
  readonly byOptions = [{ value: 'rail', label: 'A railroad' }, { value: 'trail', label: 'A trail or road' }];
  readonly bands = BANDS;
  readonly railInk = RAIL_INK;
  /** The historic trails the map draws beside the railroads (the style's trail ink). */
  readonly trailInk = INKS[6];
  readonly waterInk = WATER_INK;

  state = { ...DEFAULTS };
  vizState: VizState = 'loading';
  /** The distances aren't built on this server (no transport tiles). */
  notBuilt = false;
  takeaway = '';
  chips: ControlChip[] = [];
  dioceseOptions: { id: string; name: string }[] = [];

  years: number[] = [];
  year: number | null = null;
  rows: YearRow[] = [];
  current: YearRow | null = null;
  nearMiles = 5;
  /** The trail distances are built here (tiles-build trails with the database). */
  hasTrails = false;

  mapData: any[] = [];
  readonly mapOptions = {
    mode: 'point' as const,
    zoom: window.innerWidth < 640 ? 2 : 3.4,
    center: { lat: 39, lng: window.innerWidth < 640 ? -96 : -94 },
    size: { width: '100%', height: 'clamp(320px, 62vh, 620px)' },
  };

  private data: RailroadsResponse | null = null;
  private url: UrlState<typeof DEFAULTS>;
  private subs: Subscription[] = [];
  private fetchSub?: Subscription;
  private resizeObserver?: ResizeObserver;
  private lastWidth = 0;

  constructor(private api: ApiService, router: Router, route: ActivatedRoute) {
    this.url = new UrlState(router, route, DEFAULTS);
  }

  ngOnInit(): void {
    this.subs.push(this.url.changes().subscribe(state => {
      // the measure switch is page-only: no new data, just recolour and redraw
      const byOnly = !!this.data && state.by !== this.state.by && state.year === this.state.year
        && state.diocese === this.state.diocese && state.fn === this.state.fn;
      this.state = state;
      if (byOnly) { this.update(this.year ?? 0); this.renderCharts(); return; }
      this.chips = [
        ...(state.diocese ? [{ label: `Diocese: ${this.data?.dioceses[state.diocese] ?? state.diocese}`, clear: () => this.url.set({ diocese: '' }) }] : []),
        ...(state.fn ? [{ label: `Function: ${FUNCTIONS.find(f => f.key === state.fn)?.label ?? state.fn}`, clear: () => this.url.set({ fn: '' }) }] : []),
      ];
      this.fetchData();
    }));
  }

  ngAfterViewInit(): void {
    this.resizeObserver = new ResizeObserver(() => {
      const w = this.trendRef.nativeElement.clientWidth;
      if (w > 0 && w !== this.lastWidth) this.renderCharts();
    });
    this.resizeObserver.observe(this.trendRef.nativeElement);
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    this.fetchSub?.unsubscribe();
    this.resizeObserver?.disconnect();
  }

  // ---- controls -------------------------------------------------------------

  setYear(year: number): void { this.url.set({ year }); }
  setDiocese(diocese: string): void { this.url.set({ diocese }); }
  setFunction(fn: string): void { this.url.set({ fn }); }
  setBy(by: string): void { this.url.set({ by }); }
  clearAll = (): void => this.url.set({ diocese: '', fn: '' });

  // ---- data -----------------------------------------------------------------

  /** One request per state: the yearly figures plus the chosen year's points (cached server-side). */
  fetchData(): void {
    if (!this.data) this.vizState = 'loading';
    this.fetchSub?.unsubscribe();
    const year = this.state.year || (this.years.length ? this.years[this.years.length - 1] : 0);
    const q = new URLSearchParams();
    if (this.state.diocese) q.set('diocese', this.state.diocese);
    if (this.state.fn) q.set('fn', this.state.fn);
    if (year) q.set('year', String(year));
    this.fetchSub = this.api.getTypeRequest(`stats/railroads?${q}`).pipe(
      catchError(err => { this.notBuilt = err?.status === 404; return of(null); }),
    ).subscribe((res: any) => {
      if (!res) {
        this.vizState = this.notBuilt ? 'empty' : 'error';
        return;
      }
      this.data = res as RailroadsResponse;
      this.nearMiles = this.data.meta.nearMiles;
      this.hasTrails = !!this.data.meta.trails;
      this.dioceseOptions = Object.entries(this.data.dioceses)
        .filter(([id]) => id !== 'unknown')
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name));
      this.rows = this.data.years;
      this.years = this.rows.map(r => r.year);
      // first load without a year: ask again for the latest year's points
      if (!year && this.years.length) {
        this.state = { ...this.state, year: this.years[this.years.length - 1] };
        this.fetchData();
        return;
      }
      this.vizState = this.rows.length ? 'ready' : 'empty';
      this.update(year);
    });
  }

  private update(year: number): void {
    this.year = this.years.includes(year) ? year : this.years[this.years.length - 1] ?? null;
    this.current = this.rows.find(r => r.year === this.year) ?? null;
    const bandOf = (miles: number | null) => miles == null ? 4 : miles <= 1 ? 0 : miles <= 5 ? 1 : miles <= 15 ? 2 : miles <= 50 ? 3 : 4;
    const byTrail = this.state.by === 'trail' && this.hasTrails;
    const what = byTrail ? 'a trail or road' : 'a railroad';
    this.mapData = (this.data?.points ?? []).map(([lat, lng, rail, id, trail, isNew]) => {
      const miles = byTrail ? trail : rail;
      return {
        latitude: lat, longitude: lng,
        title: miles == null ? `No ${what} in use within 500 miles` : `${miles} mi from ${what}`,
        internalLink: `/institutions/${id}?year=${this.year}`,
        options: { color: BANDS[bandOf(miles)].color, radius: 4, isNew: !!isNew },
      };
    });
    this.takeaway = this.computeTakeaway();
    this.renderCharts();
  }

  share(n: number, of: number): number {
    return of ? n / of : 0;
  }

  private computeTakeaway(): string {
    const cur = this.current;
    const first = this.rows[0];
    if (!cur || !first) return '';
    const pct = (r: YearRow, k: 'nearRail' | 'nearWater' | 'nearTrail') => Math.round(100 * r[k] / (r.n || 1));
    const scope = this.state.diocese ? ` in the Diocese of ${this.data!.dioceses[this.state.diocese]}` : '';
    const lead = `In ${cur.year}, ${pct(cur, 'nearRail')}% of the institutions recorded${scope} stood within ${this.nearMiles} miles of a working railroad`;
    const trails = this.hasTrails ? ` Within ${this.nearMiles} miles of a historic trail or wagon road: ${pct(cur, 'nearTrail')}%.` : '';
    if (cur === first) return `${lead}, and ${pct(cur, 'nearWater')}% within ${this.nearMiles} miles of a canal or steamboat river.${trails}`;
    return `${lead}, against ${pct(first, 'nearRail')}% in ${first.year}; near a canal or steamboat river: ${pct(cur, 'nearWater')}%, against ${pct(first, 'nearWater')}%.${trails}`;
  }

  // ---- charts -----------------------------------------------------------------

  private renderCharts(): void {
    this.renderTrend();
    this.renderBands();
  }

  /** Share within NEAR miles of a railroad, and of a canal or steamboat river, by year. */
  private renderTrend(): void {
    const host = this.trendRef?.nativeElement;
    if (!host || host.clientWidth === 0) return;
    d3.select(host).selectAll('*').remove();
    if (!this.rows.length) return;

    const width = host.clientWidth;
    this.lastWidth = width;
    const compact = width < 520;
    const margin = { top: 14, right: 12, bottom: 30, left: compact ? 40 : 46 };
    const height = compact ? 190 : 220;
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = d3.select(host).append('svg').attr('width', width).attr('height', height)
      .attr('role', 'img').attr('aria-label', `Share of institutions within ${this.nearMiles} miles of a railroad, and of a canal or steamboat river, by year`);
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    const x = yearScale(this.years, [0, innerW]);
    const y = d3.scaleLinear().domain([0, 1]).range([innerH, 0]);
    const yTicks = [0, 0.25, 0.5, 0.75, 1];
    g.append('g').attr('class', 'gridline').selectAll('line').data(yTicks).join('line')
      .attr('x1', 0).attr('x2', innerW).attr('y1', d => y(d)).attr('y2', d => y(d));
    g.append('g').call(d3.axisLeft(y).tickValues(yTicks).tickSize(0).tickPadding(6).tickFormat(d3.format('.0%')))
      .call(sel => sel.select('.domain').remove());
    drawYearAxis(g, x, innerH, { minSpacing: compact ? 40 : 36 });

    const series = [
      { key: 'nearRail' as const, color: RAIL_INK, label: 'railroad', dash: null },
      // dashed as well as teal: slate and teal are close in hue
      { key: 'nearWater' as const, color: WATER_INK, label: 'canal or steamboat river', dash: '5 3' },
      ...(this.hasTrails ? [{ key: 'nearTrail' as const, color: this.trailInk, label: 'historic trail or wagon road', dash: '1 3' }] : []),
    ];
    for (const s of series) {
      const pts = this.rows.map(r => ({ year: r.year, v: r[s.key] / (r.n || 1) }));
      // one line per run of consecutive years, so the gap isn't bridged
      const runs: typeof pts[] = [];
      pts.forEach((p, i) => { if (i === 0 || p.year - pts[i - 1].year > 1) runs.push([p]); else runs[runs.length - 1].push(p); });
      const line = d3.line<{ year: number; v: number }>().x(d => x(d.year)).y(d => y(d.v));
      g.append('g').selectAll('path').data(runs).join('path')
        .attr('fill', 'none').attr('stroke', s.color).attr('stroke-width', 2).attr('stroke-dasharray', s.dash).attr('d', line);
      g.append('g').selectAll('circle').data(pts).join('circle')
        .attr('cx', d => x(d.year)).attr('cy', d => y(d.v))
        .attr('r', d => d.year === this.year ? 5.5 : 3)
        .attr('fill', d => d.year === this.year ? 'var(--c-year)' : s.color)
        .attr('stroke', 'var(--surface)').attr('stroke-width', 1.5)
        .style('cursor', 'pointer')
        .on('click', (_e, d) => this.setYear(d.year))
        .append('title').text(d => `${d.year}: ${Math.round(d.v * 100)}% within ${this.nearMiles} miles of a ${s.label}`);
    }
  }

  /** The chosen year's institutions by distance to a railroad. */
  private renderBands(): void {
    const host = this.bandsRef?.nativeElement;
    if (!host || host.clientWidth === 0) return;
    d3.select(host).selectAll('*').remove();
    const cur = this.current;
    if (!cur) return;

    const width = host.clientWidth;
    const rowH = 26;
    const labelW = Math.min(150, width * 0.38);
    const height = BANDS.length * rowH + 6;
    const byTrail = this.state.by === 'trail' && this.hasTrails;
    const counts = byTrail ? cur.trailBands : cur.bands;
    const svg = d3.select(host).append('svg').attr('width', width).attr('height', height)
      .attr('role', 'img').attr('aria-label', `Institutions in ${cur.year} by distance to ${byTrail ? 'a trail or road' : 'a railroad'}`);
    const x = d3.scaleLinear().domain([0, Math.max(1, d3.max(counts) ?? 1)]).range([0, width - labelW - 70]);
    const rows = svg.selectAll('g').data(BANDS.map((b, i) => ({ ...b, n: counts[i] }))).join('g')
      .attr('transform', (_d, i) => `translate(0,${i * rowH})`);
    rows.append('text').attr('x', 0).attr('y', rowH / 2).attr('dy', '0.35em')
      .attr('class', 'band-label').text(d => d.label);
    rows.append('rect').attr('x', labelW).attr('y', 5).attr('height', rowH - 10)
      .attr('width', d => x(d.n)).attr('fill', d => d.color);
    rows.append('text').attr('x', d => labelW + x(d.n) + 6).attr('y', rowH / 2).attr('dy', '0.35em')
      .attr('class', 'band-value').text(d => `${d.n.toLocaleString()} (${Math.round(100 * d.n / (cur.n || 1))}%)`);
  }
}
