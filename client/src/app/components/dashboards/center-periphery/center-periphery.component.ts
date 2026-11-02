import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { DecimalPipe, PercentPipe } from '@angular/common';
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
import { drawStackedYears } from '../../../utils/stacked-years';
import { institutionLabel } from '../../../utils/record-labels';
import { INKS } from '../../../utils/palette';
import { downloadTable, citation } from '../../../utils/network-export';

type Counts = Record<string, number>;
interface Option { id: string; label: string; }
interface Center { id: string; name: string; lat: number; lng: number; n: number; rings: Counts; }
interface Hub { inst: string; name: string; type: string; place: string; stations: number; }
/** GET /api/stats/center-periphery */
interface CPResponse {
  by: string;
  year: number;
  years: { year: number; n: number; rings: Counts }[];
  moves: { year: number; toward: number; away: number; same: number }[];
  kinds: Record<string, Counts>;
  /** [lat, lng, instID, ring, kind] */
  points: [number, number, string, string, string][];
  centers: Center[] | Hub[];
  meta: { rings: Option[]; kinds: Option[]; bands: number[] };
}

/** The rings, center to edge, in one ink's printings; the ties the same way. */
const RING_INK: Record<string, string> = {
  center: INKS[4], near: INKS[2], hinterland: INKS[0], remote: '#b9b3a7',
  hub: INKS[4], both: INKS[2], station: INKS[0], alone: '#b9b3a7',
};
const MOVE_INK: Record<string, string> = { toward: INKS[4], same: '#b9b3a7', away: INKS[0] };

const DEFAULTS = { by: 'diocese', year: 0, focus: '', show: 'share', view: 'periphery' };

/**
 * Center and Periphery: where the Church's institutions sat between a center
 * and its hinterland, under three readings of the center: the see of each
 * diocese, the nearest metro area, or the circuit ties between hubs and the
 * stations their clergy rode to. What sat at the center and what at the edge,
 * and whether clergy moved inward or outward.
 */
@Component({
  selector: 'app-center-periphery',
  imports: [DecimalPipe, PercentPipe, RouterLink, MapVisComponent, DashboardShellComponent, ControlBarComponent, SegmentedComponent,
    VizPanelComponent, YearPlayerComponent],
  templateUrl: './center-periphery.component.html',
  styleUrl: './center-periphery.component.scss'
})
export class CenterPeripheryComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('ringChart', { static: true }) ringRef!: ElementRef<HTMLDivElement>;
  @ViewChild('moveChart', { static: true }) moveRef!: ElementRef<HTMLDivElement>;

  readonly related = [
    { label: 'Mission Circuits', link: '/dashboards/circuits' },
    { label: 'Clergy Flows', link: '/dashboards/clergy-flows' },
    { label: 'The Frontier', link: '/dashboards/frontier' },
  ];
  readonly byOptions = [
    { value: 'diocese', label: 'The see of its diocese' },
    { value: 'metro', label: 'The nearest metro area' },
    { value: 'ties', label: 'The circuit ties' },
  ];
  readonly showOptions = [{ value: 'share', label: 'Share' }, { value: 'count', label: 'Count' }];
  /** The map's institutions: the periphery (all but the center ring), everything, or one ring. */
  viewOptions: { value: string; label: string }[] = [];
  readonly ringInk = RING_INK;
  readonly moveInk = MOVE_INK;

  state = { ...DEFAULTS };
  vizState: VizState = 'loading';
  takeaway = '';
  chips: ControlChip[] = [];
  data: CPResponse | null = null;
  rings: Option[] = [];
  kinds: Option[] = [];
  years: number[] = [];
  year: number | null = null;
  current: CPResponse['years'][number] | null = null;
  centers: (Center & { primacy: number })[] = [];
  hubs: (Hub & { label: string })[] = [];
  /** The year's kinds of institution by ring, as proportional bars. */
  kindRows: { ring: Option; total: number; parts: { id: string; label: string; n: number; pct: number }[] }[] = [];
  mapData: any[] = [];
  mapLabels: { lat: number; lng: number; text: string }[] = [];
  mapCenters: { lat: number; lng: number; color: string; title: string; radius: number }[] = [];
  mapRings: { lat: number; lng: number; miles: number[]; color: string }[] = [];
  mapFit: [number, number, number, number] | null = null;
  readonly mapOptions = {
    mode: 'point' as const,
    zoom: window.innerWidth < 640 ? 2 : 3.4,
    center: { lat: 39, lng: window.innerWidth < 640 ? -96 : -94 },
    size: { width: '100%', height: 'clamp(320px, 60vh, 600px)' },
  };

  private url: UrlState<typeof DEFAULTS>;
  private subs: Subscription[] = [];
  private fetchSub?: Subscription;
  private resizeObserver?: ResizeObserver;
  private widths = new Map<HTMLElement, number>();
  private fittedFocus: string | null = null;

  constructor(private api: ApiService, router: Router, route: ActivatedRoute) {
    this.url = new UrlState(router, route, DEFAULTS);
  }

  ngOnInit(): void {
    this.subs.push(this.url.changes().subscribe(state => {
      const pageOnly = !!this.data && (state.show !== this.state.show || state.view !== this.state.view) && state.by === this.state.by && state.year === this.state.year && state.focus === this.state.focus;
      this.state = state;
      if (pageOnly) { this.show(this.data!); return; }
      this.fetchData();
    }));
  }

  ngAfterViewInit(): void {
    const hosts = [this.ringRef.nativeElement, this.moveRef.nativeElement];
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

  setBy(by: string): void { this.url.set({ by, focus: '' }); }
  setYear(year: number): void { this.url.set({ year }); }
  setShow(show: string): void { this.url.set({ show }); }
  setView(view: string): void { this.url.set({ view }); }
  setFocus(focus: string): void { this.url.set({ focus: focus === this.state.focus ? '' : focus }); }
  clearAll = (): void => this.url.set({ focus: '', show: DEFAULTS.show, view: DEFAULTS.view });
  share(n: number, of: number): number { return of ? n / of : 0; }
  nameOf(list: Option[], id: string): string { return list.find(o => o.id === id)?.label ?? id; }
  get isTies(): boolean { return this.state.by === 'ties'; }
  get focusName(): string { return this.centers.find(c => c.id === this.state.focus)?.name ?? this.state.focus; }

  fetchData(): void {
    if (!this.data) this.vizState = 'loading';
    this.fetchSub?.unsubscribe();
    const q = new URLSearchParams({ by: this.state.by });
    if (this.state.year) q.set('year', String(this.state.year));
    if (this.state.focus) q.set('focus', this.state.focus);
    this.fetchSub = this.api.getTypeRequest(`stats/center-periphery?${q}`).subscribe({
      next: (res: any) => this.show(res as CPResponse),
      error: () => this.vizState = 'error',
    });
  }

  download(): void {
    const d = this.data;
    if (!d) return;
    const rows = d.years.map(y => ({ year: y.year, institutions: y.n, ...Object.fromEntries(this.rings.map(r => [r.id, y.rings[r.id]])) }));
    downloadTable(`center-periphery-${d.by}.csv`, rows,
      `Catholic Almanacs: institutions per year by ring around ${this.nameOf([...this.byOptions.map(o => ({ id: o.value, label: o.label }))], d.by).toLowerCase()}${this.state.focus ? ', ' + this.focusName : ''}. ${citation()}`);
  }

  private show(d: CPResponse): void {
    this.data = d;
    this.rings = d.meta.rings;
    this.kinds = d.meta.kinds;
    this.years = d.years.map(y => y.year);
    this.year = d.year;
    this.current = d.years.find(y => y.year === d.year) ?? null;
    if (d.by === 'ties') {
      this.hubs = (d.centers as Hub[]).map(h => ({ ...h, label: institutionLabel(h.name, h.type) }));
      this.centers = [];
    } else {
      this.hubs = [];
      this.centers = (d.centers as Center[]).map(c => ({ ...c, primacy: c.n ? c.rings['center'] / c.n : 0 }));
    }
    this.kindRows = this.rings.map(ring => {
      const counts = d.kinds[ring.id] || {};
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      return { ring, total, parts: this.kinds.map(k => ({ id: k.id, label: k.label, n: counts[k.id] || 0, pct: total ? 100 * (counts[k.id] || 0) / total : 0 })).filter(p => p.n) };
    });
    const inner = d.by === 'ties' ? 'hub' : 'center';
    this.viewOptions = [{ value: 'periphery', label: d.by === 'ties' ? 'Stations and the rest' : 'The periphery' }, { value: 'all', label: 'All' },
      ...this.rings.map(r => ({ value: r.id, label: r.label.replace(/\s*\(.*\)$/, '').replace(/:.*$/, '') }))];
    const view = this.state.view;
    const shown = view === 'all' ? d.points : view === 'periphery' ? d.points.filter(p => p[3] !== inner) : d.points.filter(p => p[3] === view);
    this.mapData = shown.map(([lat, lng, id, ring, kind]) => ({
      latitude: lat, longitude: lng,
      title: `${this.nameOf(this.rings, ring)}; ${this.nameOf(this.kinds, kind).toLowerCase()}`,
      internalLink: `/institutions/${id}?year=${d.year}`,
      options: { color: RING_INK[ring] ?? '#b9b3a7', radius: ring === 'remote' || ring === 'alone' ? 3 : 4.5 },
    }));
    // the centers themselves, named on the map
    const named = d.by === 'ties' ? [] : this.centers.filter(c => c.n >= 10);
    this.mapLabels = named.map(c => ({ lat: c.lat, lng: c.lng, text: c.name.replace(/^Greater /, '') }));
    // the centers themselves, sized by their primacy, with their rings of 5, 25 and 100 miles
    this.mapCenters = named.map(c => ({ lat: c.lat, lng: c.lng, color: RING_INK['center'], radius: 3 + 9 * c.primacy,
      title: `${c.name}: ${c.n} institutions, ${Math.round(100 * c.primacy)}% within 5 miles` }));
    const ringed = this.state.focus ? named.filter(c => c.id === this.state.focus) : named;
    this.mapRings = ringed.map(c => ({ lat: c.lat, lng: c.lng, miles: this.state.focus ? [5, 25, 100] : [25, 100], color: RING_INK['hinterland'] }));
    if (this.state.focus !== this.fittedFocus) {
      this.fittedFocus = this.state.focus;
      const pts = d.points;
      const c = this.centers.find(x => x.id === this.state.focus);
      if (c) {
        // the center's 100-mile ring, with a little room
        this.mapFit = [c.lng - 2.2, c.lat - 1.7, c.lng + 2.2, c.lat + 1.7];
      } else if (this.state.focus && pts.length) {
        const lats = pts.map(p => p[0]), lngs = pts.map(p => p[1]);
        this.mapFit = [Math.min(...lngs) - 0.5, Math.min(...lats) - 0.5, Math.max(...lngs) + 0.5, Math.max(...lats) + 0.5];
      } else if (!this.state.focus) {
        this.mapFit = [-125, 24, -66, 50];
      }
    }
    this.chips = [
      ...(this.state.focus ? [{ label: `Hinterland of ${this.focusName}`, clear: () => this.url.set({ focus: '' }) }] : []),
      ...(this.state.year ? [{ label: `Year: ${this.state.year}`, clear: () => this.url.set({ year: 0 }) }] : []),
    ];
    this.takeaway = this.computeTakeaway();
    this.vizState = this.years.length ? 'ready' : 'empty';
    this.renderCharts();
  }

  private computeTakeaway(): string {
    const c = this.current;
    if (!c || !c.n) return '';
    const pct = (k: string) => Math.round(100 * (c.rings[k] || 0) / c.n);
    const where = this.state.focus ? ` around ${this.focusName}` : '';
    const moves = this.data?.moves.find(m => m.year === c.year);
    const mv = moves && (moves.toward + moves.away) ? ` Of the clergy who moved between posts that year, ${moves.toward} went toward the center and ${moves.away} away from it.` : '';
    if (this.isTies) {
      return `In ${c.year}, ${pct('hub') + pct('both')}% of the institutions recorded were hubs whose clergy served other places, and ${pct('station') + pct('both')}% were stations served from elsewhere.${mv}`;
    }
    const what = this.state.by === 'metro' ? 'the nearest metro area' : 'the see of their diocese';
    return `In ${c.year}, ${pct('center')}% of the institutions recorded${where} stood within 5 miles of ${what}, ${pct('near')}% within 25, `
      + `${pct('hinterland')}% in the hinterland out to 100 miles, and ${pct('remote')}% beyond that.${mv}`;
  }

  private renderCharts(): void {
    const d = this.data;
    if (!d) return;
    const share = this.state.show === 'share';
    this.widths.set(this.ringRef.nativeElement, drawStackedYears(this.ringRef.nativeElement,
      d.years.map(y => ({ year: y.year, total: y.n, parts: this.rings.map(r => ({ id: r.id, n: y.rings[r.id] || 0 })) })),
      { inks: RING_INK, labels: Object.fromEntries(this.rings.map(r => [r.id, r.label])), share, selected: this.year,
        onYear: y => this.setYear(y), ariaLabel: 'Institutions each year by ring' }));
    this.widths.set(this.moveRef.nativeElement, drawStackedYears(this.moveRef.nativeElement,
      d.moves.filter(m => this.years.includes(m.year)).map(m => ({ year: m.year, total: m.toward + m.away + m.same,
        parts: [{ id: 'toward', n: m.toward }, { id: 'same', n: m.same }, { id: 'away', n: m.away }] })),
      { inks: MOVE_INK, labels: { toward: 'moves toward the center', same: 'moves within a ring', away: 'moves away from the center' }, share, selected: this.year,
        onYear: y => this.setYear(y), ariaLabel: 'Clergy moves each year, toward the center or away' }));
  }
}
