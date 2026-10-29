import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import * as d3 from 'd3';

import { ApiService } from '../../../services/api.service';
import { MapVisComponent } from '../../common/map-vis/map-vis.component';
import { FUNCTION_COLORS, OTHER_COLOR } from '../../common/map-vis/map-grouping';
import { DashboardShellComponent } from '../../common/dashboard-shell/dashboard-shell.component';
import { ControlBarComponent, ControlChip } from '../../common/control-bar/control-bar.component';
import { VizPanelComponent, VizState } from '../../common/viz-panel/viz-panel.component';
import { SegmentedComponent } from '../../common/segmented/segmented.component';
import { YearPlayerComponent } from '../../common/year-player/year-player.component';
import { UrlState } from '../../../utils/url-state';
import { yearScale, drawYearAxis } from '../../../utils/year-scale';

interface GeoPoint {
  year: number;
  lat: number;
  lng: number;
  fn: string;
  weight: number;
  i?: string;   // institution id (detail mode) — enables click-through
}
interface Centroid { year: number; total: number; lat: number; lng: number; }

// The six function buckets the server tags points with, in legend order.
// `id` is the short form kept in the URL (`hide=educational,other`).
const FUNCTIONS = [
  { id: 'religious', key: 'religious institutions', label: 'Religious' },
  { id: 'educational', key: 'educational institutions', label: 'Educational' },
  { id: 'consecrated', key: 'consecrated life institutions', label: 'Consecrated life' },
  { id: 'charitable', key: 'charitable institutions', label: 'Charitable' },
  { id: 'healthcare', key: 'healthcare institutions', label: 'Healthcare' },
  { id: 'other', key: 'other', label: 'Other' },
].map(f => ({ ...f, color: FUNCTION_COLORS[f.key] ?? OTHER_COLOR }));

const MAP_VIEWS = [
  { value: 'heatmap', label: 'Heatmap' },
  { value: 'point', label: 'Points' },
  { value: 'bins', label: 'Grid' },
  { value: 'cluster', label: 'Clusters' },
];

const DEFAULTS = { entity: 'institutions', year: 0, hide: '', view: 'heatmap' };
const MILES_PER_DEG = 69.17;
const COMPASS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];

@Component({
  selector: 'app-spread-dashboard',
  imports: [DecimalPipe, MapVisComponent, DashboardShellComponent, ControlBarComponent, VizPanelComponent,
    SegmentedComponent, YearPlayerComponent],
  templateUrl: './spread.component.html',
  styleUrl: './spread.component.scss'
})
export class SpreadDashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('drift', { static: true }) driftRef!: ElementRef<HTMLDivElement>;
  @ViewChild(MapVisComponent) mapVis?: MapVisComponent;

  readonly related = [
    { label: 'Diocese by Diocese', link: '/dashboards/diocese-tracker' },
    { label: 'Coverage — the Shape of the Data', link: '/dashboards/coverage' },
    { label: 'The Almanacs at a Glance', link: '/dashboards/overview' },
  ];
  readonly entities = [{ value: 'institutions', label: 'Institutions' }, { value: 'people', label: 'People' }];
  readonly functions = FUNCTIONS;
  readonly views = MAP_VIEWS;

  state = { ...DEFAULTS };
  vizState: VizState = 'loading';
  note = '';
  takeaway = '';
  chips: ControlChip[] = [];
  hidden = new Set<string>();

  years: number[] = [];
  year: number | null = null;
  current: Centroid | null = null;
  driftMiles = 0;
  driftDirection = '';

  mapData: any[] = [];
  centroidMarker: { lat: number; lng: number; color?: string; title?: string }[] = [];
  mapOptions = {
    // Narrow screens start zoomed out far enough to show the whole country.
    zoom: window.innerWidth < 640 ? 2 : 3.4,
    mode: 'heatmap' as 'heatmap' | 'point' | 'bins' | 'cluster',
    center: { lat: 39, lng: window.innerWidth < 640 ? -96 : -94 },
    size: { width: '100%', height: 'clamp(320px, 60vh, 600px)' }
  };

  private centroids: Centroid[] = [];
  private pointsByYear = new Map<number, GeoPoint[]>();
  private url: UrlState<typeof DEFAULTS>;
  private subs: Subscription[] = [];
  private fetchSub?: Subscription;
  private resizeObserver?: ResizeObserver;
  private lastWidth = 0;

  constructor(private api: ApiService, router: Router, route: ActivatedRoute) {
    this.url = new UrlState(router, route, DEFAULTS);
  }

  ngOnInit(): void {
    // Refetch only when the entity changes; year, functions and view just redraw.
    let entity: string | null = null;
    let first = true;
    this.subs.push(this.url.changes().subscribe(state => {
      const entityChanged = state.entity !== entity;
      entity = state.entity;
      if (first) this.mapOptions = { ...this.mapOptions, mode: state.view as any };
      else if (state.view !== this.state.view) this.mapVis?.changeMapMode(state.view);
      first = false;
      this.state = state;
      this.hidden = new Set(state.hide.split(',').filter(Boolean));
      this.chips = FUNCTIONS.filter(f => this.hidden.has(f.id))
        .map(f => ({ label: `Hidden: ${f.label}`, clear: () => this.toggleFunction(f.id) }));
      if (entityChanged) this.fetchData(); else this.update();
    }));
  }

  ngAfterViewInit(): void {
    this.resizeObserver = new ResizeObserver(() => {
      const w = this.driftRef.nativeElement.clientWidth;
      if (w > 0 && w !== this.lastWidth) this.renderDrift();
    });
    this.resizeObserver.observe(this.driftRef.nativeElement);
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    this.fetchSub?.unsubscribe();
    this.resizeObserver?.disconnect();
  }

  // ---- controls -------------------------------------------------------------

  setEntity(entity: string): void { this.url.set({ entity }); }
  setYear(year: number): void { this.url.set({ year }); }
  setView(view: string): void { this.url.set({ view }); }

  toggleFunction(id: string): void {
    const hidden = new Set(this.hidden);
    if (hidden.has(id)) hidden.delete(id);
    else if (hidden.size < FUNCTIONS.length - 1) hidden.add(id);   // keep at least one shown
    this.url.set({ hide: FUNCTIONS.filter(f => hidden.has(f.id)).map(f => f.id).join(',') });
  }

  clearAll = (): void => this.url.set({ hide: '' });

  get unit(): string {
    return this.state.entity === 'people' ? 'people' : 'institutions';
  }

  // ---- data -----------------------------------------------------------------

  fetchData(): void {
    this.vizState = 'loading';
    this.fetchSub?.unsubscribe();
    const detail = this.state.entity === 'institutions' ? '&detail=1' : '';
    this.fetchSub = this.api.getTypeRequest(`stats/geo?entity=${this.state.entity}${detail}`).subscribe({
      next: (res: any) => {
        this.years = (res.years ?? []).map((y: any) => y.year);
        this.note = res.meta?.note ?? '';
        this.pointsByYear = new Map();
        for (const p of (res.points ?? []) as GeoPoint[]) {
          const list = this.pointsByYear.get(p.year);
          if (list) list.push(p); else this.pointsByYear.set(p.year, [p]);
        }
        this.vizState = this.years.length ? 'ready' : 'empty';
        this.update();
      },
      error: () => this.vizState = 'error',
    });
  }

  private bucketId(fn: string): string {
    return FUNCTIONS.find(f => f.key === fn)?.id ?? 'other';
  }

  private shownPoints(year: number): GeoPoint[] {
    return (this.pointsByYear.get(year) ?? []).filter(p => !this.hidden.has(this.bucketId(p.fn)));
  }

  /** Recompute everything derived from the state: centroids, map, KPIs, takeaway, drift chart. */
  private update(): void {
    if (!this.years.length) return;
    this.year = this.years.includes(this.state.year) ? this.state.year : this.years[0];

    // The centre of gravity follows the function filter, so it is computed
    // here from the shown points (weighted mean of their positions).
    this.centroids = this.years.map(year => {
      let total = 0, lat = 0, lng = 0;
      for (const p of this.shownPoints(year)) {
        total += p.weight; lat += p.lat * p.weight; lng += p.lng * p.weight;
      }
      return { year, total, lat: total ? lat / total : NaN, lng: total ? lng / total : NaN };
    }).filter(c => c.total > 0);
    this.current = this.centroids.find(c => c.year === this.year) ?? null;

    const firstC = this.centroids[0];
    this.driftMiles = 0;
    this.driftDirection = '';
    if (firstC && this.current && this.current !== firstC) {
      const { miles, direction } = this.move(firstC, this.current);
      this.driftMiles = miles;
      this.driftDirection = direction;
    }

    this.mapData = this.shownPoints(this.year).map(p => ({
      latitude: p.lat,
      longitude: p.lng,
      title: '',
      // In Points / Clusters, clicking a point opens the institution.
      internalLink: p.i ? '/institutions/' + p.i : undefined,
      options: {
        color: FUNCTION_COLORS[p.fn] ?? OTHER_COLOR,
        value: p.weight,
        radius: Math.min(4 + Math.sqrt(p.weight) * 2, 14)
      }
    }));
    this.centroidMarker = this.current
      ? [{ lat: this.current.lat, lng: this.current.lng, color: '#ffc107', title: `Centre of gravity · ${this.current.year}` }]
      : [];
    this.takeaway = this.computeTakeaway();
    this.renderDrift();
  }

  /** Great-circle distance in miles and an 8-point compass direction from a to b. */
  private move(a: Centroid, b: Centroid): { miles: number; direction: string } {
    const rad = Math.PI / 180;
    const miles = Math.round(d3.geoDistance([a.lng, a.lat], [b.lng, b.lat]) * 3959);
    const dx = (b.lng - a.lng) * Math.cos(((a.lat + b.lat) / 2) * rad) * MILES_PER_DEG;
    const dy = (b.lat - a.lat) * MILES_PER_DEG;
    const bearing = (Math.atan2(dx, dy) / rad + 360) % 360;   // 0 = north, 90 = east
    return { miles, direction: COMPASS[Math.round(bearing / 45) % 8] };
  }

  private computeTakeaway(): string {
    const firstC = this.centroids[0];
    const cur = this.current;
    if (!firstC || !cur) return '';
    const who = this.hidden.size ? `the ${this.unit} shown` : `recorded ${this.unit}`;
    if (cur === firstC || this.driftMiles < 5) {
      const last = this.centroids[this.centroids.length - 1];
      const m = this.move(firstC, last);
      return `In ${cur.year} the centre of gravity of ${who} sat near ${this.coords(cur)}; by ${last.year} it had moved about ${m.miles.toLocaleString()} miles ${m.direction}.`;
    }
    return `Between ${firstC.year} and ${cur.year} the centre of gravity of ${who} moved about ${this.driftMiles.toLocaleString()} miles ${this.driftDirection}, from ${this.coords(firstC)} to ${this.coords(cur)}.`;
  }

  coords(c: Centroid): string {
    return `${Math.abs(c.lng).toFixed(1)}°${c.lng < 0 ? 'W' : 'E'}, ${Math.abs(c.lat).toFixed(1)}°${c.lat < 0 ? 'S' : 'N'}`;
  }

  // ---- westward-drift chart: centroid longitude by year, west at the top ----

  private renderDrift(): void {
    const host = this.driftRef?.nativeElement;
    if (!host || host.clientWidth === 0) return;
    d3.select(host).selectAll('*').remove();
    if (!this.centroids.length) return;

    const width = host.clientWidth;
    this.lastWidth = width;
    const compact = width < 520;
    const margin = { top: 22, right: 12, bottom: 30, left: compact ? 44 : 52 };
    const height = compact ? 170 : 200;
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;
    const data = this.centroids;

    const svg = d3.select(host).append('svg').attr('width', width).attr('height', height)
      .attr('role', 'img')
      .attr('aria-label', `Longitude of the centre of gravity by year, ${data[0].year}–${data[data.length - 1].year}`);
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const x = yearScale(this.years, [0, innerW]);
    // West is more negative longitude: the westernmost value maps to the top.
    const [lo, hi] = d3.extent(data, d => d.lng) as [number, number];
    const y = d3.scaleLinear().domain([lo - 0.3, hi + 0.3]).nice(4).range([0, innerH]);

    const yTicks = y.ticks(4);
    g.append('g').attr('class', 'gridline').selectAll('line').data(yTicks).join('line')
      .attr('x1', 0).attr('x2', innerW).attr('y1', d => y(d)).attr('y2', d => y(d));
    g.append('g').call(d3.axisLeft(y).tickValues(yTicks).tickSize(0).tickPadding(6)
      .tickFormat(d => `${Math.abs(+d).toFixed(0)}°${+d < 0 ? 'W' : 'E'}`))
      .call(sel => sel.select('.domain').remove());
    g.append('text').attr('x', -margin.left).attr('y', -10)
      .style('font-size', '11px').style('font-weight', '600')
      .text('↑ Further west');
    drawYearAxis(g, x, innerH, { minSpacing: compact ? 40 : 36 });

    // One line per run of consecutive years, so the gap isn't bridged.
    const line = d3.line<Centroid>().x(d => x(d.year)).y(d => y(d.lng));
    const runs: Centroid[][] = [];
    data.forEach((d, i) => {
      if (i === 0 || d.year - data[i - 1].year > 1) runs.push([d]); else runs[runs.length - 1].push(d);
    });
    g.append('g').selectAll('path').data(runs).join('path')
      .attr('fill', 'none').attr('stroke', 'var(--c-place)').attr('stroke-width', 2).attr('d', line);

    const tooltip = d3.select(host).append('div').attr('class', 'chart-tooltip');
    g.append('g').selectAll('circle').data(data).join('circle')
      .attr('cx', d => x(d.year)).attr('cy', d => y(d.lng))
      .attr('r', d => d.year === this.year ? 6 : 3.5)
      .attr('fill', d => d.year === this.year ? 'var(--c-year)' : 'var(--c-place)')
      .attr('stroke', 'var(--surface)').attr('stroke-width', 1.5)
      .style('cursor', 'pointer')
      .on('click', (_e, d) => this.setYear(d.year))
      .on('mousemove', (event: MouseEvent, d) => {
        const [mx, my] = d3.pointer(event, host);
        tooltip.style('opacity', '1')
          .style('left', `${Math.min(mx + 12, width - 200)}px`).style('top', `${my + 12}px`)
          .html(`<strong>${d.year}</strong><br>Centre of gravity ${this.coords(d)}<br>${d.total.toLocaleString()} ${this.unit}`);
      })
      .on('mouseleave', () => tooltip.style('opacity', '0'));
  }
}
