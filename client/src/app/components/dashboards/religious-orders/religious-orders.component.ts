import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
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

/** GET /api/stats/orders */
interface OrdersResponse {
  orders: Order[];
  /** [lat, lng, instID, name, members, type] */
  selected: { points: [number, number, string, string, number, string][]; dioceses: { id: string; name: string; members: number; institutions: number }[] } | null;
  note: string;
}
interface Order {
  id: string;
  name: string;
  common: string;
  members: number;
  years: { year: number; members: number; institutions: number; dioceses: number }[];
}

const DEFAULTS = { order: 'sj', year: 0 };
const ORDER_INK = INKS[2];

@Component({
  selector: 'app-religious-orders',
  imports: [DecimalPipe, MapVisComponent, DashboardShellComponent, ControlBarComponent, VizPanelComponent, YearPlayerComponent],
  templateUrl: './religious-orders.component.html',
  styleUrl: './religious-orders.component.scss'
})
export class ReligiousOrdersComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('compare', { static: true }) compareRef!: ElementRef<HTMLDivElement>;

  readonly related = [
    { label: 'Clergy Flows', link: '/dashboards/clergy-flows' },
    { label: 'Networks', link: '/dashboards/networks' },
    { label: 'The Shape of the Church', link: '/dashboards/composition' },
  ];
  readonly ink = ORDER_INK;

  state = { ...DEFAULTS };
  vizState: VizState = 'loading';
  takeaway = '';
  note = '';
  chips: ControlChip[] = [];

  orders: Order[] = [];
  order: Order | null = null;
  years: number[] = [];
  year: number | null = null;
  current: Order['years'][number] | null = null;
  dioceses: { id: string; name: string; members: number; institutions: number }[] = [];

  mapData: any[] = [];
  readonly mapOptions = {
    mode: 'point' as const,
    zoom: window.innerWidth < 640 ? 2 : 3.4,
    center: { lat: 39, lng: window.innerWidth < 640 ? -96 : -90 },
    size: { width: '100%', height: 'clamp(320px, 58vh, 580px)' },
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
      const w = this.compareRef.nativeElement.clientWidth;
      if (w > 0 && w !== this.lastWidth) this.renderCompare();
    });
    this.resizeObserver.observe(this.compareRef.nativeElement);
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    this.fetchSub?.unsubscribe();
    this.resizeObserver?.disconnect();
  }

  setOrder(order: string): void { this.url.set({ order }); }
  setYear(year: number): void { this.url.set({ year }); }
  clearAll = (): void => this.url.set({ order: DEFAULTS.order, year: 0 });

  /** One request per order and year: every order's yearly counts, and this one's places. */
  fetchData(): void {
    if (!this.orders.length) this.vizState = 'loading';
    this.fetchSub?.unsubscribe();
    const known = this.orders.find(o => o.id === this.state.order);
    const year = this.state.year || (known ? known.years[known.years.length - 1].year : 1870);
    this.fetchSub = this.api.getTypeRequest(`stats/orders?order=${encodeURIComponent(this.state.order)}&year=${year}`).subscribe({
      next: (res: any) => {
        const data = res as OrdersResponse;
        this.orders = data.orders;
        this.note = data.note;
        this.order = this.orders.find(o => o.id === this.state.order) ?? this.orders[0] ?? null;
        this.years = this.order?.years.map(y => y.year) ?? [];
        this.year = this.years.includes(year) ? year : this.years[this.years.length - 1] ?? null;
        // the latest year asked for may not exist for this order: ask again for its own latest
        if (this.year !== year && this.year) {
          this.state = { ...this.state, year: this.year };
          this.fetchData();
          return;
        }
        this.current = this.order?.years.find(y => y.year === this.year) ?? null;
        this.dioceses = data.selected?.dioceses ?? [];
        const max = Math.max(1, ...(data.selected?.points ?? []).map(p => p[4]));
        this.mapData = (data.selected?.points ?? []).map(([lat, lng, id, name, members, type]) => ({
          latitude: lat, longitude: lng,
          title: `${institutionLabel(name, type)}: ${members} ${members === 1 ? 'member' : 'members'}`,
          internalLink: `/institutions/${id}?year=${this.year}`,
          options: { color: ORDER_INK, radius: 3.5 + 9 * Math.sqrt(members / max) },
        }));
        this.chips = this.state.year ? [{ label: `Year: ${this.state.year}`, clear: () => this.url.set({ year: 0 }) }] : [];
        this.takeaway = this.computeTakeaway();
        this.vizState = this.order ? 'ready' : 'empty';
        this.renderCompare();
      },
      error: () => this.vizState = 'error',
    });
  }

  private computeTakeaway(): string {
    const o = this.order, cur = this.current;
    if (!o || !cur) return '';
    const first = o.years[0];
    const top = this.dioceses[0];
    const lead = `In ${cur.year} the almanacs listed ${cur.members} ${o.common} (${o.name}) at ${cur.institutions} institutions in ${cur.dioceses} dioceses`;
    const grew = first.year < cur.year ? `, up from ${first.members} in ${first.year}` : '';
    return `${lead}${grew}.` + (top ? ` The most were in the Diocese of ${top.name} (${top.members}).` : '');
  }

  // ---- chart: every order's members by year, the chosen one picked out ------

  private renderCompare(): void {
    const host = this.compareRef?.nativeElement;
    if (!host || host.clientWidth === 0 || !this.orders.length) return;
    d3.select(host).selectAll('*').remove();
    const width = host.clientWidth;
    this.lastWidth = width;
    const compact = width < 520;
    const margin = { top: 14, right: compact ? 90 : 150, bottom: 30, left: 40 };
    const height = compact ? 230 : 280;
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;
    const allYears = [...new Set(this.orders.flatMap(o => o.years.map(y => y.year)))].sort((a, b) => a - b);

    const svg = d3.select(host).append('svg').attr('width', width).attr('height', height)
      .attr('role', 'img').attr('aria-label', 'Members of each religious order listed in the almanacs, by year');
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    const x = yearScale(allYears, [0, innerW]);
    const y = d3.scaleLinear().domain([0, d3.max(this.orders.flatMap(o => o.years.map(v => v.members))) ?? 1]).nice(4).range([innerH, 0]);
    g.append('g').attr('class', 'gridline').selectAll('line').data(y.ticks(4)).join('line')
      .attr('x1', 0).attr('x2', innerW).attr('y1', d => y(d)).attr('y2', d => y(d));
    g.append('g').call(d3.axisLeft(y).ticks(4).tickSize(0).tickPadding(6)).call(sel => sel.select('.domain').remove());
    drawYearAxis(g, x, innerH, { minSpacing: compact ? 40 : 36 });

    const line = d3.line<{ year: number; members: number }>().x(d => x(d.year)).y(d => y(d.members));
    // the others in stone first, the chosen order on top in its ink
    const ordered = [...this.orders].sort((a, b) => (a.id === this.state.order ? 1 : 0) - (b.id === this.state.order ? 1 : 0));
    // end labels, nudged apart so lines ending close together stay legible
    const labelled = ordered.filter(o => o.id === this.order?.id || o.members >= 100)
      .map(o => ({ o, ty: y(o.years[o.years.length - 1].members) }))
      .sort((a, b) => b.ty - a.ty);
    for (let i = 1; i < labelled.length; i++) labelled[i].ty = Math.min(labelled[i].ty, labelled[i - 1].ty - 12);
    const labelY = new Map(labelled.map(l => [l.o.id, l.ty]));
    for (const o of ordered) {
      const chosen = o.id === this.order?.id;
      const runs: Order['years'][] = [];
      o.years.forEach((v, i) => { if (i === 0 || v.year - o.years[i - 1].year > 1) runs.push([v]); else runs[runs.length - 1].push(v); });
      g.append('g').selectAll('path').data(runs).join('path')
        .attr('fill', 'none').attr('stroke', chosen ? ORDER_INK : 'var(--ink-3)')
        .attr('stroke-opacity', chosen ? 1 : 0.45).attr('stroke-width', chosen ? 2.5 : 1.2)
        .style('cursor', 'pointer').on('click', () => this.setOrder(o.id))
        .attr('d', line)
        .append('title').text(`${o.common}: click to show`);
      const last = o.years[o.years.length - 1];
      if (labelY.has(o.id)) {
        g.append('text').attr('x', x(last.year) + 6).attr('y', labelY.get(o.id)!).attr('dy', '0.35em')
          .attr('class', chosen ? 'end-label chosen' : 'end-label')
          .style('cursor', 'pointer').on('click', () => this.setOrder(o.id))
          .text(o.common);
      }
    }
    if (this.order && this.year) {
      const v = this.order.years.find(d => d.year === this.year);
      if (v) g.append('circle').attr('cx', x(v.year)).attr('cy', y(v.members)).attr('r', 5)
        .attr('fill', 'var(--c-year)').attr('stroke', 'var(--surface)').attr('stroke-width', 1.5);
    }
  }
}
