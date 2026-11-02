import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { DecimalPipe, PercentPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { ApiService } from '../../../services/api.service';
import { MapVisComponent } from '../../common/map-vis/map-vis.component';
import { DashboardShellComponent } from '../../common/dashboard-shell/dashboard-shell.component';
import { ControlBarComponent, ControlChip } from '../../common/control-bar/control-bar.component';
import { SegmentedComponent } from '../../common/segmented/segmented.component';
import { VizPanelComponent, VizState } from '../../common/viz-panel/viz-panel.component';
import { YearPlayerComponent } from '../../common/year-player/year-player.component';
import { UrlState } from '../../../utils/url-state';
import { drawStackedYears } from '../../../utils/stacked-years';
import { institutionLabel } from '../../../utils/record-labels';
import { INKS } from '../../../utils/palette';
import { MapContextPoint } from '../../common/map-vis/map-overlays';
import { downloadTable, citation } from '../../../utils/network-export';

/** GET /api/stats/frontier */
interface YearRow { year: number; n: number; offices: number; unchurched: number; bands: number[]; beyond15: number; measured: number; churchFirst: number; medianMiles: number | null; }
interface FrontierResponse {
  year: number;
  years: YearRow[];
  /** [lat, lng, instID, miles|null, churchFirst] */
  points: [number, number, string, number | null, number][];
  /** [lat, lng, name, state] */
  unchurched: [number, number, string, string][];
  farthest: { inst: string; name: string; type: string; place: string; miles: number | null; dio: string }[];
  dioceses: Record<string, string>;
  meta: { bands: number[]; far: number };
}

/** Distance to the nearest post office, near to far: slate in the settled country, ochre beyond it. */
const BANDS = [
  { id: 'b0', label: 'Within 1 mile', color: INKS[0] },
  { id: 'b1', label: '1–5 miles', color: '#6f88a8' },
  { id: 'b2', label: '5–15 miles', color: INKS[5] },
  { id: 'b3', label: '15–50 miles', color: '#dcb36a' },
  { id: 'b4', label: 'Farther, or none yet', color: INKS[1] },
];
const FIRST_INK: Record<string, string> = { first: INKS[4], after: INKS[0] };
const UNCHURCHED_INK = INKS[6];

const DEFAULTS = { year: 0, diocese: '', mark: 'none', show: 'beyond' };

/**
 * The Frontier: the Church against the settled country, with post offices as
 * the measure of settlement. Each year's institutions by distance to the
 * nearest post office then open, whether the church was listed before that
 * office opened, the institutions farthest from any office, and the settled
 * places with no Catholic institution near them.
 */
@Component({
  selector: 'app-frontier',
  imports: [DecimalPipe, PercentPipe, RouterLink, MapVisComponent, DashboardShellComponent, ControlBarComponent, SegmentedComponent,
    VizPanelComponent, YearPlayerComponent],
  templateUrl: './frontier.component.html',
  styleUrl: './frontier.component.scss'
})
export class FrontierComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('bandChart', { static: true }) bandsRef!: ElementRef<HTMLDivElement>;
  @ViewChild('firstChart', { static: true }) firstRef!: ElementRef<HTMLDivElement>;

  readonly related = [
    { label: 'Rails, Rivers and Trails', link: '/dashboards/rails-rivers' },
    { label: 'The Spread of the Church', link: '/dashboards/spread' },
    { label: 'Mission Circuits', link: '/dashboards/circuits' },
  ];
  readonly bands = BANDS;
  readonly firstInk = FIRST_INK;
  readonly unchurchedInk = UNCHURCHED_INK;
  readonly markOptions = [{ value: 'none', label: 'Institutions' }, { value: 'unchurched', label: 'Settled places with no church' }];
  /** The map's institutions: those beyond 5 miles of any post office (the exceptions), or all. */
  readonly showOptions = [{ value: 'beyond', label: 'Beyond the settled country' }, { value: 'all', label: 'All institutions' }];

  state = { ...DEFAULTS };
  vizState: VizState = 'loading';
  notBuilt = false;
  takeaway = '';
  chips: ControlChip[] = [];
  dioceseOptions: { id: string; name: string }[] = [];
  years: number[] = [];
  year: number | null = null;
  rows: YearRow[] = [];
  current: YearRow | null = null;
  farthest: (FrontierResponse['farthest'][number] & { label: string })[] = [];
  mapData: any[] = [];
  /** The settled places with no church, as small context dots under the institutions. */
  unchurched: MapContextPoint[] = [];
  readonly mapOptions = {
    mode: 'point' as const,
    zoom: window.innerWidth < 640 ? 2 : 3.4,
    center: { lat: 39, lng: window.innerWidth < 640 ? -96 : -94 },
    size: { width: '100%', height: 'clamp(320px, 62vh, 620px)' },
  };

  private data: FrontierResponse | null = null;
  private url: UrlState<typeof DEFAULTS>;
  private subs: Subscription[] = [];
  private fetchSub?: Subscription;
  private resizeObserver?: ResizeObserver;
  private widths = new Map<HTMLElement, number>();

  constructor(private api: ApiService, router: Router, route: ActivatedRoute) {
    this.url = new UrlState(router, route, DEFAULTS);
  }

  ngOnInit(): void {
    this.subs.push(this.url.changes().subscribe(state => {
      const markOnly = !!this.data && (state.mark !== this.state.mark || state.show !== this.state.show) && state.year === this.state.year && state.diocese === this.state.diocese;
      this.state = state;
      this.chips = [
        ...(state.diocese ? [{ label: `Diocese: ${this.data?.dioceses[state.diocese] ?? state.diocese}`, clear: () => this.url.set({ diocese: '' }) }] : []),
      ];
      if (markOnly) { this.update(this.year ?? 0); return; }
      this.fetchData();
    }));
  }

  ngAfterViewInit(): void {
    const hosts = [this.bandsRef.nativeElement, this.firstRef.nativeElement];
    this.resizeObserver = new ResizeObserver(() => {
      if (hosts.some(el => el.clientWidth > 0 && el.clientWidth !== this.widths.get(el))) this.renderCharts();
    });
    hosts.forEach(h => this.resizeObserver!.observe(h));
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    this.fetchSub?.unsubscribe();
    this.resizeObserver?.disconnect();
  }

  setYear(year: number): void { this.url.set({ year }); }
  setDiocese(diocese: string): void { this.url.set({ diocese }); }
  setMark(mark: string): void { this.url.set({ mark }); }
  setShow(show: string): void { this.url.set({ show }); }
  clearAll = (): void => this.url.set({ diocese: '', mark: 'none', show: 'beyond' });
  share(n: number, of: number): number { return of ? n / of : 0; }

  fetchData(): void {
    if (!this.data) this.vizState = 'loading';
    this.fetchSub?.unsubscribe();
    const q = new URLSearchParams();
    if (this.state.year) q.set('year', String(this.state.year));
    if (this.state.diocese) q.set('diocese', this.state.diocese);
    this.fetchSub = this.api.getTypeRequest(`stats/frontier?${q}`).pipe(
      catchError(err => { this.notBuilt = err?.status === 404; return of(null); }),
    ).subscribe((res: any) => {
      if (!res) { this.vizState = this.notBuilt ? 'empty' : 'error'; return; }
      this.data = res as FrontierResponse;
      this.dioceseOptions = Object.entries(this.data.dioceses).filter(([id]) => id !== 'unknown')
        .map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
      this.rows = this.data.years;
      this.years = this.rows.map(r => r.year);
      this.vizState = this.rows.length ? 'ready' : 'empty';
      this.update(this.data.year);
    });
  }

  download(): void {
    if (!this.data) return;
    const rows = this.rows.map(r => ({ year: r.year, institutions: r.n, post_offices_open: r.offices,
      within_1_mi: r.bands[0], within_5_mi: r.bands[1], within_15_mi: r.bands[2], within_50_mi: r.bands[3], farther_or_none: r.bands[4],
      beyond_15_mi: r.beyond15, median_miles: r.medianMiles, measured: r.measured, church_before_post_office: r.churchFirst,
      offices_with_no_church_within_25_mi: r.unchurched }));
    const where = this.state.diocese ? ` (diocese ${this.data.dioceses[this.state.diocese]})` : '';
    downloadTable('frontier.csv', rows, `Catholic Almanacs: institutions by distance to the nearest post office open in their year${where}; post offices from Blevins and Helbock, US Post Offices (CC0). ${citation()}`);
  }

  private update(year: number): void {
    if (!this.data) return;
    this.year = year || this.data.year;
    this.current = this.rows.find(r => r.year === this.year) ?? null;
    const bandOf = (miles: number | null) => miles == null ? 4 : miles <= 1 ? 0 : miles <= 5 ? 1 : miles <= 15 ? 2 : miles <= 50 ? 3 : 4;
    const shown = this.state.show === 'all' ? this.data.points : this.data.points.filter(p => p[3] == null || p[3] > 5);
    this.mapData = shown.map(([lat, lng, id, miles, first]) => ({
      latitude: lat, longitude: lng,
      title: (miles == null ? 'No post office yet within 500 miles' : `${miles} mi from the nearest post office`) + (first ? '; listed before it opened' : ''),
      internalLink: `/institutions/${id}?year=${this.year}`,
      options: { color: BANDS[bandOf(miles)].color, radius: 4 },
    }));
    this.unchurched = this.state.mark === 'unchurched'
      ? this.data.unchurched.map(([lat, lng, name, st]) => ({ lat, lng, color: UNCHURCHED_INK, radius: 3.5, title: `${name}, ${st}: a post office with no Catholic institution within 25 miles` }))
      : [];
    this.farthest = this.data.farthest.map(f => ({ ...f, label: institutionLabel(f.name, f.type) }));
    this.takeaway = this.computeTakeaway();
    this.renderCharts();
  }

  private computeTakeaway(): string {
    const cur = this.current;
    if (!cur) return '';
    const pct = (n: number, of: number) => Math.round(100 * n / (of || 1));
    const where = this.state.diocese ? ` in the Diocese of ${this.data?.dioceses[this.state.diocese]}` : '';
    const first = cur.measured ? ` Of those with a post office near, ${pct(cur.churchFirst, cur.measured)}% were listed in the almanac before the nearest office opened.` : '';
    return `In ${cur.year}, ${pct(cur.beyond15, cur.n)}% of the institutions recorded${where} stood more than 15 miles from any post office then open, `
      + `and ${pct(cur.bands[0] + cur.bands[1], cur.n)}% within 5 miles of one.${first} `
      + `That year ${cur.offices.toLocaleString()} post offices were open, ${cur.unchurched.toLocaleString()} of them with no Catholic institution within 25 miles.`;
  }

  private renderCharts(): void {
    if (!this.rows.length) return;
    const labels = Object.fromEntries(BANDS.map(b => [b.id, b.label]));
    this.widths.set(this.bandsRef.nativeElement, drawStackedYears(this.bandsRef.nativeElement,
      this.rows.map(r => ({ year: r.year, total: r.n, parts: BANDS.map((b, i) => ({ id: b.id, n: r.bands[i] })) })),
      { inks: Object.fromEntries(BANDS.map(b => [b.id, b.color])), labels, share: true, selected: this.year,
        onYear: y => this.setYear(y), ariaLabel: 'Institutions each year by distance to the nearest post office' }));
    this.widths.set(this.firstRef.nativeElement, drawStackedYears(this.firstRef.nativeElement,
      this.rows.map(r => ({ year: r.year, total: r.measured, parts: [{ id: 'first', n: r.churchFirst }, { id: 'after', n: r.measured - r.churchFirst }] })),
      { inks: FIRST_INK, labels: { first: 'listed before the nearest post office opened', after: 'listed after it' }, share: true, selected: this.year,
        onYear: y => this.setYear(y), ariaLabel: 'Institutions each year listed before or after the nearest post office opened' }));
  }
}
