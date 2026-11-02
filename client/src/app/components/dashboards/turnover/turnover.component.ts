import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, inject } from '@angular/core';
import { DecimalPipe, PercentPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import * as d3 from 'd3';

import { ApiService } from '../../../services/api.service';
import { ReviewAuthService } from '../../../services/review-auth.service';
import { DashboardShellComponent } from '../../common/dashboard-shell/dashboard-shell.component';
import { ControlBarComponent, ControlChip } from '../../common/control-bar/control-bar.component';
import { VizPanelComponent, VizState } from '../../common/viz-panel/viz-panel.component';
import { UrlState } from '../../../utils/url-state';
import { yearScale, drawYearAxis } from '../../../utils/year-scale';
import { FUNCTION_COLORS, INKS } from '../../../utils/palette';

/** GET /api/stats/turnover */
interface Turnover {
  years: number[];
  flows: { year: number; from: number; added: number; gone: number; kept: number }[];
  survival: Record<string, { k: number; share: number | null; of: number }[]>;
  bridge: { from: number; to: number; listed: number; again: number } | null;
  clergy: { year: number; from: number; stayed: number; left: number; rate: number | null }[];
  stays: { completed: number; median: number | null; mean: number | null; histogram: { years: number; n: number }[] };
  dioceses?: DioceseRow[];
  dioceseNames?: Record<string, string>;
  functions: string[];
}
interface DioceseRow { id: string; name: string; added: number; gone: number; kept: number; departures: number | null; posts: number; meanStay: number | null; }

const DEFAULTS = { diocese: '', fn: '' };
const ADDED_INK = INKS[3];
const GONE_INK = INKS[5];
/** Below this many priest-years at posts, a diocese's departure rate is too noisy to rank. */
const MIN_POSTS = 50;
/** Points resting on fewer cases than these are left out: one diocese's few institutions or posts swing wildly. */
const MIN_SURVIVAL = 20;
const MIN_CLERGY = 15;

@Component({
  selector: 'app-turnover',
  imports: [DecimalPipe, PercentPipe, DashboardShellComponent, ControlBarComponent, VizPanelComponent],
  templateUrl: './turnover.component.html',
  styleUrl: './turnover.component.scss'
})
export class TurnoverComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('flowsChart', { static: true }) flowsRef!: ElementRef<HTMLDivElement>;
  @ViewChild('survivalChart', { static: true }) survivalRef!: ElementRef<HTMLDivElement>;
  @ViewChild('clergyChart', { static: true }) clergyRef!: ElementRef<HTMLDivElement>;

  readonly related = [
    { label: 'Clergy Flows', link: '/dashboards/clergy-flows' },
    { label: 'Coverage — the Shape of the Data', link: '/dashboards/coverage' },
    // editors only
    ...(inject(ReviewAuthService).isSignedIn ? [{ label: 'Data Issues', link: '/dashboards/data-issues' }] : []),
  ];
  readonly addedInk = ADDED_INK;
  readonly goneInk = GONE_INK;
  readonly fnInk = FUNCTION_COLORS;

  state = { ...DEFAULTS };
  vizState: VizState = 'loading';
  takeaway = '';
  chips: ControlChip[] = [];
  data: Turnover | null = null;
  /** The dioceses (from the unfiltered response), for the filter and the table. */
  dioceseOptions: { id: string; name: string }[] = [];
  dioceseRows: DioceseRow[] = [];
  functions: string[] = [];
  departures: number | null = null;
  fiveYear: number | null = null;

  private all: Turnover | null = null;
  private url: UrlState<typeof DEFAULTS>;
  private subs: Subscription[] = [];
  private fetchSub?: Subscription;
  private resizeObserver?: ResizeObserver;
  private widths = new Map<Element, number>();

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
    this.resizeObserver = new ResizeObserver(entries => {
      if (entries.some(e => e.contentRect.width > 0 && e.contentRect.width !== this.widths.get(e.target))) this.render();
    });
    [this.flowsRef, this.survivalRef, this.clergyRef].forEach(r => this.resizeObserver!.observe(r.nativeElement));
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    this.fetchSub?.unsubscribe();
    this.resizeObserver?.disconnect();
  }

  setDiocese(diocese: string): void { this.url.set({ diocese }); }
  setFn(fn: string): void { this.url.set({ fn }); }
  clearAll = (): void => this.url.set({ diocese: '', fn: '' });

  fnLabel(fn: string): string { return fn ? fn.replace(' institutions', '') : 'all'; }
  nameFor(id: string): string { return this.dioceseOptions.find(d => d.id === id)?.name ?? id; }

  fetchData(): void {
    this.vizState = 'loading';
    this.fetchSub?.unsubscribe();
    const q = new URLSearchParams();
    if (this.state.diocese) q.set('diocese', this.state.diocese);
    if (this.state.fn) q.set('fn', this.state.fn);
    this.fetchSub = this.api.getTypeRequest(`stats/turnover?${q}`).subscribe({
      next: (res: any) => {
        const data = res as Turnover;
        this.data = data;
        this.functions = data.functions;
        if (data.dioceses) {
          this.all = data;
          this.dioceseOptions = data.dioceses.map(d => ({ id: d.id, name: d.name }));
          this.dioceseRows = data.dioceses.filter(d => d.posts >= MIN_POSTS)
            .sort((a, b) => (b.departures ?? 0) - (a.departures ?? 0));
        } else if (!this.all) {
          // landed on a diocese: fetch the whole once for the filter's names and the table
          this.api.getTypeRequest(`stats/turnover${this.state.fn ? '?fn=' + encodeURIComponent(this.state.fn) : ''}`).subscribe((r: any) => {
            this.all = r;
            this.dioceseOptions = r.dioceses.map((d: DioceseRow) => ({ id: d.id, name: d.name }));
            this.dioceseRows = r.dioceses.filter((d: DioceseRow) => d.posts >= MIN_POSTS).sort((a: DioceseRow, b: DioceseRow) => (b.departures ?? 0) - (a.departures ?? 0));
            this.update();
          });
        }
        this.update();
      },
      error: () => this.vizState = 'error',
    });
  }

  private update(): void {
    const d = this.data;
    if (!d) return;
    const later = d.clergy.filter(c => c.year > 1850);
    const stayed = later.reduce((n, c) => n + c.stayed, 0), left = later.reduce((n, c) => n + c.left, 0);
    this.departures = stayed + left ? left / (stayed + left) : null;
    const curve = d.survival[this.state.fn || 'all'] ?? d.survival['all'];
    this.fiveYear = curve[5] && curve[5].of >= MIN_SURVIVAL ? curve[5].share : null;
    this.chips = [
      ...(this.state.diocese ? [{ label: `Diocese: ${this.nameFor(this.state.diocese)}`, clear: () => this.url.set({ diocese: '' }) }] : []),
      ...(this.state.fn ? [{ label: `Function: ${this.fnLabel(this.state.fn)}`, clear: () => this.url.set({ fn: '' }) }] : []),
    ];
    this.takeaway = this.computeTakeaway();
    this.vizState = d.flows.some(f => f.kept + f.added + f.gone) ? 'ready' : 'empty';
    this.render();
  }

  private computeTakeaway(): string {
    const d = this.data!;
    const where = this.state.diocese ? ` in the Diocese of ${this.nameFor(this.state.diocese)}` : '';
    const s = d.survival;
    const pct = (v: number | null | undefined) => v == null ? '—' : `${Math.round(v * 100)}%`;
    const parts: string[] = [];
    if (this.fiveYear != null) {
      parts.push(`Of the ${this.state.fn ? this.fnLabel(this.state.fn) + ' ' : ''}institutions newly listed${where} from 1865, ${pct(this.fiveYear)} were still listed five years later`
        + (!this.state.fn && s['religious institutions']?.[5]?.share != null
          ? ` (churches and other religious institutions ${pct(s['religious institutions'][5].share)}, schools ${pct(s['educational institutions']?.[5]?.share)}, charities ${pct(s['charitable institutions']?.[5]?.share)})` : '')
        + '.');
    }
    if (this.departures != null) parts.push(`Each year in the 1860s about ${pct(this.departures)} of resident clergy left the post they had held the year before.`);
    return parts.join(' ');
  }

  // ---- charts ----------------------------------------------------------------------

  private render(): void {
    if (!this.data) return;
    this.renderFlows();
    this.renderSurvival();
    this.renderClergy();
  }

  private host(ref: ElementRef<HTMLDivElement>): { el: HTMLDivElement; width: number } | null {
    const el = ref?.nativeElement;
    if (!el || el.clientWidth === 0) return null;
    d3.select(el).selectAll('*').remove();
    this.widths.set(el, el.clientWidth);
    return { el, width: el.clientWidth };
  }

  /** New above the line, gone below, for each year against the year before. */
  private renderFlows(): void {
    const h = this.host(this.flowsRef);
    if (!h) return;
    const flows = this.data!.flows;
    const m = { top: 12, right: 12, bottom: 30, left: 44 };
    const height = 230, innerW = h.width - m.left - m.right, innerH = height - m.top - m.bottom;
    const svg = d3.select(h.el).append('svg').attr('width', h.width).attr('height', height)
      .attr('role', 'img').attr('aria-label', 'Institutions newly listed and no longer listed, each year against the year before');
    const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);
    const x = yearScale(flows.map(f => f.year), [0, innerW]);
    const max = d3.max(flows, f => Math.max(f.added, f.gone)) || 1;
    const y = d3.scaleLinear().domain([-max, max]).nice(4).range([innerH, 0]);
    g.append('g').call(d3.axisLeft(y).ticks(4).tickFormat(v => d3.format(',d')(Math.abs(+v))).tickSize(-innerW).tickPadding(6))
      .call(s => s.select('.domain').remove()).call(s => s.selectAll('.tick line').attr('class', 'gridline'));
    drawYearAxis(g, x, innerH, { minSpacing: 34 });
    const bw = Math.max(4, Math.min(28, x.step * 0.6));
    const bars = g.append('g').selectAll('g').data(flows).join('g');
    bars.append('rect').attr('x', f => x(f.year) - bw / 2).attr('width', bw)
      .attr('y', f => y(f.added)).attr('height', f => y(0) - y(f.added)).attr('fill', ADDED_INK)
      .append('title').text(f => `${f.year}: ${f.added} newly listed (against ${f.from})`);
    bars.append('rect').attr('x', f => x(f.year) - bw / 2).attr('width', bw)
      .attr('y', y(0)).attr('height', f => y(-f.gone) - y(0)).attr('fill', GONE_INK)
      .append('title').text(f => `${f.year}: ${f.gone} listed in ${f.from} but not in ${f.year}`);
    g.append('line').attr('x1', 0).attr('x2', innerW).attr('y1', y(0)).attr('y2', y(0)).attr('stroke', 'var(--ink-2)');
  }

  /** Share of newly listed institutions still listed k years later, by function. */
  private renderSurvival(): void {
    const h = this.host(this.survivalRef);
    if (!h) return;
    const s = this.data!.survival;
    const groups = this.state.fn ? [this.state.fn] : ['all', ...this.functions];
    const compact = h.width < 480;
    const m = { top: 12, right: compact ? 70 : 120, bottom: 32, left: 40 };
    const height = 230, innerW = h.width - m.left - m.right, innerH = height - m.top - m.bottom;
    const svg = d3.select(h.el).append('svg').attr('width', h.width).attr('height', height)
      .attr('role', 'img').attr('aria-label', 'Share of newly listed institutions still listed one to five years later');
    const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);
    const x = d3.scaleLinear().domain([0, 5]).range([0, innerW]);
    const y = d3.scaleLinear().domain([0, 1]).range([innerH, 0]);
    g.append('g').call(d3.axisLeft(y).ticks(4).tickFormat(d3.format('.0%')).tickSize(-innerW).tickPadding(6))
      .call(sel => sel.select('.domain').remove()).call(sel => sel.selectAll('.tick line').attr('class', 'gridline'));
    g.append('g').attr('transform', `translate(0,${innerH})`).call(d3.axisBottom(x).ticks(5).tickFormat(v => `${v}`).tickSize(0).tickPadding(8))
      .call(sel => sel.select('.domain').remove());
    g.append('text').attr('class', 'axis-note').attr('x', innerW).attr('y', innerH + 28).attr('text-anchor', 'end').text('years after first listed');
    const line = d3.line<{ k: number; share: number | null; of: number }>().defined(p => p.share != null && p.of >= MIN_SURVIVAL).x(p => x(p.k)).y(p => y(p.share!));
    const labels: { g: string; y: number }[] = [];
    for (const grp of groups) {
      const pts = s[grp] ?? [];
      const ink = grp === 'all' ? 'var(--ink)' : FUNCTION_COLORS[grp];
      g.append('path').datum(pts).attr('fill', 'none').attr('stroke', ink).attr('stroke-width', grp === 'all' ? 2.6 : 1.8)
        .attr('stroke-dasharray', grp === 'all' && groups.length > 1 ? '5 3' : null).attr('d', line);
      const last = [...pts].reverse().find(p => p.share != null && p.of >= MIN_SURVIVAL);
      if (last) labels.push({ g: grp, y: y(last.share!) });
    }
    // end labels, nudged apart
    labels.sort((a, b) => a.y - b.y);
    for (let i = 1; i < labels.length; i++) labels[i].y = Math.max(labels[i].y, labels[i - 1].y + 12);
    for (const l of labels) {
      g.append('text').attr('class', 'end-label').attr('x', innerW + 6).attr('y', l.y).attr('dy', '0.35em')
        .attr('fill', l.g === 'all' ? 'var(--ink)' : FUNCTION_COLORS[l.g]).text(this.fnLabel(l.g === 'all' ? '' : l.g));
    }
  }

  /** Share of resident clergy who had left last year's post. */
  private renderClergy(): void {
    const h = this.host(this.clergyRef);
    if (!h) return;
    const rows = this.data!.clergy.filter(c => c.rate != null && c.stayed + c.left >= MIN_CLERGY);
    const m = { top: 12, right: 12, bottom: 30, left: 40 };
    const height = 200, innerW = h.width - m.left - m.right, innerH = height - m.top - m.bottom;
    const svg = d3.select(h.el).append('svg').attr('width', h.width).attr('height', height)
      .attr('role', 'img').attr('aria-label', 'Share of resident clergy who left their post, each year');
    const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);
    const x = yearScale(rows.map(r => r.year), [0, innerW]);
    const y = d3.scaleLinear().domain([0, Math.max(0.6, d3.max(rows, r => r.rate!) ?? 0)]).nice(3).range([innerH, 0]);
    g.append('g').call(d3.axisLeft(y).ticks(3).tickFormat(d3.format('.0%')).tickSize(-innerW).tickPadding(6))
      .call(s => s.select('.domain').remove()).call(s => s.selectAll('.tick line').attr('class', 'gridline'));
    drawYearAxis(g, x, innerH, { minSpacing: 34 });
    const runs: (typeof rows)[] = [];
    rows.forEach((r, i) => { if (i === 0 || r.year - rows[i - 1].year > 1) runs.push([r]); else runs[runs.length - 1].push(r); });
    const line = d3.line<(typeof rows)[number]>().x(r => x(r.year)).y(r => y(r.rate!));
    g.selectAll('path.run').data(runs).join('path').attr('class', 'run').attr('fill', 'none')
      .attr('stroke', 'var(--c-pers)').attr('stroke-width', 2.2).attr('d', line);
    g.selectAll('circle').data(rows).join('circle').attr('cx', r => x(r.year)).attr('cy', r => y(r.rate!)).attr('r', 3)
      .attr('fill', 'var(--c-pers)').append('title').text(r => `${r.year}: ${r.left} of ${r.stayed + r.left} had left the post they held in ${r.from}`);
  }
}
