import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { MatDialog } from '@angular/material/dialog';
import { Subscription, combineLatest, of } from 'rxjs';
import { catchError, distinctUntilChanged, map, shareReplay, switchMap, tap } from 'rxjs/operators';

import { ApiService } from '../../../services/api.service';
import { DialogComponent } from '../../common/dialog/dialog.component';
import { MapVisComponent } from '../../common/map-vis/map-vis.component';
import { NetworkGraphComponent } from '../../common/network-graph/network-graph.component';
import { TreeGraphComponent, DendrogramNode } from '../../common/tree-graph/tree-graph.component';
import { PageHeaderComponent } from '../../common/page-header/page-header.component';
import { VizPanelComponent } from '../../common/viz-panel/viz-panel.component';
import { YearTabsComponent } from '../../common/year-tabs/year-tabs.component';
import { CiteComponent } from '../../common/cite/cite.component';
import { institutionLabel, isUnnamed, personLabel, placeLabel, yearRuns } from '../../../utils/record-labels';
import { MapContextPoint, MapLink } from '../../common/map-vis/map-overlays';
import { MapKeyItem, RECORD_MAP_INKS } from '../../../utils/record-map';
import { LadderRow, ServiceLadderComponent } from '../../common/service-ladder/service-ladder.component';

type RecordView = 'map' | 'network' | 'tree';

interface TimelinePerson {
  ID: string;
  name: string;
  title: string;
  suffix: string;
  role: string;
  isAttending: boolean;
  attendingInstID: string;
  attendingInstName: string;
  attendingInstType: string;
}

interface TimelineYear {
  year: number;
  instID: string;
  name: string;
  type: string;
  diocese: string;
  city: string;
  state: string;
  people: TimelinePerson[];
}

/** One row of the People table: a person and every year they were listed here. */
interface PersonRow {
  ID: string;
  label: string;
  roles: string;
  years: number[];
  resident: boolean;
  visitingFrom: { ID: string; label: string; unnamed: boolean }[];
}

interface Related {
  heading: string;
  items: { ID: string; label: string; unnamed: boolean; detail: string }[];
}

interface Fact {
  label: string;
  value: string;
}

/** One place tied to this institution by a circuit (GET institution/:id/map). */
interface MapTie {
  instID: string;
  name: string;
  type: string;
  place: string;
  lat: number;
  lng: number;
  /** 'out': attended from here; 'in': this was attended from there. */
  dir: 'out' | 'in';
  via: ('station' | 'priest')[];
  years: number[];
  frequency: string;
  priests: string[];
}

interface MapAround {
  places: { year: number; lat: number; lng: number }[];
  links: MapTie[];
  neighbours: { instID: string; name: string; type: string; place: string; lat: number; lng: number }[];
  see: { instID: string; name: string; place: string; lat: number; lng: number } | null;
}

@Component({
  selector: 'app-institution-details',
  imports: [RouterLink, MapVisComponent, NetworkGraphComponent, TreeGraphComponent,
    PageHeaderComponent, YearTabsComponent, CiteComponent, VizPanelComponent, ServiceLadderComponent],
  templateUrl: './institution-details.component.html',
  styleUrl: './institution-details.component.scss'
})
export class InstitutionDetailsComponent implements OnInit, OnDestroy {
  id = '';
  /** null = all years */
  year: number | null = null;
  loading = true;
  notFound = false;

  /** findByID (all years) or findOne (one year) response. */
  record: any = null;
  timeline: TimelineYear[] = [];
  /** County and ceded land by year (GET institution/:id/land), and for the year shown. */
  private landYears: { year: number; county: { id: string; name: string; state: string } | null; cessions: any[] }[] = [];
  land: { year: number; county: { id: string; name: string; state: string } | null;
    cessions: { number: string; tribes: string; date: string; before: number; treaty: string; schedule: string }[] } | null = null;
  dioceseInfo: any[] = [];

  network: any = { nodes: [], edges: [] };
  networkLoading = false;
  networkStartYear: number | null = null;
  networkEndYear: number | null = null;
  dendrogram: any = null;
  /** Which view the side panel shows. */
  view: RecordView = 'map';
  views: { key: RecordView; label: string }[] = [];
  /** Set once the user picks a tab; until then the panel shows the first view (the map). */
  private viewChosen = false;
  /** Long people lists start collapsed to this many rows. */
  readonly peoplePreview = 15;
  showAllPeople = false;

  readonly networkOptions = { height: '420px' };

  private subs: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService,
    private title: Title,
    private dialog: MatDialog,
  ) {}

  ngOnInit(): void {
    const id$ = this.route.paramMap.pipe(map(p => p.get('id') ?? ''), distinctUntilChanged());
    const year$ = this.route.queryParamMap.pipe(map(p => Number(p.get('year')) || null), distinctUntilChanged());

    // The timeline (fetched once per record) supplies the years and each
    // year's record id, so the per-year requests wait for it.
    const timeline$ = id$.pipe(
      tap(id => {
        this.id = id;
        this.loading = true;
        this.notFound = false;
        this.record = null;
      }),
      switchMap(id => this.api.getTypeRequest(`institution/${id}/timeline`).pipe(catchError(() => of(null)))),
      shareReplay(1),
    );
    // its county and ceded land, year by year (the tile build's placements)
    this.subs.push(id$.pipe(
      switchMap(id => this.api.getTypeRequest(`institution/${id}/land`).pipe(catchError(() => of(null)))),
    ).subscribe((res: any) => { this.landYears = res?.years ?? []; this.updateLand(); }));
    // who served here over the years, and where they came from and went to
    this.subs.push(id$.pipe(
      switchMap(id => this.api.getTypeRequest(`institution/${id}/succession`).pipe(catchError(() => of(null)))),
    ).subscribe((res: any) => this.buildLadder(res?.people ?? [])));

    this.subs.push(combineLatest([timeline$, year$]).pipe(
      tap(([res, year]) => {
        this.timeline = (res as any)?.years ?? [];
        this.notFound = !res;
        this.year = year;
        this.recomputeTimeline();
        this.title.setTitle(res ? `${this.heading} · Catholic Almanacs` : 'Institution not found · Catholic Almanacs');
        if (res) this.loadConnections(year);
      }),
      switchMap(([res, year]) => !res ? of(null) : this.api.getTypeRequest(year === null
        ? `institution/${this.id}`
        : `institution/${this.yearInstID(year)}/${year}`).pipe(catchError(() => of(null)))),
    ).subscribe(record => {
      this.record = record;
      this.recomputeRecord();
      this.loading = false;
      this.loadDioceseInfo();
    }));
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  // ---- loading --------------------------------------------------------------

  /** Network and institution tree for the selected year (or all years). */
  private loadConnections(year: number | null): void {
    const [start, end] = year === null ? [this.years[0], this.years[this.years.length - 1]] : [year, year];
    this.fetchNetwork(start, end);
    const around = `institution/${this.id}/map` + (year === null ? '' : `?year=${year}`);
    this.api.getTypeRequest(around).pipe(catchError(() => of(null))).subscribe(res => this.buildMap(res as MapAround | null));
    const tree = `institution/${this.id}/dendrogram` + (year === null ? '' : `?year=${year}`);
    this.api.getTypeRequest(tree).pipe(catchError(() => of(null))).subscribe(res => { this.dendrogram = res; this.updateViews(); });
  }

  /** The diocese's own notes for the selected year, when the almanac printed any. */
  private loadDioceseInfo(): void {
    const diocese = this.record?.diocese?.[0];
    if (this.year === null || !diocese) {
      this.dioceseInfo = [];
      return;
    }
    this.api.getTypeRequest(`diocese?diocese=${encodeURIComponent(diocese)}&year=${this.year}`)
      .pipe(catchError(() => of([]))).subscribe((info: any) => this.dioceseInfo = info);
  }

  /** A branching institution can sit under a different id in a given year. */
  private yearInstID(year: number): string {
    return this.timeline.find(t => t.year === year)?.instID ?? this.id;
  }

  fetchNetwork(startYear?: number, endYear?: number): void {
    this.networkStartYear = startYear ?? null;
    this.networkEndYear = endYear ?? null;
    this.networkLoading = true;
    const q = [startYear != null && `startYear=${startYear}`, endYear != null && `endYear=${endYear}`].filter(Boolean).join('&');
    this.api.getTypeRequest(`institution/${this.id}/network` + (q ? '?' + q : '')).pipe(
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
    if (this.mapData.length) views.push({ key: 'map', label: 'Location' });
    if (this.network.nodes.length > 1 || this.networkStartYear != null) views.push({ key: 'network', label: 'Network' });
    if (this.hasTree) views.push({ key: 'tree', label: 'Related' });
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

  onTreeNode(node: DendrogramNode): void {
    if (node.instID) this.router.navigate(['/institutions', node.instID]);
  }

  showDioceseInfo(): void {
    const info = this.dioceseInfo[0];
    if (info) {
      this.dialog.open(DialogComponent, { data: { diocese: info.diocese, year: info.year, dioceseInfo: info.dioceseInfo } });
    }
  }

  // ---- derived view ---------------------------------------------------------
  // Computed once per data change (never in getters): the template binds these
  // to child components, and a fresh array/object on every change-detection
  // pass would make the map, strip and tabs re-render endlessly.

  years: number[] = [];
  /** The timeline entries shown: one year, or all of them. */
  entries: TimelineYear[] = [];
  heading = '';
  unnamed = false;
  kind = 'Institution';
  place = '';
  /** Dioceses this institution was listed under, latest first. */
  dioceses: string[] = [];
  yearsLabel = '';
  /** Every name the almanacs gave it, with the years each was used (only if it changed). */
  namesRecorded: { name: string; years: string }[] = [];
  people: PersonRow[] = [];
  facts: Fact[] = [];
  related: Related[] = [];
  /** Clergy over time: one row per resident person. */
  ladder: LadderRow[] = [];
  mapData: any[] = [];
  mapOptions = { zoom: 7, center: { lat: 40, lng: -90 }, size: { width: '100%', height: '420px' } };
  /** Circuits (lines), the places around it (dots), the box to frame, the key. */
  mapLinks: MapLink[] = [];
  mapContext: MapContextPoint[] = [];
  mapFit: [number, number, number, number] | null = null;
  mapKey: MapKeyItem[] = [];
  /** A sentence under the map summing up the circuits. */
  mapSummary = '';
  readonly crumbs = [{ label: 'Institutions', link: '/institutions' }];

  get hasTree(): boolean {
    return !!this.dendrogram?.children?.length;
  }

  get shownPeople(): PersonRow[] {
    return this.showAllPeople ? this.people : this.people.slice(0, this.peoplePreview);
  }

  /** Punctuation after a name in a run-in entry; "S.J." already ends in a stop. */
  afterName(name: string, more: boolean): string {
    return more ? ',' : name.endsWith('.') ? '' : '.';
  }

  yearsOf(row: PersonRow): string {
    return yearRuns(row.years);
  }

  /** The county and ceded land for the year shown (all years: the latest). */
  private updateLand(): void {
    const at = this.year === null ? this.landYears[this.landYears.length - 1] : this.landYears.find(l => l.year === this.year);
    if (!at) { this.land = null; return; }
    const date = (n: number) => new Date(Date.UTC(Math.floor(n / 10000), Math.floor(n / 100) % 100 - 1, n % 100))
      .toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
    this.land = {
      year: at.year,
      county: at.county,
      // the latest cession of this ground first: the one that made it United States land
      cessions: [...at.cessions].reverse().map(c => ({ ...c, date: date(c.ceded), before: at.year - Math.floor(c.ceded / 10000) })),
    };
  }

  /** After the timeline or the selected year changes. */
  private recomputeTimeline(): void {
    this.updateLand();
    this.years = [...new Set(this.timeline.map(t => t.year))];
    this.entries = this.year === null ? this.timeline : this.timeline.filter(t => t.year === this.year);
    // The header describes the selected year, else the latest.
    const current = this.entries[this.entries.length - 1];
    this.heading = current ? institutionLabel(current.name, current.type) : '';
    this.unnamed = !!current && isUnnamed(current.name);
    this.kind = current?.type || 'Institution';
    this.place = current ? placeLabel(current.city, current.state) : '';
    // Latest spelling first; variants that differ only in spacing or
    // punctuation ("St. Louis" / "StLouis") count as one diocese.
    const seen = new Set<string>();
    this.dioceses = this.entries.map(t => t.diocese).filter(Boolean).reverse().filter(d => {
      const key = d.toLowerCase().replace(/[^a-z]/g, '');
      return !seen.has(key) && !!seen.add(key);
    });
    this.yearsLabel = yearRuns(this.years);

    const byName = new Map<string, number[]>();
    for (const t of this.timeline) {
      const name = isUnnamed(t.name) ? 'no name given' : t.name.trim();
      byName.set(name, [...(byName.get(name) ?? []), t.year]);
    }
    this.namesRecorded = byName.size > 1 ? [...byName].map(([name, years]) => ({ name, years: yearRuns(years) })) : [];

    const rows = new Map<string, PersonRow & { first: number }>();
    for (const t of this.entries) {
      for (const p of t.people) {
        let row = rows.get(p.ID);
        if (!row) {
          row = { ID: p.ID, label: '', roles: '', years: [], resident: false, visitingFrom: [], first: t.year };
          rows.set(p.ID, row);
        }
        row.label = personLabel(p);  // latest spelling wins
        if (!row.years.includes(t.year)) row.years.push(t.year);
        if (p.role && !row.roles.split('; ').includes(p.role)) row.roles = row.roles ? `${row.roles}; ${p.role}` : p.role;
        if (!p.isAttending) row.resident = true;
        if (p.isAttending && p.attendingInstID && !row.visitingFrom.some(v => v.ID === p.attendingInstID)) {
          row.visitingFrom.push({
            ID: p.attendingInstID,
            label: institutionLabel(p.attendingInstName, p.attendingInstType),
            unnamed: isUnnamed(p.attendingInstName),
          });
        }
      }
    }
    this.showAllPeople = false;
    this.people = [...rows.values()].sort((a, b) => a.first - b.first || a.label.localeCompare(b.label));
  }

  /** After the selected year's (or the merged) record arrives. */
  private recomputeRecord(): void {
    const r = this.record;
    if (!r) {
      this.facts = [];
      this.related = [];
      this.mapData = [];
      this.updateViews();
      return;
    }
    const printed = [r.placeName, r.countyOrig, r.cityOrig, r.stateOrig].filter(Boolean).join(', ');
    // No standardised town in the timeline: show the place as the almanac printed it.
    if (!this.place) this.place = printed;
    const county = r.countyReg && (/\bcounty$/i.test(r.countyReg) ? r.countyReg : `${r.countyReg} County`);
    const standard = [county, r.cityReg, r.stateReg].filter(Boolean).join(', ');
    const frequencies = (r.attendedFrequencies ?? []).map((f: any) => f.year ? `${f.frequency} (${f.year})` : f.frequency);
    this.facts = [
      { label: 'Type', value: r.instType },
      { label: 'Language', value: r.language && r.language !== 'English' ? r.language : '' },
      { label: 'Religious order', value: r.order },
      { label: 'Place as printed', value: printed },
      { label: 'Place (standardised)', value: standard !== printed ? standard : '' },
      { label: 'Region', value: r.region },
      { label: 'Member', value: [r.member, r.memberType && `(${r.memberType})`].filter(Boolean).join(' ') },
      { label: 'Affiliated with', value: r.affiliated },
      { label: 'Attended', value: frequencies.join('; ') },
      { label: 'Notes', value: r.instNote },
    ].filter(f => f.value && String(f.value).trim());

    const item = (x: any, detail = '') => ({
      ID: x.instID,
      label: institutionLabel(x.instName, x.instType),
      unnamed: isUnnamed(x.instName),
      detail: [x.instType, detail].filter(Boolean).join(' · '),
    });
    const freq = (x: any) => x.attendingFrequency || '';
    this.related = [
      { heading: 'Related institutions', items: (r.relatedInstitutions ?? []).map((x: any) => item(x)) },
      { heading: 'Part of', items: (r.parentInstitutions ?? []).map((x: any) => item(x)) },
      { heading: 'Includes', items: (r.childInstitutions ?? []).map((x: any) => item(x)) },
      { heading: 'Alongside', items: (r.siblingInstitutions ?? []).map((x: any) => item(x)) },
      { heading: 'Attending institutions', items: (r.attendingInstitutions ?? []).map((x: any) => item(x, freq(x))) },
      { heading: 'Attended from', items: (r.attendedBy ?? []).map((x: any) => item(x, freq(x))) },
    ].filter(g => g.items.length);

    const hasPoint = !!(r.latitude && r.longitude);
    this.mapData = hasPoint
      ? [{ latitude: r.latitude, longitude: r.longitude, title: this.heading, internalLink: null, options: { color: RECORD_MAP_INKS.self } }]
      : [];
    this.updateViews();
    if (hasPoint) {
      this.mapOptions = { ...this.mapOptions, center: { lat: r.latitude, lng: r.longitude } };
    }
  }

  /** The succession ladder: everyone resident here, in order, with the posts before and after. */
  private buildLadder(people: any[]): void {
    const post = (p: any) => p && { label: `${institutionLabel(p.name, p.type)} (${p.year})`, link: ['/institutions', p.instID], query: { year: p.year } };
    this.ladder = people.map(p => ({
      key: p.persID,
      label: [p.title, p.name].filter(Boolean).join(' '),
      link: ['/people', p.persID],
      kind: 'pers' as const,
      detail: p.roles.join('; '),
      years: p.years,
      before: post(p.cameFrom),
      after: post(p.wentTo),
    }));
  }

  /**
   * The map around the record: its circuits as arcs (out from here solid,
   * in from elsewhere dashed), the linked places and the other institutions
   * of the year as dots, the bishop's see, a key and a one-line summary.
   */
  private buildMap(res: MapAround | null): void {
    const here = res?.places[res.places.length - 1];
    if (!res || !here) {
      this.mapLinks = [];
      this.mapContext = [];
      this.mapFit = null;
      this.mapKey = [];
      this.mapSummary = '';
      return;
    }
    const ink = RECORD_MAP_INKS;
    const query = this.year === null ? undefined : { year: this.year };
    const name = (x: { name: string; type: string; place: string }) => {
      const label = institutionLabel(x.name, x.type);
      return isUnnamed(x.name) && x.place ? `${label}, ${x.place}` : label;
    };
    const describe = (l: MapTie) => [
      `${name(l)}: ${l.dir === 'out' ? 'attended from here' : 'attended this one'}`,
      l.frequency,
      this.year === null ? yearRuns(l.years) : '',
      l.priests.length ? `by ${l.priests.join(', ')}` : '',
    ].filter(Boolean).join(' · ');
    const at: [number, number] = [here.lng, here.lat];

    this.mapLinks = res.links.map(l => ({
      from: l.dir === 'out' ? at : [l.lng, l.lat],
      to: l.dir === 'out' ? [l.lng, l.lat] : at,
      color: l.dir === 'out' ? ink.out : ink.in,
      dashed: l.dir === 'in',
      title: describe(l),
      link: ['/institutions', l.instID],
      query,
    }));
    const isSee = !!res.see && (res.see.instID === this.id || (Math.abs(res.see.lat - here.lat) < 1e-4 && Math.abs(res.see.lng - here.lng) < 1e-4));
    this.mapContext = [
      ...res.neighbours.map(n => ({ lat: n.lat, lng: n.lng, title: name(n), link: ['/institutions', n.instID], query, color: ink.other })),
      ...res.links.map(l => ({ lat: l.lat, lng: l.lng, title: describe(l), link: ['/institutions', l.instID], query,
        color: l.dir === 'out' ? ink.out : ink.in, radius: 4.5 })),
      ...(res.see && !isSee ? [{ lat: res.see.lat, lng: res.see.lng, title: `${name({ ...res.see, type: 'cathedral' })}: the bishop’s see`,
        link: ['/institutions', res.see.instID], query, color: ink.see, radius: 6.5 }] : []),
    ];

    // frame the institution and its circuits (not the neighbours, nor a far-off see)
    const pts = [at, ...res.links.map(l => [l.lng, l.lat] as [number, number])];
    this.mapFit = [Math.min(...pts.map(p => p[0])), Math.min(...pts.map(p => p[1])),
      Math.max(...pts.map(p => p[0])), Math.max(...pts.map(p => p[1]))];

    const outs = res.links.filter(l => l.dir === 'out').length;
    const ins = res.links.filter(l => l.dir === 'in').length;
    const when = this.year === null ? 'Over the years' : `In ${this.year}`;
    this.mapKey = [
      { label: 'This institution', color: ink.self, shape: 'dot' as const },
      ...(outs ? [{ label: 'Attended from here', color: ink.out, shape: 'line' as const }] : []),
      ...(ins ? [{ label: 'Attended this one', color: ink.in, shape: 'dashed' as const }] : []),
      ...(res.see && !isSee ? [{ label: 'Bishop’s see', color: ink.see, shape: 'dot' as const }] : []),
      ...(res.neighbours.length ? [{ label: `Other institutions in ${this.year}`, color: ink.other, shape: 'dot' as const }] : []),
    ];
    const count = (k: number, one: string, many: string) => k === 1 ? one : `${k} ${many}`;
    const parts = [
      outs ? `${count(outs, 'one place was', 'places were')} attended from here` : '',
      ins ? `it was attended from ${count(ins, 'one other place', 'other places')}` : '',
    ].filter(Boolean);
    this.mapSummary = parts.length ? `${when}, ${parts.join(', and ')}.` : '';
  }
}
