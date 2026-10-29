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
import { institutionLabel, personLabel } from '../../../utils/record-labels';

/** One located institution-year and the people the almanac lists there. */
interface PlacePoint {
  instID: string;
  instName: string;
  instFunction: string;
  diocese: string;
  latitude: number;
  longitude: number;
  people: { id: string; label: string }[];
}

const MAP_VIEWS = [
  { value: 'point', label: 'Points' },
  { value: 'heatmap', label: 'Heatmap' },
  { value: 'bins', label: 'Grid' },
  { value: 'cluster', label: 'Clusters' },
];
const DEFAULTS = { year: 0, name: '', diocese: '', color: 'function', view: 'point' };
/** Params that change what the server returns (the rest only redraw). */
const DATA_KEYS = ['year', 'name', 'diocese'] as const;

@Component({
  selector: 'app-people-map',
  imports: [MapVisComponent, DashboardShellComponent, ControlBarComponent, VizPanelComponent, SegmentedComponent, YearPlayerComponent],
  templateUrl: './map.component.html',
  styleUrl: './map.component.scss'
})
export class MapComponent implements OnInit, OnDestroy {
  @ViewChild(MapVisComponent) mapVis?: MapVisComponent;

  readonly related: RelatedDashboard[] = [
    { label: 'The Shape of the Church', link: '/dashboards/composition', queryParams: { entity: 'people' } },
    { label: 'The People Network', link: '/dashboards/networks', queryParams: { view: 'people' } },
  ];
  readonly colorOptions = [
    { value: 'function', label: 'Function' },
    { value: 'diocese', label: 'Diocese' },
  ];
  readonly views = MAP_VIEWS;
  readonly dioceseLabel = spaceName;
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
  peopleShown = 0;
  placesShown = 0;
  mapOptions = {
    // Narrow screens start zoomed out far enough to show the whole country.
    zoom: window.innerWidth < 640 ? 2 : 3.6,
    mode: 'point' as 'heatmap' | 'point' | 'bins' | 'cluster',
    center: { lat: 39, lng: window.innerWidth < 640 ? -96 : -94 },
    size: { width: '100%', height: 'clamp(320px, 62vh, 640px)' }
  };

  private points: PlacePoint[] = [];
  private url: UrlState<typeof DEFAULTS>;
  private subs: Subscription[] = [];
  private fetchSub?: Subscription;
  private nameInput = new Subject<string>();

  readonly entities = [{ value: 'institutions', label: 'Institutions' }, { value: 'people', label: 'People' }];
  readonly entity = 'people';

  constructor(private api: ApiService, private http: HttpClient, private router: Router, route: ActivatedRoute) {
    this.url = new UrlState(router, route, DEFAULTS);
  }

  /** Institutions and people share /dashboards/explore; their filters differ, so switching starts afresh. */
  switchEntity(entity: string): void {
    this.router.navigate(['/dashboards/explore'], { queryParams: { entity: entity === 'institutions' ? null : entity } });
  }

  ngOnInit(): void {
    this.subs.push(
      loadOptions(this.http, 'diocese.csv').subscribe(o => this.dioceseOptions = o),
      this.nameInput.pipe(debounceTime(400), distinctUntilChanged())
        .subscribe(name => this.url.set({ name: name.trim() })),
    );
    // The almanac years, from the browse index (cheap: one row).
    this.subs.push(this.api.getTypeRequest('person?size=1').subscribe({
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
  setDiocese(diocese: string): void { this.url.set({ diocese }); }
  onName(value: string): void {
    this.nameDraft = value;
    this.nameInput.next(value);
  }
  clearAll = (): void => {
    this.nameDraft = '';
    this.url.set({ name: '', diocese: '' });
  };

  // ---- data -----------------------------------------------------------------

  fetchData(): void {
    if (this.year === null) return;
    // Keep the old points on screen while a new year loads (so playing doesn't flash).
    if (!this.points.length) this.vizState = 'loading';
    this.updating = true;
    const q = new URLSearchParams({ year: String(this.year) });
    if (this.state.name) q.set('persName', this.state.name);
    if (this.state.diocese) q.set('diocese', this.state.diocese);
    this.fetchSub?.unsubscribe();
    this.fetchSub = this.api.getTypeRequest('maps/people?' + q).subscribe({
      next: (res: any) => {
        // One point per institution: everyone the almanac lists there that year.
        const byInst = new Map<string, PlacePoint>();
        const located = new Set<string>();
        for (const pers of res.rows ?? []) {
          for (const r of pers.almanacRecords ?? []) {
            if (!r.latitude || !r.longitude) continue;
            located.add(pers.ID);
            let point = byInst.get(r.instID);
            if (!point) {
              point = { instID: r.instID, instName: r.instName, instFunction: r.instFunction, diocese: r.diocese,
                latitude: r.latitude, longitude: r.longitude, people: [] };
              byInst.set(r.instID, point);
            }
            if (!point.people.some(p => p.id === pers.ID)) {
              point.people.push({ id: pers.ID, label: personLabel(r.personInAlmanacRecord ?? {}) });
            }
          }
        }
        this.points = [...byInst.values()];
        this.peopleShown = located.size;
        this.updating = false;
        this.vizState = this.points.length ? 'ready' : 'empty';
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
    const field = this.state.color === 'diocese' ? 'diocese' : 'instFunction';
    const grouping = buildGrouping(this.points.map(p => p[field]), this.state.color === 'function' ? 'function' : 'categorical');
    this.legend = grouping.legend;
    this.data = this.points.map(p => {
      const place = institutionLabel(p.instName);
      // A lone person opens their record; a place with several opens the
      // institution, whose record lists everyone there that year.
      const single = p.people.length === 1 ? p.people[0] : null;
      return {
        latitude: p.latitude,
        longitude: p.longitude,
        title: single ? `${single.label} · ${place}` : `${place} (${p.people.length} people)`,
        internalLink: single ? '/people/' + single.id : '/institutions/' + p.instID,
        options: { color: grouping.colorFor(p[field]), radius: Math.min(5 + Math.sqrt(p.people.length) * 1.5, 12) }
      };
    });
    this.placesShown = this.points.length;
    this.takeaway = this.computeTakeaway();
  }

  private computeTakeaway(): string {
    if (this.year === null || this.vizState === 'loading') return '';
    const filtered = this.chips.length ? ' matching these filters' : '';
    if (!this.placesShown) return `The ${this.year} almanac lists no located people${filtered}.`;
    const n = (v: number, unit: string) => `${v.toLocaleString()} ${unit}${v === 1 ? '' : 's'}`;
    return `In ${this.year} the almanac places ${this.peopleShown.toLocaleString()} ${this.peopleShown === 1 ? 'person' : 'people'}${filtered} at ` +
      `${n(this.placesShown, 'institution')}.`;
  }
}
