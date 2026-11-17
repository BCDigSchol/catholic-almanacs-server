import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { Subscription, combineLatest, of } from 'rxjs';
import { catchError, distinctUntilChanged, map, shareReplay, switchMap, tap } from 'rxjs/operators';

import { ApiService } from '../../../services/api.service';
import { MapVisComponent } from '../../common/map-vis/map-vis.component';
import { NetworkGraphComponent } from '../../common/network-graph/network-graph.component';
import { PageHeaderComponent } from '../../common/page-header/page-header.component';
import { VizPanelComponent } from '../../common/viz-panel/viz-panel.component';
import { YearTabsComponent } from '../../common/year-tabs/year-tabs.component';
import { CiteComponent } from '../../common/cite/cite.component';
import { institutionLabel, isUnnamed, placeLabel, yearRuns } from '../../../utils/record-labels';
import { MapContextPoint, MapLabel, MapLink } from '../../common/map-vis/map-overlays';
import { MapKeyItem, RECORD_MAP_INKS } from '../../../utils/record-map';
import { LadderRow, ServiceLadderComponent } from '../../common/service-ladder/service-ladder.component';
import { ScanLinksComponent } from '../../common/scan-links/scan-links.component';
import { AlmanacScansService } from '../../../services/almanac-scans.service';
import { AlmanacScans, NO_SCANS, ScanVolume, volumesOf } from '../../../utils/almanac-scans';

/** One (year, institution) listing from GET /person/:id/timeline. */
type RecordView = 'map' | 'network';

interface Listing {
  year: number;
  instID: string;
  instName: string;
  instType: string;
  diocese: string;
  city: string;
  state: string;
  latitude: number | null;
  longitude: number | null;
  name: string;
  title: string;
  suffix: string;
  role: string;
  note: string;
  isAttending: boolean;
  /** For a visit: the institution the person was visiting from. */
  attendingInstID: string;
}

/** A place the person was resident at, over a run of years (one career stop). */
interface Stop {
  instID: string;
  label: string;
  lat: number;
  lng: number;
  years: number[];
}

/** One row of the Service table: an institution and every year served there. */
interface ServiceRow {
  instID: string;
  label: string;
  unnamed: boolean;
  type: string;
  place: string;
  diocese: string;
  roles: string;
  years: number[];
  listedAs: string;
}

interface Fact {
  label: string;
  value: string;
}

@Component({
  selector: 'app-person-details',
  imports: [RouterLink, MapVisComponent, NetworkGraphComponent, PageHeaderComponent, YearTabsComponent, CiteComponent, VizPanelComponent, ServiceLadderComponent, ScanLinksComponent],
  templateUrl: './person-details.component.html',
  styleUrl: './person-details.component.scss'
})
export class PersonDetailsComponent implements OnInit, OnDestroy {
  id = '';
  /** null = all years */
  year: number | null = null;
  notFound = false;
  listings: Listing[] = [];

  network: any = { nodes: [], edges: [] };
  networkLoading = false;
  networkStartYear: number | null = null;
  networkEndYear: number | null = null;
  readonly networkOptions = { height: '420px' };
  /** Which view the side panel shows. */
  view: RecordView = 'map';
  views: { key: RecordView; label: string }[] = [];
  /** Set once the user picks a tab; until then the panel shows the first view (the map). */
  private viewChosen = false;

  private subs: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService,
    private title: Title,
    private scanList: AlmanacScansService,
  ) {}

  ngOnInit(): void {
    this.subs.push(this.scanList.scans$.subscribe(s => { this.allScans = s; this.updateScans(); }));
    const id$ = this.route.paramMap.pipe(map(p => p.get('id') ?? ''), distinctUntilChanged());
    const year$ = this.route.queryParamMap.pipe(map(p => Number(p.get('year')) || null), distinctUntilChanged());
    const timeline$ = id$.pipe(
      tap(id => {
        this.id = id;
        this.notFound = false;
        this.listings = [];
      }),
      switchMap(id => this.api.getTypeRequest(`person/${id}/timeline`).pipe(catchError(() => of(null)))),
      shareReplay(1),
    );
    this.subs.push(combineLatest([timeline$, year$]).subscribe(([res, year]) => {
      this.listings = (res as any)?.rows ?? [];
      this.notFound = !res;
      this.year = year;
      this.updateScans();
      this.recompute();
      this.title.setTitle(res ? `${this.heading} · Catholic Almanacs` : 'Person not found · Catholic Almanacs');
      if (res) {
        const [start, end] = year === null ? [this.years[0], this.years[this.years.length - 1]] : [year, year];
        this.fetchNetwork(start, end);
      }
    }));
  }

  private updateScans(): void {
    this.scansListed = this.allScans.volumes.length > 0;
    this.scans = volumesOf(this.allScans, this.year);
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  fetchNetwork(startYear?: number, endYear?: number): void {
    this.networkStartYear = startYear ?? null;
    this.networkEndYear = endYear ?? null;
    this.networkLoading = true;
    const q = [startYear != null && `startYear=${startYear}`, endYear != null && `endYear=${endYear}`].filter(Boolean).join('&');
    this.api.getTypeRequest(`person/${this.id}/network` + (q ? '?' + q : '')).pipe(
      catchError(() => of({ nodes: [], edges: [] }))
    ).subscribe(res => {
      this.network = res;
      this.networkLoading = false;
      this.updateViews();
    });
  }

  /** The side panel's tabs: what this record has to show. A windowed network
      keeps its tab even when the window is empty, so the user can widen it. */
  private updateViews(): void {
    const views: { key: RecordView; label: string }[] = [];
    if (this.mapData.length) views.push({ key: 'map', label: 'Places' });
    if (this.network.nodes.length > 1 || this.networkStartYear != null) views.push({ key: 'network', label: 'Network' });
    this.views = views;
    if (!this.viewChosen || !views.some(v => v.key === this.view)) this.view = views[0]?.key ?? 'map';
  }

  chooseView(view: RecordView): void {
    this.view = view;
    this.viewChosen = true;
  }

  onNetworkWindow(event: { startYear: number; endYear: number }): void {
    this.fetchNetwork(event.startYear, event.endYear);
  }

  selectYear(year: number | null): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { year }, replaceUrl: true });
  }

  // ---- derived view ---------------------------------------------------------
  // Computed once per data change, never in getters: these feed child
  // components, and fresh arrays on every change-detection pass would make
  // them re-render endlessly.

  years: number[] = [];
  heading = '';
  kind = 'Person';
  dioceses: string[] = [];
  yearsLabel = '';
  /** Every spelling of the name, with the years each was printed (only if it varied). */
  namesRecorded: { name: string; years: string }[] = [];
  facts: Fact[] = [];
  /** The scanned volume(s) of the selected year's almanac; `scansListed` once any are known. */
  scans: ScanVolume[] = [];
  scansListed = false;
  private allScans: AlmanacScans = NO_SCANS;

  service: ServiceRow[] = [];
  /** The career: one row per post, across all years. */
  career: LadderRow[] = [];
  mapData: any[] = [];
  readonly mapOptions = {
    zoom: 5, center: { lat: 39, lng: -88 }, size: { width: '100%', height: '420px' },
    // small round points, not pins: a career is a line of places
    mode: 'point' as const, modeOptions: { radius: 6 },
  };
  /** The career path and visits (lines), other places (dots), years beside stops, the frame, the key. */
  mapLinks: MapLink[] = [];
  mapContext: MapContextPoint[] = [];
  mapLabels: MapLabel[] = [];
  mapFit: [number, number, number, number] | null = null;
  mapKey: MapKeyItem[] = [];
  mapSummary = '';
  readonly crumbs = [{ label: 'People', link: '/people' }];
  /** Long service lists start collapsed to this many rows. */
  readonly servicePreview = 15;
  showAllService = false;

  get shownService(): ServiceRow[] {
    return this.showAllService ? this.service : this.service.slice(0, this.servicePreview);
  }

  yearsOf(row: ServiceRow): string {
    return yearRuns(row.years);
  }

  private recompute(): void {
    const all = this.listings;
    const shown = this.year === null ? all : all.filter(l => l.year === this.year);
    this.years = [...new Set(all.map(l => l.year))];
    this.yearsLabel = yearRuns(this.years);

    // Title: the fullest spelling of the name, with the latest title and suffix.
    const latest = shown[shown.length - 1] ?? all[all.length - 1];
    const fullest = shown.map(l => l.name).reduce((a, b) => (b.length > a.length ? b : a), '');
    this.heading = [latest?.title, fullest || latest?.name, latest?.suffix].filter(Boolean).join(' ') || 'Unnamed person';
    this.kind = latest?.title ? 'Person · ' + latest.title : 'Person';

    const seen = new Set<string>();
    this.dioceses = shown.map(l => l.diocese).filter(Boolean).reverse().filter(d => {
      const key = d.toLowerCase().replace(/[^a-z]/g, '');
      return !seen.has(key) && !!seen.add(key);
    });

    const spellings = this.group(all, l => l.name.trim());
    this.namesRecorded = spellings.size > 1 ? [...spellings].map(([name, years]) => ({ name, years: yearRuns(years) })) : [];

    const join = (values: Map<string, number[]>, withYears: boolean) => [...values]
      .map(([v, ys]) => withYears && values.size > 1 ? `${v} (${yearRuns(ys)})` : v).join('; ');
    this.facts = [
      { label: 'Title', value: join(this.group(shown, l => l.title, true), true) },
      { label: 'Suffix', value: join(this.group(shown, l => l.suffix, true), true) },
      { label: 'Role', value: join(this.group(shown, l => l.role, true), true) },
      { label: 'Notes', value: join(this.group(shown, l => l.note), true) },
    ].filter(f => f.value);

    const rows = new Map<string, ServiceRow & { first: number; resident: boolean; visiting: boolean }>();
    for (const l of shown) {
      let row = rows.get(l.instID);
      if (!row) {
        row = {
          instID: l.instID, label: '', unnamed: false, type: '', place: '', diocese: '', roles: '',
          years: [], listedAs: '', first: l.year, resident: false, visiting: false,
        };
        rows.set(l.instID, row);
      }
      // latest year's details win
      row.label = institutionLabel(l.instName, l.instType);
      row.unnamed = isUnnamed(l.instName);
      row.type = l.instType;
      row.place = placeLabel(l.city, l.state);
      row.diocese = l.diocese;
      if (!row.years.includes(l.year)) row.years.push(l.year);
      if (l.role && !row.roles.split('; ').includes(l.role)) row.roles = row.roles ? `${row.roles}; ${l.role}` : l.role;
      if (l.isAttending) row.visiting = true; else row.resident = true;
    }
    this.service = [...rows.values()]
      .map(r => ({ ...r, listedAs: r.resident && r.visiting ? 'Resident; visiting' : r.visiting ? 'Visiting' : 'Resident' }))
      .sort((a, b) => a.first - b.first || a.label.localeCompare(b.label));
    this.showAllService = false;

    this.buildMap();
    this.buildCareer();
    this.updateViews();
  }

  /**
   * The map of a career. Across all years: the places the person was
   * resident at, joined in order by a path and labelled with their years, and
   * lines from each to the stations visited from it. In one year: that year's
   * post(s) and visits, with the rest of the career faint behind them.
   */
  private buildMap(): void {
    const ink = RECORD_MAP_INKS;
    const located = (l: Listing) => l.latitude != null && l.longitude != null;
    const query = this.year === null ? undefined : { year: this.year };
    const name = (l: Listing) => {
      const label = institutionLabel(l.instName, l.instType);
      return isUnnamed(l.instName) && l.city ? `${label}, ${l.city}` : label;
    };

    // career stops: each year's (first) residence, consecutive years at one place merged
    const stops: Stop[] = [];
    const residenceIn = new Map<number, Stop>();
    for (const y of this.years) {
      const l = this.listings.find(x => x.year === y && !x.isAttending && located(x));
      if (!l) continue;
      let stop = stops[stops.length - 1];
      if (!stop || stop.instID !== l.instID) {
        stop = { instID: l.instID, label: name(l), lat: l.latitude!, lng: l.longitude!, years: [] };
        stops.push(stop);
      }
      stop.years.push(y);
      residenceIn.set(y, stop);
    }
    const legs: MapLink[] = [];
    for (let i = 1; i < stops.length; i++) {
      const [a, b] = [stops[i - 1], stops[i]];
      if (a.lat === b.lat && a.lng === b.lng) continue;
      legs.push({ from: [a.lng, a.lat], to: [b.lng, b.lat], width: 2.2,
        title: `${a.label} (${yearRuns(a.years)}) to ${b.label} (${yearRuns(b.years)})` });
    }

    const shown = this.year === null ? this.listings : this.listings.filter(l => l.year === this.year);
    const visits = shown.filter(l => l.isAttending && located(l));
    const visitLinks: MapLink[] = [];
    for (const v of visits) {
      const home = residenceIn.get(v.year);
      if (!home) continue;
      visitLinks.push({ from: [home.lng, home.lat], to: [v.longitude!, v.latitude!], color: ink.out,
        title: `${name(v)}: visited from ${home.label}` + (this.year === null ? ` (${v.year})` : ''),
        link: ['/institutions', v.instID], query });
    }
    const visited = new Map(visits.map(v => [v.instID, v]));
    const point = (lat: number, lng: number, title: string, instID: string, color: string) =>
      ({ latitude: lat, longitude: lng, title, internalLink: ['/institutions', instID], options: { color } });

    if (this.year === null) {
      this.mapData = stops.map(s => point(s.lat, s.lng, `${s.label} (${yearRuns(s.years)})`, s.instID, ink.self));
      this.mapLinks = [...legs.map(l => ({ ...l, color: ink.self })), ...visitLinks];
      this.mapLabels = this.mergeLabels(stops);
    } else {
      const here = stops.filter(s => s.years.includes(this.year!));
      this.mapData = here.map(s => point(s.lat, s.lng, s.label, s.instID, ink.self));
      this.mapLinks = [...legs.map(l => ({ ...l, color: ink.other, width: 1.4, dashed: true })), ...visitLinks];
      this.mapLabels = here.map(s => ({ lat: s.lat, lng: s.lng, text: String(this.year) }));
    }
    const elsewhere = this.year === null ? [] : stops.filter(s => !s.years.includes(this.year!));
    this.mapContext = [
      ...[...visited.values()].map(v => ({ lat: v.latitude!, lng: v.longitude!, title: name(v),
        link: ['/institutions', v.instID], query, color: ink.out, radius: 4.5 })),
      ...elsewhere.map(s => ({ lat: s.lat, lng: s.lng, title: `${s.label} (${yearRuns(s.years)})`,
        link: ['/institutions', s.instID], color: ink.other, radius: 4 })),
    ];
    // a resident listing without a career stop (no coordinates elsewhere) still shows
    if (!this.mapData.length) {
      this.mapData = shown.filter(located).map(l => point(l.latitude!, l.longitude!, name(l), l.instID, ink.self));
    }

    const pts: [number, number][] = [
      ...this.mapData.map(d => [d.longitude, d.latitude] as [number, number]),
      ...this.mapContext.filter(c => this.year === null || c.color === ink.out).map(c => [c.lng, c.lat] as [number, number]),
    ];
    this.mapFit = pts.length ? [Math.min(...pts.map(p => p[0])), Math.min(...pts.map(p => p[1])),
      Math.max(...pts.map(p => p[0])), Math.max(...pts.map(p => p[1]))] : null;

    const moves = legs.length;
    this.mapKey = [
      { label: this.year === null ? 'Resident' : `Resident in ${this.year}`, color: ink.self, shape: 'dot' as const },
      ...(moves && this.year === null ? [{ label: 'Moved, in order', color: ink.self, shape: 'line' as const }] : []),
      ...(visits.length ? [{ label: 'Visited from there', color: ink.out, shape: 'line' as const }] : []),
      ...(this.year !== null && (elsewhere.length || moves) ? [{ label: 'Rest of the career', color: ink.other, shape: 'dashed' as const }] : []),
    ];
    const count = (k: number, one: string, many: string) => k === 1 ? one : `${k} ${many}`;
    this.mapSummary = this.year === null
      ? [stops.length > 1 ? `Resident at ${stops.length} places in turn` : '',
         visited.size ? `visited ${count(visited.size, 'one other place', 'other places')}` : ''].filter(Boolean).join('; ')
      : visited.size ? `In ${this.year}, visited ${count(visited.size, 'one place', 'places')} from ${residenceIn.get(this.year)?.label ?? 'here'}` : '';
    if (this.mapSummary) this.mapSummary += '.';
  }

  /** Every post across all years, in order of first year, resident or visiting. */
  private buildCareer(): void {
    const rows = new Map<string, LadderRow & { first: number; visiting: boolean; resident: boolean }>();
    for (const l of this.listings) {
      let r = rows.get(l.instID);
      if (!r) {
        r = { key: l.instID, label: '', link: ['/institutions', l.instID], kind: 'inst', detail: '', years: [], first: l.year, visiting: false, resident: false };
        rows.set(l.instID, r);
      }
      r.label = institutionLabel(l.instName, l.instType);   // latest name
      r.detail = placeLabel(l.city, l.state);
      if (!r.years.includes(l.year)) r.years.push(l.year);
      if (l.isAttending) r.visiting = true; else r.resident = true;
    }
    this.career = [...rows.values()]
      .map(r => ({ ...r, detail: [r.detail, !r.resident ? 'visiting' : ''].filter(Boolean).join(' · ') }))
      .sort((a, b) => a.first - b.first || a.label.localeCompare(b.label));
  }

  /** One label per place: a person can return to a place, so join its runs. */
  private mergeLabels(stops: Stop[]): MapLabel[] {
    const byPlace = new Map<string, { lat: number; lng: number; years: number[] }>();
    for (const s of stops) {
      const k = `${s.lat},${s.lng}`;
      const p = byPlace.get(k) ?? { lat: s.lat, lng: s.lng, years: [] };
      p.years.push(...s.years);
      byPlace.set(k, p);
    }
    return [...byPlace.values()].map(p => ({ lat: p.lat, lng: p.lng, text: yearRuns(p.years) }));
  }

  /**
   * Distinct non-empty values of a field, each with the years it appears.
   * With `ignoreCase`, "Rev." and "rev." count as one (first spelling kept).
   */
  private group(listings: Listing[], key: (l: Listing) => string, ignoreCase = false): Map<string, number[]> {
    const out = new Map<string, number[]>();
    const spelling = new Map<string, string>();
    for (const l of listings) {
      const v = key(l)?.trim();
      if (!v) continue;
      const k = ignoreCase ? v.toLowerCase() : v;
      if (!spelling.has(k)) spelling.set(k, v);
      const shown = spelling.get(k)!;
      const ys = out.get(shown) ?? [];
      if (!ys.includes(l.year)) ys.push(l.year);
      out.set(shown, ys);
    }
    return out;
  }
}
