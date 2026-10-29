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
  selector: 'app-people-hierarchy-dashboard',
  imports: [SpaceNamePipe, DashboardShellComponent, ControlBarComponent, VizPanelComponent, SegmentedComponent],
  templateUrl: './people-hierarchy.component.html',
  styleUrl: './people-hierarchy.component.scss'
})
export class PeopleHierarchyDashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('chart', { static: true }) chartRef!: ElementRef<HTMLDivElement>;

  readonly related = [
    { label: 'Who Served the Church', link: '/dashboards/people-composition' },
    { label: 'The Shape of the Church', link: '/dashboards/composition' },
    { label: 'Comparing People', link: '/dashboards/people-comparison' },
    { label: 'The People Network', link: '/dashboards/network-people' },
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

  // Clergy rank labels and a high-to-low colour ramp.
  private readonly labels: Record<string, string> = {
    'archbishop': 'Archbishops (Most Rev.)',
    'bishop': 'Bishops (Rt. Rev.)',
    'vicar or superior': 'Vicars & superiors (Very Rev.)',
    'priest': 'Priests (Rev.)',
    'seminarian or lay': 'Seminarians & lay (Mr.)',
    'other': 'Other / unrecorded'
  };
  private readonly colors: Record<string, string> = {
    'archbishop': '#5b2a86',
    'bishop': '#9b4f9e',
    'vicar or superior': '#3c6e9e',
    'priest': '#3f9e7a',
    'seminarian or lay': '#e0a83b',
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
    const q = new URLSearchParams({ entity: 'people', dimension: 'title' });
    if (this.state.diocese) q.set('diocese', this.state.diocese);
    if (this.state.state) q.set('state', this.state.state);
    this.fetchSub?.unsubscribe();
    this.fetchSub = this.api.getTypeRequest('stats/composition?' + q).subscribe({
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

  /** How many priests there were for each bishop or archbishop, first year to last. */
  private computeTakeaway(): string {
    const count = (year: number, bucket: string) => this.rows.find(r => r.year === year && r.group === bucket)?.count ?? 0;
    const ratio = (year: number) => {
      const bishops = count(year, 'archbishop') + count(year, 'bishop');
      return bishops ? count(year, 'priest') / bishops : 0;
    };
    const years = this.years.filter(y => ratio(y) > 0);
    if (years.length < 2) return '';
    const [first, last] = [years[0], years[years.length - 1]];
    const n = (v: number) => Math.round(v).toLocaleString();
    return `${this.scopeLabel.charAt(0).toUpperCase() + this.scopeLabel.slice(1)}, there were about ${n(ratio(first))} priests for every bishop or archbishop in ${first}, and ${n(ratio(last))} in ${last}.`;
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
      .attr('role', 'img').attr('aria-label', `Clergy by rank ${this.scopeLabel}, ${this.years[0]}–${this.years[this.years.length - 1]}`);
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const x = yearScale(this.years, [0, innerW]);
    const barW = Math.max(3, Math.min(34, x.step * 0.72));
    const isShare = this.state.mode === 'share';
    const y = d3.scaleLinear()
      .domain([0, isShare ? 1 : (d3.max(this.years, yr => this.totalFor(yr)) ?? 1)])
      .nice()
      .range([innerH, 0]);

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
                `${row.count.toLocaleString()} ${row.count === 1 ? 'person' : 'people'} · ${(row.share * 100).toFixed(1)}% of ${total.toLocaleString()}`);
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
