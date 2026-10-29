import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import * as d3 from 'd3';

import { ApiService } from '../../../services/api.service';
import { SpaceNamePipe, spaceName } from '../../../pipes/space-name.pipe';
import { DashboardShellComponent } from '../../common/dashboard-shell/dashboard-shell.component';
import { ControlBarComponent, ControlChip } from '../../common/control-bar/control-bar.component';
import { VizPanelComponent, VizState } from '../../common/viz-panel/viz-panel.component';
import { SegmentedComponent } from '../../common/segmented/segmented.component';
import { UrlState } from '../../../utils/url-state';
import { yearScale, drawYearAxis } from '../../../utils/year-scale';
import { US_STATES, loadOptions, stateName } from '../../../utils/options';

interface CompositionRow {
  year: number;
  group: string;
  count: number;
  total: number;
  share: number;
}

const DEFAULTS = { diocese: '', state: '', mode: 'share' };

@Component({
  selector: 'app-composition-dashboard',
  imports: [SpaceNamePipe, DashboardShellComponent, ControlBarComponent, VizPanelComponent, SegmentedComponent],
  templateUrl: './composition.component.html',
  styleUrl: './composition.component.scss'
})
export class CompositionDashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('chart', { static: true }) chartRef!: ElementRef<HTMLDivElement>;

  readonly related = [
    { label: 'Who Served the Church', link: '/dashboards/people-composition' },
    { label: 'Comparing Places', link: '/dashboards/comparison' },
    { label: 'A Part Against the Whole', link: '/dashboards/subset-vs-whole' },
    { label: 'The Almanacs at a Glance', link: '/dashboards/overview' },
  ];
  readonly modes = [{ value: 'share', label: 'Share' }, { value: 'count', label: 'Count' }];
  readonly usStates = US_STATES;
  dioceseOptions: string[] = [];

  state = { ...DEFAULTS };
  vizState: VizState = 'loading';
  note = '';
  takeaway = '';
  chips: ControlChip[] = [];
  years: number[] = [];
  legend: { group: string; label: string; color: string }[] = [];

  private rows: CompositionRow[] = [];
  private buckets: string[] = [];
  private url: UrlState<typeof DEFAULTS>;
  private subs: Subscription[] = [];
  private fetchSub?: Subscription;
  private resizeObserver?: ResizeObserver;
  private lastWidth = 0;

  private readonly labels: Record<string, string> = {
    'religious institutions': 'Religious (parishes, missions)',
    'educational institutions': 'Educational',
    'consecrated life institutions': 'Consecrated life',
    'charitable institutions': 'Charitable',
    'healthcare institutions': 'Healthcare',
    'other': 'Other / unclassified'
  };
  private readonly colors: Record<string, string> = {
    'religious institutions': '#3c6e9e',
    'educational institutions': '#e0a83b',
    'consecrated life institutions': '#7b5aa6',
    'charitable institutions': '#3f9e7a',
    'healthcare institutions': '#c0504d',
    'other': '#9aa0a6'
  };

  constructor(private api: ApiService, private http: HttpClient, router: Router, route: ActivatedRoute) {
    this.url = new UrlState(router, route, DEFAULTS);
  }

  ngOnInit(): void {
    this.subs.push(loadOptions(this.http, 'diocese.csv').subscribe(o => this.dioceseOptions = o));
    // Refetch only when the place changes; Share/Count just redraws.
    let scope: string | null = null;
    this.subs.push(this.url.changes().subscribe(state => {
      const scopeChanged = `${state.diocese}|${state.state}` !== scope;
      scope = `${state.diocese}|${state.state}`;
      this.state = state;
      this.chips = [
        ...(state.diocese ? [{ label: `Diocese: ${spaceName(state.diocese)}`, clear: () => this.url.set({ diocese: '' }) }] : []),
        ...(state.state ? [{ label: `State: ${stateName(state.state)}`, clear: () => this.url.set({ state: '' }) }] : []),
      ];
      if (scopeChanged) this.fetchData(); else this.render();
    }));
  }

  ngAfterViewInit(): void {
    // Redraw when the chart's width settles or changes (also on first layout).
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

  setDiocese(diocese: string): void {
    this.url.set({ diocese, state: '' });
  }

  setState(state: string): void {
    this.url.set({ state, diocese: '' });
  }

  setMode(mode: string): void {
    this.url.set({ mode });
  }

  clearAll = (): void => this.url.set({ diocese: '', state: '' });

  get scopeLabel(): string {
    if (this.state.diocese) return `in the Diocese of ${spaceName(this.state.diocese)}`;
    if (this.state.state) return `in ${stateName(this.state.state)}`;
    return 'nationally';
  }

  // ---- data -----------------------------------------------------------------

  fetchData(): void {
    this.vizState = 'loading';
    const q = new URLSearchParams();
    if (this.state.diocese) q.set('diocese', this.state.diocese);
    if (this.state.state) q.set('state', this.state.state);
    this.fetchSub?.unsubscribe();
    this.fetchSub = this.api.getTypeRequest('stats/composition' + (q.toString() ? '?' + q : '')).subscribe({
      next: (res: any) => {
        this.rows = res.rows ?? [];
        this.buckets = res.meta?.buckets ?? [];
        this.years = res.meta?.years ?? [];
        this.note = res.meta?.note ?? '';
        this.legend = this.buckets.map(b => ({ group: b, label: this.labels[b] ?? b, color: this.colors[b] ?? '#999' }));
        this.takeaway = this.computeTakeaway();
        this.vizState = this.years.length ? 'ready' : 'empty';
        requestAnimationFrame(() => this.render());
      },
      error: () => this.vizState = 'error',
    });
  }

  /** The function whose share of institutions changed most, first year to last. */
  private computeTakeaway(): string {
    if (this.years.length < 2) return '';
    const [first, last] = [this.years[0], this.years[this.years.length - 1]];
    const share = (year: number, bucket: string) => this.rows.find(r => r.year === year && r.group === bucket)?.share ?? 0;
    const moves = this.buckets.filter(b => b !== 'other')
      .map(b => ({ b, from: share(first, b), to: share(last, b) }))
      .sort((a, z) => Math.abs(z.to - z.from) - Math.abs(a.to - a.from));
    const top = moves[0];
    if (!top || Math.abs(top.to - top.from) < 0.01) return '';
    const pct = (v: number) => `${Math.round(v * 100)}%`;
    const verb = top.to > top.from ? 'grew' : 'fell';
    const name = top.b.charAt(0).toUpperCase() + top.b.slice(1);  // e.g. "Educational institutions"
    return `${name} ${verb} from ${pct(top.from)} of those recorded ${this.scopeLabel} in ${first} to ${pct(top.to)} in ${last}.`;
  }

  // ---- chart ----------------------------------------------------------------

  private render(): void {
    const host = this.chartRef?.nativeElement;
    if (!host || host.clientWidth === 0) return;
    d3.select(host).selectAll('*').remove();
    if (!this.rows.length) return;

    const width = host.clientWidth;
    this.lastWidth = width;
    const compact = width < 520;
    const margin = { top: 12, right: 8, bottom: 34, left: compact ? 40 : 56 };
    const height = Math.round(Math.min(460, Math.max(300, width * 0.5)));
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = d3.select(host).append('svg').attr('width', width).attr('height', height)
      .attr('role', 'img').attr('aria-label', `Institutions by function ${this.scopeLabel}, ${this.years[0]}–${this.years[this.years.length - 1]}`);
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const x = yearScale(this.years, [0, innerW]);
    const barW = Math.max(3, Math.min(34, x.step * 0.72));
    const isShare = this.state.mode === 'share';
    const y = d3.scaleLinear()
      .domain([0, isShare ? 1 : (d3.max(this.years, yr => this.totalFor(yr)) ?? 1)])
      .nice()
      .range([innerH, 0]);

    // Gridlines and y axis.
    const yTicks = y.ticks(5);
    g.append('g').attr('class', 'gridline').selectAll('line').data(yTicks).join('line')
      .attr('x1', 0).attr('x2', innerW).attr('y1', d => y(d)).attr('y2', d => y(d));
    g.append('g').call(d3.axisLeft(y).tickValues(yTicks).tickSize(0).tickPadding(6)
      .tickFormat(isShare ? d3.format('.0%') : d3.format('~s')))
      .call(sel => sel.select('.domain').remove());

    drawYearAxis(g, x, innerH, { minSpacing: compact ? 40 : 36 });

    const tooltip = d3.select(host).append('div').attr('class', 'chart-tooltip');
    for (const year of this.years) {
      const total = this.totalFor(year);
      let cumulative = 0;
      for (const bucket of this.buckets) {
        const row = this.rows.find(r => r.year === year && r.group === bucket);
        if (!row || row.count <= 0) continue;
        const top = cumulative + (isShare ? row.share : row.count);
        g.append('rect')
          .attr('x', x(year) - barW / 2).attr('width', barW)
          .attr('y', y(top)).attr('height', Math.max(0, y(cumulative) - y(top)))
          .attr('fill', this.colors[bucket] ?? '#999')
          .on('mousemove', (event: MouseEvent) => {
            const [mx, my] = d3.pointer(event, host);
            tooltip.style('opacity', '1')
              .style('left', `${Math.min(mx + 12, width - 200)}px`).style('top', `${my + 12}px`)
              .html(`<strong>${year} · ${this.labels[bucket] ?? bucket}</strong><br>` +
                `${row.count.toLocaleString()} institution${row.count === 1 ? '' : 's'} · ${(row.share * 100).toFixed(1)}% of ${total.toLocaleString()}`);
          })
          .on('mouseleave', () => tooltip.style('opacity', '0'));
        cumulative = top;
      }
    }
  }

  private totalFor(year: number): number {
    return this.rows.find(r => r.year === year)?.total ?? 0;
  }
}
