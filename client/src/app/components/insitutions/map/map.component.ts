import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

import { ApiService } from '../../../services/api.service';
import { spaceName } from '../../../pipes/space-name.pipe';
import { MapVisComponent } from '../../common/map-vis/map-vis.component';
import { buildGrouping, LegendEntry } from '../../common/map-vis/map-grouping';
import { DashboardShellComponent, RelatedDashboard } from '../../common/dashboard-shell/dashboard-shell.component';
import { ControlBarComponent, ControlChip } from '../../common/control-bar/control-bar.component';
import { VizPanelComponent, VizState } from '../../common/viz-panel/viz-panel.component';
import { SegmentedComponent } from '../../common/segmented/segmented.component';
import { YearPlayerComponent } from '../../common/year-player/year-player.component';
import { UrlState } from '../../../utils/url-state';
import { loadOptions } from '../../../utils/options';
import { institutionLabel } from '../../../utils/record-labels';

interface InstPoint {
  id: string;
  instName: string;
  instType: string;
  instFunction: string;
  diocese: string;
  latitude: number;
  longitude: number;
}

const MAP_VIEWS = [
  { value: 'point', label: 'Points' },
  { value: 'heatmap', label: 'Heatmap' },
  { value: 'bins', label: 'Grid' },
  { value: 'cluster', label: 'Clusters' },
];
const DEFAULTS = { year: 0, type: '', fn: '', name: '', diocese: '', color: 'function', view: 'point' };
/** Params that change what the server returns (the rest only redraw). */
const DATA_KEYS = ['year', 'type', 'fn', 'name', 'diocese'] as const;

@Component({
  selector: 'app-institutions-map',
  imports: [MapVisComponent, DashboardShellComponent, ControlBarComponent, VizPanelComponent, SegmentedComponent, YearPlayerComponent],
  templateUrl: './map.component.html',
  styleUrl: './map.component.scss'
})
export class MapComponent implements OnInit, OnDestroy {
  @ViewChild(MapVisComponent) mapVis?: MapVisComponent;

  readonly related: RelatedDashboard[] = [
    { label: 'The Spread of the Church', link: '/dashboards/spread' },
    { label: 'The Almanacs at a Glance', link: '/dashboards/overview' },
  ];
  readonly colorOptions = [
    { value: 'function', label: 'Function' },
    { value: 'type', label: 'Type' },
    { value: 'diocese', label: 'Diocese' },
  ];
  readonly views = MAP_VIEWS;
  readonly dioceseLabel = spaceName;
  typeOptions: string[] = [];
  functionOptions: string[] = [];
  dioceseOptions: string[] = [];

  state = { ...DEFAULTS };
  nameDraft = '';
  vizState: VizState = 'loading';
  updating = false;
  takeaway = '';
  chips: ControlChip[] = [];
  years: number[] = [];
  year: number | null = null;

  data: any[] = [];
  legend: LegendEntry[] = [];
  shown = 0;
  unlocated = 0;
  mapOptions = {
    // Narrow screens start zoomed out far enough to show the whole country.
    zoom: window.innerWidth < 640 ? 2 : 3.6,
    mode: 'point' as 'heatmap' | 'point' | 'bins' | 'cluster',
    center: { lat: 39, lng: window.innerWidth < 640 ? -96 : -94 },
    size: { width: '100%', height: 'clamp(320px, 62vh, 640px)' }
  };

  private points: InstPoint[] = [];
  private url: UrlState<typeof DEFAULTS>;
  private subs: Subscription[] = [];
  private fetchSub?: Subscription;
  private nameInput = new Subject<string>();

  readonly entities = [{ value: 'institutions', label: 'Institutions' }, { value: 'people', label: 'People' }];
  readonly entity = 'institutions';

  constructor(private api: ApiService, private http: HttpClient, private router: Router, route: ActivatedRoute) {
    this.url = new UrlState(router, route, DEFAULTS);
  }

  /** Institutions and people share /dashboards/explore; their filters differ, so switching starts afresh. */
  switchEntity(entity: string): void {
    this.router.navigate(['/dashboards/explore'], { queryParams: { entity: entity === 'institutions' ? null : entity } });
  }

  ngOnInit(): void {
    this.subs.push(
      loadOptions(this.http, 'types.csv').subscribe(o => this.typeOptions = o),
      loadOptions(this.http, 'functions.csv').subscribe(o => this.functionOptions = o.filter(f => f !== 'other')),
      loadOptions(this.http, 'diocese.csv').subscribe(o => this.dioceseOptions = o),
      this.nameInput.pipe(debounceTime(400), distinctUntilChanged())
        .subscribe(name => this.url.set({ name: name.trim() })),
    );
    // The almanac years, from the browse index (cheap: one row).
    this.subs.push(this.api.getTypeRequest('institution?size=1').subscribe({
      next: (res: any) => {
        this.years = res.meta?.years ?? [];
        this.subs.push(this.watchUrl());
      },
      error: () => this.vizState = 'error',
    }));
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    this.fetchSub?.unsubscribe();
  }

  private watchUrl(): Subscription {
    let dataKey: string | null = null;
    let first = true;
    return this.url.changes().subscribe(state => {
      if (first) this.mapOptions = { ...this.mapOptions, mode: state.view as any };
      else if (state.view !== this.state.view) this.mapVis?.changeMapMode(state.view);
      first = false;
      this.year = this.years.includes(state.year) ? state.year : this.years[this.years.length - 1] ?? null;
      this.state = state;
      if (state.name !== this.nameDraft.trim()) this.nameDraft = state.name;
      this.chips = [
        ...(state.type ? [{ label: `Type: ${state.type}`, clear: () => this.url.set({ type: '' }) }] : []),
        ...(state.fn ? [{ label: `Function: ${state.fn}`, clear: () => this.url.set({ fn: '' }) }] : []),
        ...(state.name ? [{ label: `Name: “${state.name}”`, clear: () => this.url.set({ name: '' }) }] : []),
        ...(state.diocese ? [{ label: `Diocese: ${spaceName(state.diocese)}`, clear: () => this.url.set({ diocese: '' }) }] : []),
      ];
      const key = DATA_KEYS.map(k => k === 'year' ? this.year : state[k]).join('|');
      if (key !== dataKey) {
        dataKey = key;
        this.fetchData();
      } else {
        this.applyGrouping();
      }
    });
  }

  // ---- controls -------------------------------------------------------------

  setYear(year: number): void { this.url.set({ year }); }
  setColor(color: string): void { this.url.set({ color }); }
  setView(view: string): void { this.url.set({ view }); }
  setFilter(change: Partial<typeof DEFAULTS>): void { this.url.set(change); }
  onName(value: string): void {
    this.nameDraft = value;
    this.nameInput.next(value);
  }
  clearAll = (): void => {
    this.nameDraft = '';
    this.url.set({ type: '', fn: '', name: '', diocese: '' });
  };

  // ---- data -----------------------------------------------------------------

  fetchData(): void {
    if (this.year === null) return;
    // Keep the old points on screen while a new year loads (so playing doesn't flash).
    if (!this.points.length) this.vizState = 'loading';
    this.updating = true;
    const q = new URLSearchParams({ year: String(this.year) });
    if (this.state.type) q.set('instType', this.state.type);
    if (this.state.fn) q.set('instFunction', this.state.fn);
    if (this.state.name) q.set('instName', this.state.name);
    if (this.state.diocese) q.set('diocese', this.state.diocese);
    this.fetchSub?.unsubscribe();
    this.fetchSub = this.api.getTypeRequest('maps/institutions?' + q).subscribe({
      next: (res: any) => {
        const points: InstPoint[] = [];
        let unlocated = 0;
        for (const item of res.rows ?? []) {
          for (const r of item.almanacRecord ?? []) {
            if (r.latitude && r.longitude) points.push({ ...r, id: item.ID });
            else unlocated++;
          }
        }
        this.points = points;
        this.unlocated = unlocated;
        this.updating = false;
        this.vizState = points.length ? 'ready' : 'empty';
        this.applyGrouping();
      },
      error: () => {
        this.updating = false;
        this.vizState = 'error';
      },
    });
  }

  /** Colour the current points by the "Colour by" field and build the key. */
  private applyGrouping(): void {
    const field = this.state.color === 'type' ? 'instType' : this.state.color === 'diocese' ? 'diocese' : 'instFunction';
    const grouping = buildGrouping(this.points.map(p => p[field]), this.state.color === 'function' ? 'function' : 'categorical');
    this.legend = grouping.legend;
    this.data = this.points.map(p => ({
      latitude: p.latitude,
      longitude: p.longitude,
      title: institutionLabel(p.instName, p.instType),
      internalLink: '/institutions/' + p.id,
      options: { color: grouping.colorFor(p[field]), radius: 6 }
    }));
    this.shown = this.points.length;
    this.takeaway = this.computeTakeaway();
  }

  private computeTakeaway(): string {
    if (this.year === null || this.vizState === 'loading') return '';
    const filtered = this.chips.length ? ' matching these filters' : '';
    if (!this.shown) return `The ${this.year} almanac has no located institutions${filtered}.`;
    const dioceses = new Set(this.points.map(p => p.diocese).filter(Boolean)).size;
    const missing = this.unlocated ? ` A further ${this.unlocated.toLocaleString()} have no recorded location.` : '';
    return `${this.shown.toLocaleString()} institution${this.shown === 1 ? '' : 's'}${filtered} appear on the ${this.year} map, ` +
      `across ${dioceses.toLocaleString()} diocese${dioceses === 1 ? '' : 's'}.${missing}`;
  }
}
