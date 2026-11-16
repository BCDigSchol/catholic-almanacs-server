import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { DecimalPipe, PercentPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { ApiService } from '../../../services/api.service';
import { DashboardShellComponent } from '../../common/dashboard-shell/dashboard-shell.component';
import { ControlBarComponent, ControlChip } from '../../common/control-bar/control-bar.component';
import { SegmentedComponent } from '../../common/segmented/segmented.component';
import { VizPanelComponent, VizState } from '../../common/viz-panel/viz-panel.component';
import { UrlState } from '../../../utils/url-state';
import { drawAlluvial } from '../../../utils/alluvial';
import { INKS, OTHER_INK } from '../../../utils/palette';
import { downloadTable, citation } from '../../../utils/network-export';

interface Option { id: string; label: string; }
interface Link { from: string; to: string; n: number; }
/** GET /api/stats/careers */
interface CareersResponse {
  by: 'kind' | 'ring';
  categories: Option[];
  /** Per post (first to fourth): category id → people. */
  steps: Record<string, number>[];
  /** links[k]: from post k to post k + 1. */
  links: Link[][];
  paths: { path: Option[]; n: number }[];
  totals: { people: number; movers: number; posts: number[]; moves: number; same: number };
  meta: { dioceses: Option[]; orders: Option[] };
}

const DEFAULTS = { by: 'kind', diocese: '', order: '' };
/** The categorical inks without the one kept for "Other". */
const NAMED_INKS = INKS.filter(c => c !== OTHER_INK);
const COLUMNS = ['First post', 'Second post', 'Third post', 'Fourth post'];

/**
 * Career Paths: where clergy went from one post to the next, in aggregate.
 * Each person's resident posts in order, sorted by the kind of place or its
 * distance from the cathedral, drawn as flows from the first post to the
 * fourth, with the commonest paths listed.
 */
@Component({
  selector: 'app-careers',
  imports: [DecimalPipe, PercentPipe, DashboardShellComponent, ControlBarComponent, SegmentedComponent, VizPanelComponent],
  templateUrl: './careers.component.html',
  styleUrl: './careers.component.scss'
})
export class CareersComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('flow', { static: true }) flowRef!: ElementRef<HTMLDivElement>;

  readonly related = [
    { label: 'Clergy Flows', link: '/dashboards/clergy-flows' },
    { label: 'Served Under', link: '/dashboards/networks', queryParams: { view: 'lineage' } },
    { label: 'Center and Periphery', link: '/dashboards/center-periphery' },
    { label: 'Lifespans and Turnover', link: '/dashboards/turnover' },
  ];
  readonly byOptions = [{ value: 'kind', label: 'Kind of place' }, { value: 'ring', label: 'Distance from the cathedral' }];

  state = { ...DEFAULTS };
  vizState: VizState = 'loading';
  takeaway = '';
  chips: ControlChip[] = [];
  data: CareersResponse | null = null;
  key: (Option & { color: string })[] = [];
  dioceseOptions: Option[] = [];
  orderOptions: Option[] = [];

  private url: UrlState<typeof DEFAULTS>;
  private subs: Subscription[] = [];
  private fetchSub?: Subscription;
  private resizeObserver?: ResizeObserver;
  private width = 0;

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
    const el = this.flowRef.nativeElement;
    this.resizeObserver = new ResizeObserver(() => {
      if (el.clientWidth > 0 && el.clientWidth !== this.width) this.render();
    });
    this.resizeObserver.observe(el);
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    this.fetchSub?.unsubscribe();
    this.resizeObserver?.disconnect();
  }

  setBy(by: string): void { this.url.set({ by }); }
  setDiocese(diocese: string): void { this.url.set({ diocese }); }
  setOrder(order: string): void { this.url.set({ order }); }
  clearAll = (): void => this.url.set({ diocese: '', order: '' });

  /** "kind of place" or "distance band", for sentences. */
  get what(): string { return this.state.by === 'ring' ? 'distance band' : 'kind of place'; }

  /** "among Jesuits listed in the Diocese of Boston" for the heading. */
  get scope(): string {
    const parts: string[] = [];
    if (this.state.order) parts.push(this.state.order);
    if (this.state.diocese) parts.push(`people listed in ${this.dioceseOptions.find(d => d.id === this.state.diocese)?.label ?? this.state.diocese}`);
    return parts.length ? `, ${parts.join(', ')}` : '';
  }

  fetchData(): void {
    this.vizState = 'loading';
    this.fetchSub?.unsubscribe();
    const q = new URLSearchParams({ by: this.state.by });
    if (this.state.diocese) q.set('diocese', this.state.diocese);
    if (this.state.order) q.set('order', this.state.order);
    this.fetchSub = this.api.getTypeRequest(`stats/careers?${q}`).subscribe({
      next: (res: any) => this.show(res as CareersResponse),
      error: () => this.vizState = 'error',
    });
  }

  private show(res: CareersResponse): void {
    this.data = res;
    this.dioceseOptions = res.meta.dioceses;
    this.orderOptions = res.meta.orders;
    const named = res.categories.filter(c => c.id !== 'other' && c.id !== 'No place recorded');
    this.key = res.categories
      .filter(c => res.steps.some(s => (s[c.id] ?? 0) > 0))
      .map(c => ({ ...c, color: named.includes(c) ? NAMED_INKS[named.indexOf(c) % NAMED_INKS.length] : OTHER_INK }));
    this.chips = [
      ...(this.state.diocese ? [{ label: `Diocese: ${this.dioceseOptions.find(d => d.id === this.state.diocese)?.label ?? this.state.diocese}`, clear: () => this.setDiocese('') }] : []),
      ...(this.state.order ? [{ label: `Order: ${this.state.order}`, clear: () => this.setOrder('') }] : []),
    ];
    this.takeaway = this.buildTakeaway(res);
    this.vizState = res.totals.movers ? 'ready' : 'empty';
    this.render();
  }

  /** Most moves keep to the same category; the commonest that does not. */
  private buildTakeaway(res: CareersResponse): string {
    const t = res.totals;
    if (!t.movers) return '';
    const label = new Map(res.categories.map(c => [c.id, c.label.toLowerCase()]));
    const change = new Map<string, number>();
    for (const list of res.links) for (const l of list) if (l.from !== l.to) change.set(`${l.from}|${l.to}`, (change.get(`${l.from}|${l.to}`) ?? 0) + l.n);
    const [top, n] = [...change.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
    const share = Math.round(100 * t.same / t.moves);
    const lead = `Of ${t.people.toLocaleString()} people with a resident post, ${t.movers.toLocaleString()} are listed at a second; ${share}% of their moves stayed in the same ${this.what}.`;
    if (!top) return lead;
    const [from, to] = top.split('|');
    return `${lead} The commonest change: ${label.get(from)} to ${label.get(to)}, ${n} times.`;
  }

  private render(): void {
    const el = this.flowRef?.nativeElement;
    const d = this.data;
    if (!el || !d) return;
    this.width = el.clientWidth;
    const ordinal = ['first', 'second', 'third', 'fourth'];
    // on a phone the headings shorten to fit over their columns
    const columns = this.width < 560 ? COLUMNS.map(c => c.replace(' post', '')) : COLUMNS;
    drawAlluvial(el, { columns, categories: this.key, steps: d.steps, links: d.links }, {
      label: `Flows of people from their first resident post to their fourth, by ${this.what}`,
      title: (k, from, to, n) => from === to
        ? `${n.toLocaleString()} stayed in the same ${this.what} (${from}) from their ${ordinal[k]} post to their ${ordinal[k + 1]}`
        : `${n.toLocaleString()} went from ${from} to ${to}, ${ordinal[k]} post to ${ordinal[k + 1]}`,
    });
  }

  colorOf(id: string): string { return this.key.find(k => k.id === id)?.color ?? OTHER_INK; }

  download(): void {
    const d = this.data;
    if (!d) return;
    const label = new Map(d.categories.map(c => [c.id, c.label]));
    const rows = d.links.flatMap((list, k) => list.map(l => ({ from_post: k + 1, to_post: k + 2, from: label.get(l.from), to: label.get(l.to), people: l.n })));
    downloadTable(`career-paths-${this.state.by}.csv`, rows,
      `Catholic Almanacs career paths by ${this.what}${this.scope}: people moving from one resident post to the next. ${citation()}`);
  }
}
