import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import * as d3 from 'd3';

import { ApiService } from '../../../services/api.service';
import { MapVisComponent } from '../../common/map-vis/map-vis.component';
import { PALETTE, OTHER_COLOR } from '../../common/map-vis/map-grouping';
import { spaceName } from '../../../pipes/space-name.pipe';
import { DashboardShellComponent } from '../../common/dashboard-shell/dashboard-shell.component';
import { ControlBarComponent, ControlChip } from '../../common/control-bar/control-bar.component';
import { VizPanelComponent, VizState } from '../../common/viz-panel/viz-panel.component';
import { YearPlayerComponent } from '../../common/year-player/year-player.component';
import { UrlState } from '../../../utils/url-state';
import { yearScale, drawYearAxis } from '../../../utils/year-scale';

interface DioceseCat { key: string; total: number; name?: string; }
interface GeoPoint { year: number; lat: number; lng: number; diocese: string; weight: number; }
interface DioceseEntry { key: string; name: string; color: string; count: number; }

const MAP_VIEWS = [
  { value: 'point', label: 'Points' },
  { value: 'heatmap', label: 'Heatmap' },
  { value: 'bins', label: 'Grid' },
  { value: 'cluster', label: 'Clusters' },
];

const DEFAULTS = { diocese: '', year: 0, view: 'point' };

@Component({
  selector: 'app-diocese-tracker-dashboard',
  imports: [DecimalPipe, MapVisComponent, DashboardShellComponent, ControlBarComponent, VizPanelComponent, YearPlayerComponent],
  templateUrl: './diocese-tracker.component.html',
  styleUrl: './diocese-tracker.component.scss'
})
export class DioceseTrackerDashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('growth', { static: true }) growthRef!: ElementRef<HTMLDivElement>;
  @ViewChild(MapVisComponent) mapVis?: MapVisComponent;

  readonly related = [
    { label: 'The Spread of the Church', link: '/dashboards/spread' },
    { label: 'Coverage — the Shape of the Data', link: '/dashboards/coverage' },
    { label: 'Comparing Places', link: '/dashboards/comparison' },
  ];
  readonly views = MAP_VIEWS;

  state = { ...DEFAULTS };
  vizState: VizState = 'loading';
  takeaway = '';
  chips: ControlChip[] = [];

  years: number[] = [];
  year: number | null = null;
  /** Every diocese, biggest first, with this year's count. */
  dioceses: DioceseEntry[] = [];
  visibleTotal = 0;
  activeCount = 0;
  selectedSpan = '';
  growthTitle = 'Dioceses represented';
  growthNote = '';

  mapData: any[] = [];
  mapOptions = {
    // Narrow screens start zoomed out far enough to show the whole country.
    zoom: window.innerWidth < 640 ? 2 : 3.5,
    mode: 'point' as 'heatmap' | 'point' | 'bins' | 'cluster',
    center: { lat: 39, lng: window.innerWidth < 640 ? -96 : -94 },
    size: { width: '100%', height: 'clamp(320px, 60vh, 600px)' }
  };

  private pointsByYear = new Map<number, GeoPoint[]>();
  private dioceseColor: Record<string, string> = {};
  private dioceseName: Record<string, string> = {};   // canonical id -> display name
  private url: UrlState<typeof DEFAULTS>;
  private subs: Subscription[] = [];
  private fetchSub?: Subscription;
  private resizeObserver?: ResizeObserver;
  private lastWidth = 0;
  private focused: string | null = null;   // the diocese the map was last fitted to

  constructor(private api: ApiService, router: Router, route: ActivatedRoute) {
    this.url = new UrlState(router, route, DEFAULTS);
  }

  ngOnInit(): void {
    let first = true;
    this.subs.push(this.url.changes().subscribe(state => {
      if (first) this.mapOptions = { ...this.mapOptions, mode: state.view as any };
      else if (state.view !== this.state.view) this.mapVis?.changeMapMode(state.view);
      this.state = state;
      // The data is fetched once; every control just redraws.
      if (first) this.fetchData(); else this.update();
      first = false;
    }));
  }

  ngAfterViewInit(): void {
    this.resizeObserver = new ResizeObserver(() => {
      const w = this.growthRef.nativeElement.clientWidth;
      if (w > 0 && w !== this.lastWidth) this.renderGrowth();
    });
    this.resizeObserver.observe(this.growthRef.nativeElement);
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    this.fetchSub?.unsubscribe();
    this.resizeObserver?.disconnect();
  }

  // ---- controls -------------------------------------------------------------

  setDiocese(diocese: string): void { this.url.set({ diocese }); }
  toggleDiocese(diocese: string): void { this.url.set({ diocese: diocese === this.state.diocese ? '' : diocese }); }
  setYear(year: number): void { this.url.set({ year }); }
  setView(view: string): void { this.url.set({ view }); }
  clearAll = (): void => this.url.set({ diocese: '' });

  nameFor(diocese: string): string {
    return this.dioceseName[diocese] || spaceName(diocese);
  }

  // ---- data -----------------------------------------------------------------

  fetchData(): void {
    this.vizState = 'loading';
    this.fetchSub?.unsubscribe();
    this.fetchSub = this.api.getTypeRequest('stats/geo?by=diocese').subscribe({
      next: (res: any) => {
        this.years = (res.years ?? []).map((y: any) => y.year);
        const cats: DioceseCat[] = res.meta?.categories ?? [];
        // Palette colours go biggest-diocese-first, so the most prominent
        // jurisdictions get the most distinct colours (stable across years).
        this.dioceseColor = {};
        this.dioceseName = {};
        cats.forEach((d, i) => {
          this.dioceseColor[d.key] = PALETTE[i % PALETTE.length];
          this.dioceseName[d.key] = d.name || spaceName(d.key);
        });
        this.dioceses = cats.map(d => ({ key: d.key, name: this.dioceseName[d.key], color: this.dioceseColor[d.key], count: 0 }));
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

  private sum(year: number, diocese: string): number {
    return (this.pointsByYear.get(year) ?? []).reduce((s, p) => p.diocese === diocese ? s + p.weight : s, 0);
  }

  /** Recompute the map, key counts, KPIs, takeaway and chart for the current state. */
  private update(): void {
    if (!this.years.length) return;
    const year = this.years.includes(this.state.year) ? this.state.year : this.years[0];
    this.year = year;
    const sel = this.state.diocese;
    const all = this.pointsByYear.get(year) ?? [];
    const pts = sel ? all.filter(p => p.diocese === sel) : all;

    const counts = new Map<string, number>();
    for (const p of all) counts.set(p.diocese, (counts.get(p.diocese) ?? 0) + p.weight);
    this.dioceses = this.dioceses.map(d => ({ ...d, count: counts.get(d.key) ?? 0 }));
    this.activeCount = counts.size;
    this.visibleTotal = pts.reduce((s, p) => s + p.weight, 0);

    this.mapData = pts.map(p => ({
      latitude: p.lat,
      longitude: p.lng,
      title: this.nameFor(p.diocese),
      options: {
        color: this.dioceseColor[p.diocese] || OTHER_COLOR,
        value: p.weight,
        radius: Math.min(4 + Math.sqrt(p.weight) * 2, 14)
      }
    }));

    const present = sel ? this.years.filter(y => this.sum(y, sel) > 0) : [];
    this.selectedSpan = present.length ? `${present[0]}–${present[present.length - 1]}` : '';
    this.chips = sel ? [{ label: `Diocese: ${this.nameFor(sel)}`, clear: this.clearAll }] : [];
    this.growthTitle = sel ? `${this.nameFor(sel)}, by year` : 'Dioceses represented, by year';
    this.growthNote = sel ? 'Institutions recorded each year' : 'Dioceses with at least one institution recorded';
    this.takeaway = this.computeTakeaway(year, sel, present);
    this.renderGrowth();
    this.focusMap(sel);
  }

  /** Zoom to a newly selected see (all its years, so playing doesn't jump), or back out to the country. */
  private focusMap(sel: string): void {
    if (sel === this.focused || (this.focused === null && !sel)) {
      this.focused = sel;
      return;
    }
    this.focused = sel;
    let box: [number, number, number, number] = [-125, 24, -66, 50];
    if (sel) {
      const pts = [...this.pointsByYear.values()].flat().filter(p => p.diocese === sel);
      if (pts.length) {
        box = [d3.min(pts, p => p.lng)!, d3.min(pts, p => p.lat)!, d3.max(pts, p => p.lng)!, d3.max(pts, p => p.lat)!];
      }
    }
    setTimeout(() => this.mapVis?.fitToBounds(box, 40));
  }

  private computeTakeaway(year: number, sel: string, present: number[]): string {
    const n = (v: number, unit: string) => `${v.toLocaleString()} ${unit}${v === 1 ? '' : 's'}`;
    if (sel) {
      const name = this.nameFor(sel);
      if (!this.visibleTotal) {
        return present.length
          ? `The almanac records nothing for ${name} in ${year}; it appears in ${present[0]}–${present[present.length - 1]}.`
          : `The almanac records no institutions for ${name}.`;
      }
      const first = present[0];
      const since = first < year ? ` (${this.sum(first, sel).toLocaleString()} in ${first})` : ', its first year in the almanac';
      return `In ${year} the almanac recorded ${n(this.visibleTotal, 'institution')} in ${name}${since}.`;
    }
    const top = [...this.dioceses].sort((a, b) => b.count - a.count)[0];
    const lead = top?.count ? ` ${top.name} had the most, with ${n(top.count, 'institution')}.` : '';
    return `In ${year}, ${n(this.activeCount, 'diocese')} had institutions in the almanac.${lead}`;
  }

  // ---- growth chart ---------------------------------------------------------

  private renderGrowth(): void {
    const host = this.growthRef?.nativeElement;
    if (!host || host.clientWidth === 0) return;
    d3.select(host).selectAll('*').remove();
    if (!this.years.length) return;

    const sel = this.state.diocese;
    const data = this.years.map(year => {
      const pts = this.pointsByYear.get(year) ?? [];
      return { year, value: sel ? this.sum(year, sel) : new Set(pts.map(p => p.diocese)).size };
    });

    const width = host.clientWidth;
    this.lastWidth = width;
    const compact = width < 520;
    const margin = { top: 12, right: 12, bottom: 30, left: compact ? 36 : 44 };
    const height = compact ? 170 : 200;
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = d3.select(host).append('svg').attr('width', width).attr('height', height)
      .attr('role', 'img').attr('aria-label', this.growthTitle);
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const x = yearScale(this.years, [0, innerW]);
    const y = d3.scaleLinear().domain([0, Math.max(1, d3.max(data, d => d.value) ?? 1)]).nice(4).range([innerH, 0]);
    const yTicks = y.ticks(4).filter(t => Number.isInteger(t));
    g.append('g').attr('class', 'gridline').selectAll('line').data(yTicks).join('line')
      .attr('x1', 0).attr('x2', innerW).attr('y1', d => y(d)).attr('y2', d => y(d));
    g.append('g').call(d3.axisLeft(y).tickValues(yTicks).tickSize(0).tickPadding(6).tickFormat(d3.format('~s')))
      .call(s => s.select('.domain').remove());
    drawYearAxis(g, x, innerH, { minSpacing: compact ? 40 : 36 });

    const accent = sel ? (this.dioceseColor[sel] || 'var(--c-place)') : 'var(--c-place)';
    const line = d3.line<{ year: number; value: number }>().x(d => x(d.year)).y(d => y(d.value));
    const runs: { year: number; value: number }[][] = [];
    data.forEach((d, i) => {
      if (i === 0 || d.year - data[i - 1].year > 1) runs.push([d]); else runs[runs.length - 1].push(d);
    });
    g.append('g').selectAll('path').data(runs).join('path')
      .attr('fill', 'none').attr('stroke', accent).attr('stroke-width', 2).attr('d', line);

    const tooltip = d3.select(host).append('div').attr('class', 'chart-tooltip');
    const unit = sel ? 'institution' : 'diocese';
    g.append('g').selectAll('circle').data(data).join('circle')
      .attr('cx', d => x(d.year)).attr('cy', d => y(d.value))
      .attr('r', d => d.year === this.year ? 6 : 3.5)
      .attr('fill', d => d.year === this.year ? 'var(--c-year)' : accent)
      .attr('stroke', 'var(--surface)').attr('stroke-width', 1.5)
      .style('cursor', 'pointer')
      .on('click', (_e, d) => this.setYear(d.year))
      .on('mousemove', (event: MouseEvent, d) => {
        const [mx, my] = d3.pointer(event, host);
        tooltip.style('opacity', '1')
          .style('left', `${Math.min(mx + 12, width - 200)}px`).style('top', `${my + 12}px`)
          .html(`<strong>${d.year}</strong><br>${d.value.toLocaleString()} ${unit}${d.value === 1 ? '' : 's'}`);
      })
      .on('mouseleave', () => tooltip.style('opacity', '0'));
  }
}
