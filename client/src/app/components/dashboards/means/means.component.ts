import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import { ApiService } from '../../../services/api.service';
import { MapVisComponent } from '../../common/map-vis/map-vis.component';
import { DashboardShellComponent } from '../../common/dashboard-shell/dashboard-shell.component';
import { ControlBarComponent, ControlChip } from '../../common/control-bar/control-bar.component';
import { SegmentedComponent } from '../../common/segmented/segmented.component';
import { VizPanelComponent, VizState } from '../../common/viz-panel/viz-panel.component';
import { YearPlayerComponent } from '../../common/year-player/year-player.component';
import { UrlState } from '../../../utils/url-state';
import { drawStackedYears, StackedYear } from '../../../utils/stacked-years';
import { institutionLabel, yearRuns } from '../../../utils/record-labels';
import { INKS, MANY_INKS } from '../../../utils/palette';
import { downloadTable, citation } from '../../../utils/network-export';

type Counts = Record<string, number>;
interface Option { id: string; label: string; }
interface Dollar { inst: string; name: string; type: string; place: string; kind: 'fee' | 'cost' | 'other'; amount: number; perYear: number | null; text: string; years: number[]; }
/** GET /api/stats/means */
interface MeansResponse {
  year: number;
  years: { year: number; works: number; access: Counts; charity: Counts; churches: number; material: Counts }[];
  /** [lat, lng, instID, name, type, access, charity] */
  points: [number, number, string, string, string, string, string[]][];
  dollars: Dollar[];
  meta: { access: Option[]; charity: Option[]; material: Option[]; dioceses: Option[] };
}

/** Whom a work served by means, in the map's, bars' and key's inks. */
const ACCESS_INK: Record<string, string> = {
  paying: INKS[1], both: INKS[6], free: INKS[3], parish: '#b9b3a7', charity: INKS[2], hospital: INKS[7], unstated: '#ddd6c8',
};
const CHARITY_INK: Record<string, string> = {
  orphans: INKS[2], reform: INKS[0], refuge: INKS[6], aged: INKS[7], infants: INKS[1], servants: INKS[3], poor: MANY_INKS[18], other: '#cfc8b8',
};
const MATERIAL_INK: Record<string, string> = { stone: INKS[5], brick: INKS[6], frame: INKS[1], log: MANY_INKS[14] };

const DEFAULTS = { year: 0, diocese: '', show: 'count' };

/**
 * Paying and charity: class in the almanacs without a census. The works by
 * whom they served by means (fee-paying academies and select schools, free
 * schools, charities, hospitals), the charities by whom they took, what
 * churches were built of, and the few fees and building costs the notes give.
 */
@Component({
  selector: 'app-means',
  imports: [DecimalPipe, RouterLink, MapVisComponent, DashboardShellComponent, ControlBarComponent, SegmentedComponent, VizPanelComponent, YearPlayerComponent],
  templateUrl: './means.component.html',
  styleUrl: './means.component.scss'
})
export class MeansComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('accessChart', { static: true }) accessRef!: ElementRef<HTMLDivElement>;
  @ViewChild('charityChart', { static: true }) charityRef!: ElementRef<HTMLDivElement>;
  @ViewChild('materialChart', { static: true }) materialRef!: ElementRef<HTMLDivElement>;

  readonly related = [
    { label: 'Who Ran It, Whom It Served', link: '/dashboards/gender' },
    { label: 'Rails, Rivers and Trails', link: '/dashboards/rails-rivers' },
    { label: 'Languages and Congregations', link: '/dashboards/languages' },
  ];
  readonly showOptions = [{ value: 'count', label: 'Count' }, { value: 'share', label: 'Share' }];
  readonly accessInk = ACCESS_INK;
  readonly charityInk = CHARITY_INK;
  readonly materialInk = MATERIAL_INK;

  state = { ...DEFAULTS };
  vizState: VizState = 'loading';
  takeaway = '';
  chips: ControlChip[] = [];
  data: MeansResponse | null = null;
  years: number[] = [];
  year: number | null = null;
  current: MeansResponse['years'][number] | null = null;
  access: Option[] = [];
  charity: Option[] = [];
  material: Option[] = [];
  dioceseOptions: Option[] = [];
  fees: (Dollar & { when: string })[] = [];
  costs: (Dollar & { when: string })[] = [];
  mapData: any[] = [];
  readonly mapOptions = {
    mode: 'point' as const,
    zoom: window.innerWidth < 640 ? 2.4 : 3.4,
    center: { lat: 39, lng: -90 },
    size: { width: '100%', height: 'clamp(320px, 55vh, 560px)' },
  };

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
      const refetch = state.year !== this.state.year || state.diocese !== this.state.diocese || !this.data;
      this.state = state;
      if (refetch) this.fetchData(); else this.renderCharts();
    }));
  }

  ngAfterViewInit(): void {
    const hosts = [this.accessRef, this.charityRef, this.materialRef].map(r => r.nativeElement);
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
  setShow(show: string): void { this.url.set({ show }); }
  clearAll = (): void => this.url.set({ ...DEFAULTS });
  nameOf(list: Option[], id: string): string { return list.find(o => o.id === id)?.label ?? id; }
  label(name: string, type: string): string { return institutionLabel(name, type); }

  fetchData(): void {
    this.vizState = 'loading';
    this.fetchSub?.unsubscribe();
    const q = new URLSearchParams();
    if (this.state.year) q.set('year', String(this.state.year));
    if (this.state.diocese) q.set('diocese', this.state.diocese);
    this.fetchSub = this.api.getTypeRequest(`stats/means?${q}`).subscribe({
      next: (res: any) => this.show(res as MeansResponse),
      error: () => this.vizState = 'error',
    });
  }

  download(): void {
    const d = this.data;
    if (!d) return;
    const rows = d.years.map(y => ({ year: y.year, works: y.works,
      ...Object.fromEntries(this.access.map(a => [a.id, y.access[a.id]])),
      ...Object.fromEntries(this.charity.map(c => [`charity_${c.id}`, y.charity[c.id]])),
      churches_said: y.churches, ...Object.fromEntries(this.material.map(m => [`built_${m.id}`, y.material[m.id]])) }));
    const where = this.state.diocese ? ` (diocese ${this.nameOf(this.dioceseOptions, this.state.diocese)})` : '';
    downloadTable('paying-and-charity.csv', rows, `Catholic Almanacs: works by whom they served by means, charities by whom they took, and what churches were built of, per year${where}. ${citation()}`);
  }

  private show(d: MeansResponse): void {
    this.data = d;
    this.access = d.meta.access;
    this.charity = d.meta.charity;
    this.material = d.meta.material;
    this.dioceseOptions = d.meta.dioceses;
    this.years = d.years.filter(y => y.works || y.churches).map(y => y.year);
    this.year = d.year;
    this.current = d.years.find(y => y.year === d.year) ?? null;
    const when = (x: Dollar) => ({ ...x, when: yearRuns(x.years) });
    this.fees = d.dollars.filter(x => x.kind === 'fee').map(when);
    this.costs = d.dollars.filter(x => x.kind !== 'fee').map(when);
    this.mapData = d.points.map(([lat, lng, id, name, type, access, charity]) => ({
      latitude: lat, longitude: lng,
      title: `${institutionLabel(name, type)}: ${this.nameOf(this.access, access).toLowerCase()}`
        + (charity.length ? ` (${charity.map(c => this.nameOf(this.charity, c).toLowerCase()).join('; ')})` : ''),
      internalLink: `/institutions/${id}?year=${d.year}`,
      options: { color: ACCESS_INK[access], radius: access === 'parish' || access === 'unstated' ? 3 : 5 },
    }));
    this.chips = [
      ...(this.state.diocese ? [{ label: `Diocese: ${this.nameOf(this.dioceseOptions, this.state.diocese)}`, clear: () => this.url.set({ diocese: '' }) }] : []),
      ...(this.state.year ? [{ label: `Year: ${this.state.year}`, clear: () => this.url.set({ year: 0 }) }] : []),
    ];
    this.takeaway = this.computeTakeaway();
    this.vizState = this.years.length ? 'ready' : 'empty';
    this.renderCharts();
  }

  private computeTakeaway(): string {
    const c = this.current;
    if (!c || !c.works) return '';
    const a = c.access;
    const where = this.state.diocese ? ` in the Diocese of ${this.nameOf(this.dioceseOptions, this.state.diocese)}` : '';
    const built = c.churches ? ` Of the ${c.churches} churches whose notes say what they were built of, ${Math.round(100 * (c.material['frame'] + c.material['log']) / c.churches)}% were frame, wood or log.` : '';
    return `In ${c.year} the almanac listed ${c.works.toLocaleString()} schools, academies, colleges, asylums and hospitals${where}: `
      + `${(a['paying'] + a['both']).toLocaleString()} took paying pupils, ${(a['free'] + a['both']).toLocaleString()} kept free schools, `
      + `and ${a['charity'].toLocaleString()} were charities.${built}`;
  }

  private renderCharts(): void {
    if (!this.data) return;
    const rows = this.data.years.filter(y => this.years.includes(y.year));
    const share = this.state.show === 'share';
    const draw = (host: HTMLElement, data: StackedYear[], inks: Record<string, string>, list: Option[], ariaLabel: string) =>
      this.widths.set(host, drawStackedYears(host, data, { inks, labels: Object.fromEntries(list.map(o => [o.id, o.label])), share,
        selected: this.year, onYear: y => this.setYear(y), ariaLabel }));
    draw(this.accessRef.nativeElement, rows.map(y => ({ year: y.year, total: y.works, parts: this.access.map(a => ({ id: a.id, n: y.access[a.id] })) })),
      ACCESS_INK, this.access, 'Works each year by whom they served by means');
    draw(this.charityRef.nativeElement, rows.map(y => ({ year: y.year, total: y.access['charity'], parts: this.charity.map(c => ({ id: c.id, n: y.charity[c.id] })) })),
      CHARITY_INK, this.charity, 'Charities each year by whom they took');
    draw(this.materialRef.nativeElement, rows.map(y => ({ year: y.year, total: y.churches, parts: this.material.map(m => ({ id: m.id, n: y.material[m.id] })) })),
      MATERIAL_INK, this.material, 'Churches each year by what their notes say they were built of');
  }
}
