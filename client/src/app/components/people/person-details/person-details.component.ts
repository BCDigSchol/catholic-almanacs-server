import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { Subscription, combineLatest, of } from 'rxjs';
import { catchError, distinctUntilChanged, map, shareReplay, switchMap, tap } from 'rxjs/operators';

import { ApiService } from '../../../services/api.service';
import { MapVisComponent } from '../../common/map-vis/map-vis.component';
import { NetworkGraphComponent } from '../../common/network-graph/network-graph.component';
import { PageHeaderComponent } from '../../common/page-header/page-header.component';
import { YearTabsComponent } from '../../common/year-tabs/year-tabs.component';
import { CiteComponent } from '../../common/cite/cite.component';
import { institutionLabel, isUnnamed, placeLabel, yearRuns } from '../../../utils/record-labels';

/** One (year, institution) listing from GET /person/:id/timeline. */
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
  imports: [RouterLink, MapVisComponent, NetworkGraphComponent, PageHeaderComponent, YearTabsComponent, CiteComponent],
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
  readonly networkOptions = { height: '520px' };

  private subs: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService,
    private title: Title,
  ) {}

  ngOnInit(): void {
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
      this.recompute();
      this.title.setTitle(res ? `${this.heading} · Catholic Almanacs` : 'Person not found · Catholic Almanacs');
      if (res) {
        const [start, end] = year === null ? [this.years[0], this.years[this.years.length - 1]] : [year, year];
        this.fetchNetwork(start, end);
      }
    }));
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
    });
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
  service: ServiceRow[] = [];
  mapData: any[] = [];
  readonly mapOptions = { zoom: 5, center: { lat: 39, lng: -88 }, size: { width: '100%', height: '320px' } };
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

    const points = new Map<string, any>();
    for (const l of shown) {
      if (l.latitude && l.longitude) {
        points.set(l.instID, {
          latitude: l.latitude,
          longitude: l.longitude,
          title: institutionLabel(l.instName, l.instType),
          internalLink: ['/institutions', l.instID],
        });
      }
    }
    this.mapData = [...points.values()];
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
