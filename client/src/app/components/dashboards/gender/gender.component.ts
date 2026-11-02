import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
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
import { institutionLabel } from '../../../utils/record-labels';
import { INKS, COUNT_RAMP } from '../../../utils/palette';
import { downloadTable, citation } from '../../../utils/network-export';

type Counts = Record<string, number>;
interface Option { id: string; label: string; }
/** GET /api/stats/gender */
interface GenderResponse {
  year: number;
  years: { year: number; total: number; run: Counts; served: Counts }[];
  kinds: (Option & { total: number; run: Counts })[];
  congregations: { id: string; label: string; sex: 'women' | 'men'; total: number; years: Record<string, number> }[];
  /** [lat, lng, instID, name, type, run, served, congregations] */
  points: [number, number, string, string, string, string, string, string[]][];
  meta: { kinds: Option[]; run: Option[]; served: Option[]; dioceses: Option[] };
}

/** Who ran a work, in the map's, bars' and key's inks. */
const RUN_INK: Record<string, string> = {
  women: INKS[2], mixed: INKS[7], men: INKS[0], clergy: INKS[6], lay: INKS[1], unstated: '#cfc8b8',
};
const SERVED_INK: Record<string, string> = { girls: INKS[2], boys: INKS[0], both: INKS[3] };

const DEFAULTS = { year: 0, diocese: '', kind: '', show: 'count' };

/**
 * Who ran it, whom it served: the Church's schools, academies, colleges,
 * asylums, hospitals and religious houses by who the almanacs say ran them
 * (women's congregations, men religious, diocesan clergy, lay teachers) and
 * whether they served girls, boys or both — the women of the Church read
 * through the institutions they ran, since the clergy lists name almost none.
 */
@Component({
  selector: 'app-gender',
  imports: [DecimalPipe, MapVisComponent, DashboardShellComponent, ControlBarComponent, SegmentedComponent, VizPanelComponent, YearPlayerComponent],
  templateUrl: './gender.component.html',
  styleUrl: './gender.component.scss'
})
export class GenderComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('runChart', { static: true }) runRef!: ElementRef<HTMLDivElement>;
  @ViewChild('servedChart', { static: true }) servedRef!: ElementRef<HTMLDivElement>;

  readonly related = [
    { label: 'Languages and Congregations', link: '/dashboards/languages' },
    { label: 'The Shape of the Church', link: '/dashboards/composition' },
    { label: 'Religious Orders', link: '/dashboards/orders' },
  ];
  readonly showOptions = [{ value: 'count', label: 'Count' }, { value: 'share', label: 'Share' }];
  readonly runInk = RUN_INK;
  readonly servedInk = SERVED_INK;

  state = { ...DEFAULTS };
  vizState: VizState = 'loading';
  takeaway = '';
  chips: ControlChip[] = [];
  data: GenderResponse | null = null;
  years: number[] = [];
  year: number | null = null;
  current: GenderResponse['years'][number] | null = null;
  run: Option[] = [];
  served: Option[] = [];
  kindOptions: Option[] = [];
  dioceseOptions: Option[] = [];
  /** The year's kinds of work, each as bar segments. */
  kindRows: { id: string; label: string; total: number; parts: { id: string; n: number; pct: number }[] }[] = [];
  /** Congregations × years, shaded by institutions. */
  grid: { label: string; sex: string; total: number; cells: { year: number; n: number; bg: string; fg: string }[] }[] = [];
  gridAll = false;
  gridCount = 0;
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
      const refetch = state.year !== this.state.year || state.diocese !== this.state.diocese || state.kind !== this.state.kind || !this.data;
      this.state = state;
      if (refetch) this.fetchData(); else this.renderCharts();
    }));
  }

  ngAfterViewInit(): void {
    this.resizeObserver = new ResizeObserver(() => {
      for (const el of [this.runRef.nativeElement, this.servedRef.nativeElement]) {
        if (el.clientWidth > 0 && el.clientWidth !== this.widths.get(el)) { this.renderCharts(); break; }
      }
    });
    this.resizeObserver.observe(this.runRef.nativeElement);
    this.resizeObserver.observe(this.servedRef.nativeElement);
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    this.fetchSub?.unsubscribe();
    this.resizeObserver?.disconnect();
  }

  setYear(year: number): void { this.url.set({ year }); }
  setDiocese(diocese: string): void { this.url.set({ diocese }); }
  setKind(kind: string): void { this.url.set({ kind }); }
  setShow(show: string): void { this.url.set({ show }); }
  clearAll = (): void => this.url.set({ ...DEFAULTS });
  toggleGrid(): void { this.gridAll = !this.gridAll; this.buildGrid(); }
  nameOf(list: Option[], id: string): string { return list.find(o => o.id === id)?.label ?? id; }

  fetchData(): void {
    this.vizState = 'loading';
    this.fetchSub?.unsubscribe();
    const q = new URLSearchParams();
    if (this.state.year) q.set('year', String(this.state.year));
    if (this.state.diocese) q.set('diocese', this.state.diocese);
    if (this.state.kind) q.set('kind', this.state.kind);
    this.fetchSub = this.api.getTypeRequest(`stats/gender?${q}`).subscribe({
      next: (res: any) => this.show(res as GenderResponse),
      error: () => this.vizState = 'error',
    });
  }

  download(): void {
    const d = this.data;
    if (!d) return;
    const rows = d.years.map(y => ({ year: y.year, works: y.total,
      ...Object.fromEntries(this.run.map(r => [`run_${r.id}`, y.run[r.id]])),
      ...Object.fromEntries(this.served.map(s => [`served_${s.id}`, y.served[s.id]])) }));
    const where = [this.state.diocese && `diocese ${this.nameOf(this.dioceseOptions, this.state.diocese)}`,
      this.state.kind && this.nameOf(this.kindOptions, this.state.kind)].filter(Boolean).join(', ');
    downloadTable('who-ran-it.csv', rows, `Catholic Almanacs: works by who ran them and whom they served, institutions per year${where ? ' (' + where + ')' : ''}. ${citation()}`);
  }

  private show(d: GenderResponse): void {
    this.data = d;
    this.run = d.meta.run;
    this.served = d.meta.served;
    this.kindOptions = d.meta.kinds;
    this.dioceseOptions = d.meta.dioceses;
    this.years = d.years.filter(y => y.total).map(y => y.year);
    this.year = d.year;
    this.current = d.years.find(y => y.year === d.year) ?? null;
    this.kindRows = d.kinds.filter(k => k.total).map(k => ({ id: k.id, label: k.label, total: k.total,
      parts: this.run.map(r => ({ id: r.id, n: k.run[r.id], pct: 100 * k.run[r.id] / k.total })).filter(p => p.n) }));
    this.buildGrid();
    this.mapData = d.points.map(([lat, lng, id, name, type, run, served, congs]) => ({
      latitude: lat, longitude: lng,
      title: `${institutionLabel(name, type)}: ${congs.length ? congs.join('; ') : this.nameOf(this.run, run).toLowerCase()}`
        + (served !== 'unstated' ? `; for ${this.nameOf(this.served, served).toLowerCase()}` : ''),
      internalLink: `/institutions/${id}?year=${d.year}`,
      options: { color: RUN_INK[run], radius: run === 'unstated' ? 3 : 5 },
    }));
    this.chips = [
      ...(this.state.diocese ? [{ label: `Diocese: ${this.nameOf(this.dioceseOptions, this.state.diocese)}`, clear: () => this.url.set({ diocese: '' }) }] : []),
      ...(this.state.kind ? [{ label: this.nameOf(this.kindOptions, this.state.kind), clear: () => this.url.set({ kind: '' }) }] : []),
      ...(this.state.year ? [{ label: `Year: ${this.state.year}`, clear: () => this.url.set({ year: 0 }) }] : []),
    ];
    this.takeaway = this.computeTakeaway();
    this.vizState = this.years.length ? 'ready' : 'empty';
    this.renderCharts();
  }

  private computeTakeaway(): string {
    const c = this.current;
    if (!c || !c.total) return '';
    const stated = c.total - c.run['unstated'];
    const women = c.run['women'] + c.run['mixed'];
    const what = this.state.kind ? this.nameOf(this.kindOptions, this.state.kind).toLowerCase() : 'schools, academies, asylums, hospitals and religious houses';
    return `In ${c.year} the almanac listed ${c.total.toLocaleString()} ${what}${this.state.diocese ? ' in the Diocese of ' + this.nameOf(this.dioceseOptions, this.state.diocese) : ''}. `
      + (stated ? `Of the ${stated.toLocaleString()} whose running it records, ${Math.round(100 * women / stated)}% were run by women religious.` : '');
  }

  private buildGrid(): void {
    const d = this.data;
    if (!d) return;
    const years = this.years;
    const max = Math.max(1, ...d.congregations.flatMap(c => Object.values(c.years)));
    const shade = (n: number) => n ? COUNT_RAMP[Math.min(COUNT_RAMP.length - 1, Math.floor(Math.sqrt(n / max) * COUNT_RAMP.length))] : '';
    const rows = d.congregations.filter(c => c.total);
    this.gridCount = rows.length;
    this.grid = (this.gridAll ? rows : rows.slice(0, 16)).map(c => ({ label: c.label, sex: c.sex, total: c.total,
      cells: years.map(y => {
        const n = c.years[y] || 0;
        const bg = shade(n);
        return { year: y, n, bg, fg: bg && COUNT_RAMP.indexOf(bg) >= 3 ? '#fff' : 'var(--ink)' };
      }) }));
  }

  private renderCharts(): void {
    if (!this.data) return;
    const rows = this.data.years.filter(y => y.total);
    this.stacked(this.runRef.nativeElement, rows.map(y => ({ year: y.year, total: y.total, parts: this.run.map(r => ({ id: r.id, n: y.run[r.id] })) })),
      RUN_INK, 'Works each year by who ran them');
    this.stacked(this.servedRef.nativeElement, rows.map(y => ({ year: y.year, total: y.total - y.served['unstated'],
      parts: ['girls', 'both', 'boys'].map(id => ({ id, n: y.served[id] })) })), SERVED_INK, 'Works each year that say whom they served');
  }

  /** Stacked bars by year (counts, or shares of each year's total); click a year to show it. */
  private stacked(host: HTMLElement, rows: StackedYear[], inks: Record<string, string>, label: string): void {
    const labels = Object.fromEntries([...this.run, ...this.served].map(o => [o.id, o.label]));
    this.widths.set(host, drawStackedYears(host, rows, { inks, labels, share: this.state.show === 'share', selected: this.year,
      onYear: y => this.setYear(y), ariaLabel: label }));
  }
}
