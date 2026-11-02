import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import * as d3 from 'd3';

import { ApiService } from '../../../services/api.service';
import { MapVisComponent } from '../../common/map-vis/map-vis.component';
import { DashboardShellComponent } from '../../common/dashboard-shell/dashboard-shell.component';
import { ControlBarComponent, ControlChip } from '../../common/control-bar/control-bar.component';
import { VizPanelComponent, VizState } from '../../common/viz-panel/viz-panel.component';
import { YearPlayerComponent } from '../../common/year-player/year-player.component';
import { UrlState } from '../../../utils/url-state';
import { yearScale, drawYearAxis } from '../../../utils/year-scale';
import { institutionLabel } from '../../../utils/record-labels';
import { INKS } from '../../../utils/palette';

/** GET /api/stats/southwest */
interface YearRow { year: number; institutions: number; spanishNamed: number; marked: number; clergy: number; spanishClergy: number; }
interface SouthwestResponse {
  year: number;
  years: YearRow[];
  dioceses: { id: string; name: string; years: { year: number; institutions: number; clergy: number; spanishClergy: number }[] }[];
  clergy: { pers: string; name: string; spanish: boolean; places: string[] }[];
  /** [lat, lng, instID, name, type, how, spanishName, marked, dioceseId] */
  points: [number, number, string, string, string, string, number, number, string][];
  lands: Record<string, { label: string; since: number }>;
  hasSurnames: boolean;
}

/** How the land came to the Union, in the map's and key's inks. */
const LAND_INK: Record<string, string> = { texas: INKS[6], claim: INKS[1], cession: INKS[0], gadsden: INKS[7] };
const SPANISH_INK = INKS[4];
const OTHER_CLERGY_INK = INKS[5];

const DEFAULTS = { year: 0, diocese: '' };

/**
 * The Southwest: the Church on land the United States took from Mexico (Texas,
 * the land Texas claimed, the Mexican Cession), with three markers of its
 * Hispanic Catholics in the almanacs' own data: Spanish-surnamed clergy,
 * Spanish-named institutions, and congregations marked Spanish or Mexican.
 */
@Component({
  selector: 'app-southwest',
  imports: [DecimalPipe, RouterLink, MapVisComponent, DashboardShellComponent, ControlBarComponent, VizPanelComponent, YearPlayerComponent],
  templateUrl: './southwest.component.html',
  styleUrl: './southwest.component.scss'
})
export class SouthwestComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('clergyChart', { static: true }) chartRef!: ElementRef<HTMLDivElement>;

  readonly related = [
    { label: 'Missions and Ceded Lands', link: '/dashboards/cessions' },
    { label: 'Languages and Congregations', link: '/dashboards/languages' },
    { label: 'Diocese by Diocese', link: '/dashboards/diocese-tracker' },
  ];
  readonly landInk = LAND_INK;
  readonly spanishInk = SPANISH_INK;
  readonly otherInk = OTHER_CLERGY_INK;

  state = { ...DEFAULTS };
  vizState: VizState = 'loading';
  takeaway = '';
  chips: ControlChip[] = [];
  data: SouthwestResponse | null = null;
  years: number[] = [];
  year: number | null = null;
  current: YearRow | null = null;
  dioceseOptions: { id: string; name: string }[] = [];
  lands: { key: string; label: string; date: string }[] = [];
  clergy: SouthwestResponse['clergy'] = [];
  spanishCount = 0;
  mapData: any[] = [];
  /** Frames the chosen diocese's points; set only when the diocese changes, so stepping years doesn't move the map. */
  mapFit: [number, number, number, number] | null = null;
  private fittedDiocese: string | null = null;
  readonly mapOptions = {
    mode: 'point' as const,
    zoom: window.innerWidth < 640 ? 2.6 : 3.8,
    center: { lat: 33.5, lng: window.innerWidth < 640 ? -106 : -108 },
    size: { width: '100%', height: 'clamp(320px, 55vh, 560px)' },
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
      this.state = state;
      this.fetchData();
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
  setDiocese(diocese: string): void { this.url.set({ diocese }); }
  clearAll = (): void => this.url.set({ year: 0, diocese: '' });
  nameFor(id: string): string { return this.dioceseOptions.find(d => d.id === id)?.name ?? id; }

  fetchData(): void {
    this.vizState = 'loading';
    this.fetchSub?.unsubscribe();
    const q = new URLSearchParams();
    if (this.state.year) q.set('year', String(this.state.year));
    if (this.state.diocese) q.set('diocese', this.state.diocese);
    this.fetchSub = this.api.getTypeRequest(`stats/southwest?${q}`).subscribe({
      next: (res: any) => this.show(res as SouthwestResponse),
      error: (e: any) => this.vizState = e?.status === 404 ? 'empty' : 'error',
    });
  }

  private show(d: SouthwestResponse): void {
    this.data = d;
    this.years = d.years.map(y => y.year);
    this.year = d.year;
    this.current = d.years.find(y => y.year === d.year) ?? null;
    // the sees with more than a stray record on this land
    this.dioceseOptions = d.dioceses.filter(x => x.years.some(y => y.institutions >= 3)).map(x => ({ id: x.id, name: x.name }));
    const date = (n: number) => new Date(Date.UTC(Math.floor(n / 10000), Math.floor(n / 100) % 100 - 1, n % 100))
      .toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
    this.lands = Object.entries(d.lands).map(([key, v]) => ({ key, label: v.label, date: date(v.since) }));
    this.clergy = d.clergy;
    this.spanishCount = d.clergy.filter(c => c.spanish).length;
    this.mapData = d.points.map(([lat, lng, id, name, type, how, spanishName, marked]) => ({
      latitude: lat, longitude: lng,
      title: `${institutionLabel(name, type)}${spanishName ? ' (Spanish name)' : ''}${marked ? ' · marked Spanish or Mexican' : ''}: ${d.lands[how]?.label ?? how}`,
      internalLink: `/institutions/${id}?year=${d.year}`,
      options: { color: LAND_INK[how] ?? INKS[5], radius: spanishName || marked ? 6 : 3.5 },
    }));
    if (this.state.diocese !== this.fittedDiocese) {
      this.fittedDiocese = this.state.diocese;
      const pts = d.points.filter(p => p[8] === this.state.diocese);
      if (this.state.diocese && pts.length) {
        const lats = pts.map(p => p[0]), lngs = pts.map(p => p[1]);
        this.mapFit = [Math.min(...lngs) - 0.5, Math.min(...lats) - 0.5, Math.max(...lngs) + 0.5, Math.max(...lats) + 0.5];
      } else if (!this.state.diocese) {
        this.mapFit = [-125, 25, -93, 42];
      }
    }
    this.chips = [
      ...(this.state.diocese ? [{ label: `Diocese: ${this.nameFor(this.state.diocese)}`, clear: () => this.url.set({ diocese: '' }) }] : []),
      ...(this.state.year ? [{ label: `Year: ${this.state.year}`, clear: () => this.url.set({ year: 0 }) }] : []),
    ];
    this.takeaway = this.computeTakeaway();
    this.vizState = d.years.length ? 'ready' : 'empty';
    this.renderChart();
  }

  private computeTakeaway(): string {
    const c = this.current;
    if (!c) return '';
    const where = this.state.diocese ? ` in the Diocese of ${this.nameFor(this.state.diocese)}` : '';
    const n = this.state.diocese ? this.clergy.length : c.clergy;
    const s = this.state.diocese ? this.spanishCount : c.spanishClergy;
    return `In ${c.year} the almanac listed ${c.institutions.toLocaleString()} institutions on land the United States had taken from Mexico, ${c.spanishNamed} of them with Spanish names. `
      + `Of the ${n} clergy and religious listed there${where}, ${s} had Spanish surnames.`;
  }

  /** Clergy listed on this land each year: Spanish-surnamed and others (one diocese, or all). */
  private renderChart(): void {
    const host = this.chartRef?.nativeElement;
    if (!host || host.clientWidth === 0 || !this.data) return;
    d3.select(host).selectAll('*').remove();
    const width = host.clientWidth;
    this.lastWidth = width;
    const dio = this.data.dioceses.find(x => x.id === this.state.diocese);
    const rows = dio ? dio.years : this.data.years.map(y => ({ year: y.year, clergy: y.clergy, spanishClergy: y.spanishClergy }));
    if (!rows.length) return;
    const m = { top: 10, right: 12, bottom: 30, left: 40 };
    const height = 210, innerW = width - m.left - m.right, innerH = height - m.top - m.bottom;
    const svg = d3.select(host).append('svg').attr('width', width).attr('height', height)
      .attr('role', 'img').attr('aria-label', 'Clergy listed on land taken from Mexico each year, with and without Spanish surnames');
    const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);
    const x = yearScale(rows.map(r => r.year), [0, innerW]);
    const y = d3.scaleLinear().domain([0, d3.max(rows, r => r.clergy) || 1]).nice(4).range([innerH, 0]);
    g.append('g').call(d3.axisLeft(y).ticks(4).tickFormat(d3.format(',d')).tickSize(-innerW).tickPadding(6))
      .call(s => s.select('.domain').remove()).call(s => s.selectAll('.tick line').attr('class', 'gridline'));
    drawYearAxis(g, x, innerH, { minSpacing: 34 });
    const bw = Math.max(6, Math.min(34, x.step * 0.6));
    for (const r of rows) {
      g.append('rect').attr('x', x(r.year) - bw / 2).attr('width', bw).attr('y', y(r.spanishClergy)).attr('height', innerH - y(r.spanishClergy))
        .attr('fill', SPANISH_INK).append('title').text(`${r.year}: ${r.spanishClergy} with Spanish surnames`);
      g.append('rect').attr('x', x(r.year) - bw / 2).attr('width', bw).attr('y', y(r.clergy)).attr('height', y(r.spanishClergy) - y(r.clergy))
        .attr('fill', OTHER_CLERGY_INK).attr('fill-opacity', 0.5).append('title').text(`${r.year}: ${r.clergy - r.spanishClergy} others`);
      if (r.year === this.year) {
        g.append('rect').attr('x', x(r.year) - bw / 2 - 2).attr('width', bw + 4).attr('y', y(r.clergy) - 2).attr('height', innerH - y(r.clergy) + 4)
          .attr('fill', 'none').attr('stroke', 'var(--rubric)').attr('stroke-width', 1.5).attr('pointer-events', 'none');
      }
    }
  }
}
