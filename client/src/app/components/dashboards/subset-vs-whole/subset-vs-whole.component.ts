import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, combineLatest } from 'rxjs';
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

interface SeriesPoint { year: number; count: number; }

/**
 * `category` / `value` are '' for "the default for this kind" (so switching
 * kind never leaves a stale value in the URL); `base` 0 means the automatic
 * index base year.
 */
const DEFAULTS = { entity: 'institutions', kind: 'function', category: '', slice: 'state', value: '', mode: 'indexed', base: 0 };
const DEFAULT_CATEGORY: Record<string, string> = { function: 'educational institutions', type: 'church' };

@Component({
  selector: 'app-subset-vs-whole-dashboard',
  imports: [SpaceNamePipe, DashboardShellComponent, ControlBarComponent, VizPanelComponent, SegmentedComponent],
  templateUrl: './subset-vs-whole.component.html',
  styleUrl: './subset-vs-whole.component.scss'
})
export class SubsetVsWholeDashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('chart', { static: true }) chartRef!: ElementRef<HTMLDivElement>;

  readonly related = [
    { label: 'Comparing Places', link: '/dashboards/comparison' },
    { label: 'The Shape of the Church', link: '/dashboards/composition' },
    { label: 'Coverage — the Shape of the Data', link: '/dashboards/coverage' },
  ];
  readonly modes = [{ value: 'indexed', label: 'Indexed growth' }, { value: 'count', label: 'Raw count' }];
  readonly kinds = [{ value: 'function', label: 'Function' }, { value: 'type', label: 'Type' }];
  readonly slices = [{ value: 'state', label: 'State' }, { value: 'diocese', label: 'Diocese' }, { value: 'order', label: 'Religious order' }];
  readonly typeOptions = ['church', 'chapel', 'mission', 'cathedral', 'school', 'academy', 'college', 'seminary', 'convent', 'hospital', 'asylum'];
  readonly functionOptions = ['religious institutions', 'educational institutions', 'consecrated life institutions', 'charitable institutions', 'healthcare institutions'];
  readonly usStates = US_STATES;
  orderOptions: string[] = [];
  dioceseOptions: string[] = [];

  state = { ...DEFAULTS };
  /** Effective selections (URL defaults resolved). */
  category = DEFAULT_CATEGORY['function'];
  value = 'NY';
  baseYear: number | null = null;
  categoryOptions: string[] = this.functionOptions;
  baseYearOptions: number[] = [];

  vizState: VizState = 'loading';
  note = '';
  takeaway = '';
  chips: ControlChip[] = [];
  cautions: string[] = [];
  subsetLabel = '';
  categoryDisplay = '';
  years: number[] = [];

  private whole: SeriesPoint[] = [];
  private subset: SeriesPoint[] = [];
  private url: UrlState<typeof DEFAULTS>;
  private subs: Subscription[] = [];
  private fetchSub?: Subscription;
  private resizeObserver?: ResizeObserver;
  private lastWidth = 0;

  readonly wholeColor = 'var(--ink-3)';
  readonly entities = [{ value: 'institutions', label: 'Institutions' }, { value: 'people', label: 'People' }];

  get people(): boolean {
    return this.state.entity === 'people';
  }

  get subsetColor(): string {
    return this.people ? 'var(--c-pers)' : 'var(--c-inst)';
  }

  /** "people at all schools" / "all schools" */
  get wholeLabel(): string {
    return (this.people ? 'people at all ' : 'all ') + this.categoryDisplay;
  }

  constructor(private api: ApiService, private http: HttpClient, router: Router, route: ActivatedRoute) {
    this.url = new UrlState(router, route, DEFAULTS);
  }

  ngOnInit(): void {
    // Refetch only when the selection changes; mode / base year just redraw.
    let scope: string | null = null;
    const options$ = combineLatest([loadOptions(this.http, 'order.csv'), loadOptions(this.http, 'diocese.csv')]);
    this.subs.push(combineLatest([options$, this.url.changes()]).subscribe(([[orders, dioceses], state]) => {
      this.orderOptions = orders;
      this.dioceseOptions = dioceses;
      this.state = state;
      this.categoryOptions = state.kind === 'type' ? this.typeOptions : this.functionOptions;
      this.category = state.category || DEFAULT_CATEGORY[state.kind] || this.categoryOptions[0];
      this.value = state.value || (state.slice === 'state' ? 'NY' : state.slice === 'diocese' ? dioceses[0] : orders[0]) || '';
      this.subsetLabel = state.slice === 'state' ? stateName(this.value) : spaceName(this.value);
      this.categoryDisplay = this.pluralCategory();
      this.chips = [
        ...(state.category || state.kind !== DEFAULTS.kind ? [{ label: `Counting: ${this.category}`, clear: () => this.url.set({ kind: DEFAULTS.kind, category: '' }) }] : []),
        ...(state.value || state.slice !== DEFAULTS.slice ? [{ label: `Part: ${this.subsetLabel}`, clear: () => this.url.set({ slice: DEFAULTS.slice, value: '' }) }] : []),
      ];
      const key = `${state.entity}|${state.kind}|${this.category}|${state.slice}|${this.value}`;
      if (key !== scope) {
        scope = key;
        this.fetchData();
      } else {
        this.updateView();
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

  setEntity(entity: string): void {
    this.url.set({ entity });
  }

  setMode(mode: string): void { this.url.set({ mode }); }
  setKind(kind: string): void { this.url.set({ kind, category: '' }); }
  setCategory(category: string): void { this.url.set({ category }); }
  setSlice(slice: string): void { this.url.set({ slice, value: '' }); }
  setValue(value: string): void { this.url.set({ value }); }
  setBase(base: string): void { this.url.set({ base: Number(base) }); }

  clearAll = (): void => this.url.set({ kind: DEFAULTS.kind, category: '', slice: DEFAULTS.slice, value: '' });

  /** Function values are plural phrases; type values are singular nouns. */
  private pluralCategory(): string {
    const c = this.category;
    if (this.state.kind === 'function') return c;
    if (/[^aeiou]y$/.test(c)) return c.slice(0, -1) + 'ies';
    if (/(ch|sh|s|x)$/.test(c)) return c + 'es';
    return c + 's';
  }

  // ---- data -----------------------------------------------------------------

  fetchData(): void {
    if (!this.category || !this.value) return;
    this.vizState = 'loading';
    const q = new URLSearchParams({
      ...(this.people ? { entity: 'people' } : {}),
      categoryKind: this.state.kind, category: this.category,
      subsetKind: this.state.slice, subsetValue: this.value,
    });
    this.fetchSub?.unsubscribe();
    this.fetchSub = this.api.getTypeRequest('stats/subset-vs-whole?' + q).subscribe({
      next: (res: any) => {
        this.whole = res.whole ?? [];
        this.subset = res.subset ?? [];
        this.years = res.meta?.years ?? [];
        this.note = res.meta?.note ?? '';
        this.vizState = this.years.length ? 'ready' : 'empty';
        this.updateView();
      },
      error: () => this.vizState = 'error',
    });
  }

  /** Derived view state for the current data + presentation params, then redraw. */
  private updateView(): void {
    this.baseYearOptions = this.years.slice(0, -1);
    this.baseYear = this.baseYearOptions.includes(this.state.base) ? this.state.base : this.defaultBaseYear();
    this.takeaway = this.computeTakeaway();
    this.cautions = this.computeCautions();
    requestAnimationFrame(() => this.render());
  }

  /**
   * Start of the most recent unbroken run of years (a single missing year is
   * tolerated), so growth isn't distorted by a long coverage gap.
   */
  private defaultBaseYear(): number | null {
    const ys = this.years;
    if (ys.length < 2) return ys[0] ?? null;
    let base = ys[ys.length - 1];
    for (let i = ys.length - 1; i > 0; i--) {
      if (ys[i] - ys[i - 1] <= 2) base = ys[i - 1]; else break;
    }
    return base === ys[ys.length - 1] ? ys[ys.length - 2] : base;
  }

  private countAt(series: SeriesPoint[], year: number): number {
    return series.find(s => s.year === year)?.count ?? 0;
  }

  private computeTakeaway(): string {
    if (this.baseYear == null || this.years.length < 2) return '';
    const base = this.baseYear, last = this.years[this.years.length - 1];
    const wb = this.countAt(this.whole, base), wl = this.countAt(this.whole, last);
    const sb = this.countAt(this.subset, base), sl = this.countAt(this.subset, last);
    const n = (v: number) => v.toLocaleString();
    const change = (from: number, to: number) => {
      const pct = Math.round((to / from - 1) * 100);
      const verb = pct > 0 ? `grew ${pct}%` : pct < 0 ? `fell ${-pct}%` : 'held steady';
      return `${verb} (${n(from)} → ${n(to)})`;
    };
    const whole = wb > 0 ? `${this.wholeLabel} ${change(wb, wl)}` : `${this.wholeLabel} went from none to ${n(wl)}`;
    if (sb <= 0) return `Between ${base} and ${last}, ${whole}; ${this.subsetLabel} had none recorded in ${base}.`;
    let pace = '';
    if (wb > 0) {
      const ws = wl / wb, ss = sl / sb;
      pace = Math.abs(ss - ws) < 0.02 ? ' — about the same pace' : ss > ws ? ' — faster than the whole' : ' — slower than the whole';
    }
    return `Between ${base} and ${last}, ${whole}, while those ${this.people ? 'serving in' : 'in'} ${this.subsetLabel} ${change(sb, sl)}${pace}.`;
  }

  private computeCautions(): string[] {
    const out: string[] = [];
    const nz = this.subset.filter(p => p.count > 0).map(p => p.year);
    if (this.state.slice === 'order' && nz.length) {
      const [lo, hi] = [Math.min(...nz), Math.max(...nz)];
      out.push(`This order is tagged only ${lo === hi ? 'in ' + lo : 'across ' + lo + '–' + hi}, and order tagging is sparse, so order subsets rest on small numbers.`);
    }
    if (this.state.mode === 'indexed' && this.baseYear != null && this.countAt(this.subset, this.baseYear) === 0) {
      out.push(`${this.subsetLabel} had none recorded in ${this.baseYear}, so its indexed line can’t be drawn — choose a later base year or switch to Raw count.`);
    }
    const min = this.years.length ? Math.min(...this.years.map(y => this.countAt(this.subset, y))) : 0;
    if (min > 0 && min < 5) {
      const noun = this.people ? (min === 1 ? 'person' : 'people') : (min === 1 ? 'institution' : 'institutions');
      out.push(`The part dips as low as ${min} ${noun} in some years — read the indexed growth cautiously and check the raw counts.`);
    }
    return out;
  }

  // ---- chart ----------------------------------------------------------------

  private render(): void {
    const host = this.chartRef?.nativeElement;
    if (!host || host.clientWidth === 0) return;
    d3.select(host).selectAll('*').remove();
    const years = this.years;
    if (!years.length) return;

    const indexed = this.state.mode === 'indexed' && this.baseYear != null;
    const wholeBase = indexed ? this.countAt(this.whole, this.baseYear!) : 1;
    const subsetBase = indexed ? this.countAt(this.subset, this.baseYear!) : 1;
    const value = (series: SeriesPoint[], base: number, year: number): number | null => {
      const c = this.countAt(series, year);
      if (!indexed) return c;
      return base > 0 ? (c / base) * 100 : null;
    };

    const width = host.clientWidth;
    this.lastWidth = width;
    const compact = width < 520;
    const margin = { top: 12, right: 12, bottom: 34, left: compact ? 44 : 60 };
    const height = Math.round(Math.min(440, Math.max(280, width * 0.48)));
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = d3.select(host).append('svg').attr('width', width).attr('height', height)
      .attr('role', 'img')
      .attr('aria-label', `${this.categoryDisplay}: ${this.subsetLabel} against the national total, ${years[0]}–${years[years.length - 1]}`);
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const x = yearScale(years, [0, innerW]);
    const vals: number[] = [];
    for (const yr of years) {
      const w = value(this.whole, wholeBase, yr); if (w != null) vals.push(w);
      const s = value(this.subset, subsetBase, yr); if (s != null) vals.push(s);
    }
    const y = d3.scaleLinear().domain([0, (d3.max(vals) ?? 1) * 1.05]).nice().range([innerH, 0]);

    const yTicks = y.ticks(5);
    g.append('g').attr('class', 'gridline').selectAll('line').data(yTicks).join('line')
      .attr('x1', 0).attr('x2', innerW).attr('y1', d => y(d)).attr('y2', d => y(d));
    g.append('g').call(d3.axisLeft(y).tickValues(yTicks).tickSize(0).tickPadding(6).tickFormat(d3.format('~s')))
      .call(sel => sel.select('.domain').remove());
    g.append('text').attr('transform', 'rotate(-90)')
      .attr('x', -innerH / 2).attr('y', -margin.left + 12).attr('text-anchor', 'middle')
      .style('font-size', '11px')
      .text(indexed ? `${this.baseYear} = 100` : this.people ? 'People recorded' : 'Institutions recorded');

    drawYearAxis(g, x, innerH, { minSpacing: compact ? 40 : 36 });

    if (indexed) {
      g.append('line').attr('x1', 0).attr('x2', innerW).attr('y1', y(100)).attr('y2', y(100))
        .style('stroke', 'var(--ink-3)').attr('stroke-dasharray', '4 3');
      g.append('line').attr('x1', x(this.baseYear!)).attr('x2', x(this.baseYear!)).attr('y1', 0).attr('y2', innerH)
        .style('stroke', 'var(--ink-3)').attr('stroke-dasharray', '2 3');
    }

    const drawSeries = (series: SeriesPoint[], base: number, color: string) => {
      const pts = years.map(yr => ({ year: yr, v: value(series, base, yr) }))
        .filter(p => p.v != null) as { year: number; v: number }[];
      // Break the line wherever the axis breaks (missing years).
      const segments: { year: number; v: number }[][] = [];
      let seg: { year: number; v: number }[] = [];
      pts.forEach((p, i) => {
        if (i > 0 && p.year - pts[i - 1].year > 1) { segments.push(seg); seg = []; }
        seg.push(p);
      });
      if (seg.length) segments.push(seg);
      const line = d3.line<{ year: number; v: number }>().x(p => x(p.year)).y(p => y(p.v));
      for (const s of segments) {
        g.append('path').datum(s).attr('fill', 'none').style('stroke', color).attr('stroke-width', 2.5).attr('d', line);
      }
      g.selectAll(null).data(pts).enter().append('circle')
        .attr('cx', p => x(p.year)).attr('cy', p => y(p.v)).attr('r', compact ? 2.5 : 3.5).style('fill', color);
    };
    drawSeries(this.whole, wholeBase, this.wholeColor);
    drawSeries(this.subset, subsetBase, this.subsetColor);

    const tooltip = d3.select(host).append('div').attr('class', 'chart-tooltip');
    const band = Math.max(8, x.step);
    for (const yr of years) {
      const wc = this.countAt(this.whole, yr), sc = this.countAt(this.subset, yr);
      g.append('rect')
        .attr('x', x(yr) - band / 2).attr('y', 0).attr('width', band).attr('height', innerH)
        .attr('fill', 'transparent')
        .on('mousemove', (event: MouseEvent) => {
          const [mx, my] = d3.pointer(event, host);
          const share = wc > 0 ? ((sc / wc) * 100).toFixed(1) : '0.0';
          tooltip.style('opacity', '1')
            .style('left', `${Math.min(mx + 12, width - 220)}px`).style('top', `${my + 12}px`)
            .html(`<strong>${yr}</strong><br>All: ${wc.toLocaleString()}<br>${this.subsetLabel}: ${sc.toLocaleString()} (${share}% of all)`);
        })
        .on('mouseleave', () => tooltip.style('opacity', '0'));
    }
  }
}
