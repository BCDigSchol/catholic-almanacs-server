import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
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
import { institutionLabel } from '../../../utils/record-labels';
import { INKS } from '../../../utils/palette';

/** GET /api/stats/cessions */
interface Cession { tribes: string; ceded: number; dates: string; present: string; treaty: string; schedule: string; }
interface Mission { inst: string; name: string; type: string; place: string; diocese: string; held: boolean; since: number | null; cessions: string[]; }
interface YearRow { year: number; placed: number; held: number; within10: number; within30: number; older: number; }
interface CessionsResponse {
  year: number;
  years: YearRow[];
  missions: Mission[];
  cessions: Record<string, Cession>;
  /** [lat, lng, instID, name, type, status, native] */
  points: [number, number, string, string, string, 'held' | 'recent' | 'older', number][];
}

/** The status of an institution's land, in the inks the map's cession areas use. */
const STATUS = [
  { key: 'held', label: 'on land still held by a nation', ink: INKS[1] },
  { key: 'within10', label: 'ceded in the ten years before', ink: INKS[6] },
  { key: 'within30', label: 'ceded 11–30 years before', ink: '#b9a78c' },
  { key: 'older', label: 'ceded more than 30 years before', ink: '#d9d2c3' },
] as const;
const POINT_INK: Record<string, string> = { held: STATUS[0].ink, recent: STATUS[1].ink, older: INKS[5] };

const DEFAULTS = { year: 0, show: 'missions' };

/**
 * Missions and Ceded Lands: the Church set against the Indian land cessions
 * Royce mapped. For any year, which missions and parishes stood on land still
 * held by a nation, and which on land ceded only years before.
 */
@Component({
  selector: 'app-cessions',
  imports: [DecimalPipe, RouterLink, MapVisComponent, DashboardShellComponent, ControlBarComponent, SegmentedComponent, VizPanelComponent, YearPlayerComponent],
  templateUrl: './cessions.component.html',
  styleUrl: './cessions.component.scss'
})
export class CessionsComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('statusChart', { static: true }) chartRef!: ElementRef<HTMLDivElement>;

  readonly related = [
    { label: 'Languages and Congregations', link: '/dashboards/languages', queryParams: { lang: 'native' } },
    { label: 'Mission Circuits', link: '/dashboards/circuits' },
    { label: 'The Spread of the Church', link: '/dashboards/spread' },
  ];
  readonly status = STATUS;
  readonly pointInk = POINT_INK;
  readonly showOptions = [{ value: 'missions', label: 'Native American missions' }, { value: 'all', label: 'All institutions' }];

  state = { ...DEFAULTS };
  vizState: VizState = 'loading';
  takeaway = '';
  chips: ControlChip[] = [];
  data: CessionsResponse | null = null;
  years: number[] = [];
  year: number | null = null;
  current: YearRow | null = null;
  missions: (Mission & { label: string; land: Cession | null; others: Cession[] })[] = [];
  mapData: any[] = [];
  readonly mapOptions = {
    mode: 'point' as const,
    zoom: window.innerWidth < 640 ? 2 : 3.4,
    center: { lat: 41, lng: window.innerWidth < 640 ? -98 : -96 },
    size: { width: '100%', height: 'clamp(340px, 60vh, 600px)' },
  };

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
      const refetch = state.year !== this.state.year || !this.data;
      this.state = state;
      if (refetch) this.fetchData(); else this.update();
    }));
  }

  ngAfterViewInit(): void {
    this.resizeObserver = new ResizeObserver(() => {
      const w = this.chartRef.nativeElement.clientWidth;
      if (w > 0 && w !== this.lastWidth) this.renderChart();
    });
    this.resizeObserver.observe(this.chartRef.nativeElement);
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    this.fetchSub?.unsubscribe();
    this.resizeObserver?.disconnect();
  }

  setYear(year: number): void { this.url.set({ year }); }
  setShow(show: string): void { this.url.set({ show }); }
  clearAll = (): void => this.url.set({ year: 0, show: DEFAULTS.show });

  /** 1842 from yyyymmdd. */
  yearOf(ceded: number): number { return Math.floor(ceded / 10000); }

  /** "4 October 1842" from yyyymmdd. */
  day(ceded: number): string {
    const d = new Date(Date.UTC(Math.floor(ceded / 10000), Math.floor(ceded / 100) % 100 - 1, ceded % 100));
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  }

  fetchData(): void {
    this.vizState = 'loading';
    this.fetchSub?.unsubscribe();
    this.fetchSub = this.api.getTypeRequest(`stats/cessions${this.state.year ? '?year=' + this.state.year : ''}`).subscribe({
      next: (res: any) => { this.data = res as CessionsResponse; this.update(); },
      error: (e: any) => this.vizState = e?.status === 404 ? 'empty' : 'error',
    });
  }

  private update(): void {
    const d = this.data!;
    this.years = d.years.map(y => y.year);
    this.year = d.year;
    this.current = d.years.find(y => y.year === d.year) ?? null;
    this.missions = d.missions.map(m => ({
      ...m, label: institutionLabel(m.name, m.type),
      land: d.cessions[m.cessions[0]] ?? null,
      // the other cessions that cover the same ground, once each (nation and year)
      others: m.cessions.slice(1).map(n => d.cessions[n]).filter(Boolean)
        .filter((c, i, all) => all.findIndex(o => o.tribes === c.tribes && this.yearOf(o.ceded) === this.yearOf(c.ceded)) === i),
    }));
    const pts = d.points.filter(p => this.state.show === 'all' || p[6]);
    this.mapData = pts.map(([lat, lng, id, name, type, status, native]) => ({
      latitude: lat, longitude: lng,
      title: `${institutionLabel(name, type)}${native ? ' (Native American mission)' : ''}: ${status === 'held' ? 'on land still held by a nation' : status === 'recent' ? 'on land ceded in the ten years before' : 'on land ceded earlier'}`,
      internalLink: `/institutions/${id}?year=${d.year}`,
      options: { color: POINT_INK[status], radius: native ? 6 : 3.5 },
    }));
    this.chips = [
      ...(this.state.year ? [{ label: `Year: ${this.state.year}`, clear: () => this.url.set({ year: 0 }) }] : []),
      ...(this.state.show !== DEFAULTS.show ? [{ label: 'Showing all institutions', clear: () => this.url.set({ show: DEFAULTS.show }) }] : []),
    ];
    this.takeaway = this.computeTakeaway();
    this.vizState = d.years.length ? 'ready' : 'empty';
    this.renderChart();
  }

  private computeTakeaway(): string {
    const d = this.data!, c = this.current;
    if (!c) return '';
    const held = this.missions.filter(m => m.held).length;
    const recent = this.missions.filter(m => !m.held && (m.since ?? 99) <= 10).length;
    const parts = [`In ${d.year}, ${c.held.toLocaleString()} of the ${c.placed.toLocaleString()} institutions the almanac listed on land Royce mapped stood on land a Native nation had not yet ceded, and ${c.within10.toLocaleString()} on land ceded in the ten years before.`];
    if (this.missions.length) {
      parts.push(`Of its ${this.missions.length} Native American missions, ${held} stood on land still held${recent ? ` and ${recent} on land ceded within ten years` : ''}.`);
    }
    return parts.join(' ');
  }

  /** Each year's institutions by the status of their land, as shares. */
  private renderChart(): void {
    const host = this.chartRef?.nativeElement;
    if (!host || host.clientWidth === 0 || !this.data) return;
    d3.select(host).selectAll('*').remove();
    const width = host.clientWidth;
    this.lastWidth = width;
    const rows = this.data.years.filter(y => y.placed > 0);
    const m = { top: 10, right: 12, bottom: 30, left: 40 };
    const height = 220, innerW = width - m.left - m.right, innerH = height - m.top - m.bottom;
    const svg = d3.select(host).append('svg').attr('width', width).attr('height', height)
      .attr('role', 'img').attr('aria-label', 'Share of institutions on land still held, recently ceded, or ceded long before, by year');
    const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);
    const x = yearScale(rows.map(r => r.year), [0, innerW]);
    const y = d3.scaleLinear().domain([0, 1]).range([innerH, 0]);
    g.append('g').call(d3.axisLeft(y).ticks(4).tickFormat(d3.format('.0%')).tickSize(-innerW).tickPadding(6))
      .call(s => s.select('.domain').remove()).call(s => s.selectAll('.tick line').attr('class', 'gridline'));
    drawYearAxis(g, x, innerH, { minSpacing: 34 });
    const bw = Math.max(4, Math.min(30, x.step * 0.7));
    for (const r of rows) {
      let acc = 0;
      for (const s of STATUS) {
        const share = r[s.key] / r.placed;
        g.append('rect').attr('x', x(r.year) - bw / 2).attr('width', bw)
          .attr('y', y(acc + share)).attr('height', y(acc) - y(acc + share)).attr('fill', s.ink)
          .style('cursor', 'pointer').on('click', () => this.setYear(r.year))
          .append('title').text(`${r.year}: ${r[s.key]} of ${r.placed} institutions ${s.label}`);
        acc += share;
      }
      // the year shown: one outline round its bar
      if (r.year === this.year) {
        g.append('rect').attr('x', x(r.year) - bw / 2 - 2).attr('width', bw + 4).attr('y', y(1) - 2).attr('height', y(0) - y(1) + 4)
          .attr('fill', 'none').attr('stroke', 'var(--rubric)').attr('stroke-width', 1.5).attr('pointer-events', 'none');
      }
    }
  }
}
