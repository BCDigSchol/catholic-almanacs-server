import {
  Component, OnInit, OnDestroy, ViewChild, ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { ApiService } from '../../../services/api.service';
import { MapVisComponent } from '../../common/map-vis/map-vis.component';
import { DashboardShellComponent } from '../../common/dashboard-shell/dashboard-shell.component';
import { ControlBarComponent, ControlChip } from '../../common/control-bar/control-bar.component';
import { VizPanelComponent, VizState } from '../../common/viz-panel/viz-panel.component';
import { UrlState } from '../../../utils/url-state';
import { COUNT_RAMP } from '../../../utils/palette';

// Sequential 5-step ramp (light -> dark) for the map, whose base tiles are
// light in both themes. The grid uses the --cov-N tokens in the SCSS instead,
// which flip for dark mode.
const d3sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

const RAMP = COUNT_RAMP;

type CellState = 'data' | 'empty' | 'absent';
interface CovCell { year: number; n: number; cls: string; title: string; gapBefore: boolean; civilWarBefore: boolean; }
interface CovRow { key: string; name: string; title: string; cells: CovCell[]; }
interface HeaderYear { year: number; gapBefore: boolean; civilWarBefore: boolean; }
interface RawDiocese {
  key: string; name?: string; total: number; firstYear: number | null; lastYear: number | null;
  years?: Record<string, number>; existYears?: number[]; namesByYear?: Record<string, string>; errorYears?: Record<string, string>;
}

/** `year` 0 = all years on the map; `diocese` '' = every diocese. */
const DEFAULTS = { year: 0, diocese: '' };

/**
 * "Coverage — the Shape of the Data": a GitHub-contribution-style diocese x
 * year grid (how thoroughly each see was recorded, year by year) beside a
 * binned heatmap of where records concentrate (map-vis' `bins` mode). Colour
 * is on a sqrt scale so dense cities don't flatten the rest. The grid drives
 * the map: a year column sets the map year, a diocese row limits it.
 */
@Component({
  selector: 'app-coverage',
  imports: [MapVisComponent, DashboardShellComponent, ControlBarComponent, VizPanelComponent],
  templateUrl: './coverage.component.html',
  styleUrl: './coverage.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CoverageComponent implements OnInit, OnDestroy {
  @ViewChild(MapVisComponent) private mapVis?: MapVisComponent;

  readonly related = [
    { label: 'The Almanacs at a Glance', link: '/dashboards/overview' },
    { label: 'Diocese by Diocese', link: '/dashboards/diocese-tracker' },
    { label: 'The Spread of the Church', link: '/dashboards/spread' },
  ];
  readonly ramp = RAMP;
  readonly levels = [1, 2, 3, 4, 5];
  // 1862-63: the almanac was not published during the Civil War, so those
  // years are absent entirely; a pink band marks the break between columns.
  readonly civilWarNote = 'The Catholic Almanac was not published in 1862–1863, during the Civil War, so records for these years are absent or highly disrupted.';

  state = { ...DEFAULTS };
  vizState: VizState = 'loading';
  note = '';
  takeaway = '';
  chips: ControlChip[] = [];
  mapNote = '';

  years: number[] = [];
  headerYears: HeaderYear[] = [];
  rows: CovRow[] = [];
  selectedDioceseLabel = '';

  mapData: any[] = [];
  readonly mapOptions = {
    zoom: 3.4,
    mode: 'bins' as const,
    modeControl: false,
    center: { lat: 39, lng: -95 },
    modeOptions: { bins: { size: 0.5, ramp: RAMP, opacity: 0.85 } },
    // Tall beside the grid on desktop, about square on phones.
    size: { width: '100%', height: 'min(620px, calc(100vh - 200px), max(300px, 85vw))' }
  };

  private raw: RawDiocese[] = [];
  private dioceseKeys: string[] = [];
  // [lat, lng, year, n, dioceseIndex]
  private allPoints: [number, number, number, number, number][] = [];
  private url: UrlState<typeof DEFAULTS>;
  private subs: Subscription[] = [];
  private fetchSub?: Subscription;
  private focusedDiocese: string | null = null;

  constructor(private api: ApiService, private cdr: ChangeDetectorRef, router: Router, route: ActivatedRoute) {
    this.url = new UrlState(router, route, DEFAULTS);
  }

  ngOnInit(): void {
    this.subs.push(this.url.changes().subscribe(state => {
      this.state = state;
      this.updateView();
    }));
    this.fetchData();
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    this.fetchSub?.unsubscribe();
  }

  fetchData(): void {
    this.vizState = 'loading';
    this.fetchSub?.unsubscribe();
    this.fetchSub = this.api.getTypeRequest('stats/coverage').subscribe({
      next: (res: any) => {
        this.years = res.years ?? [];
        this.raw = res.dioceses ?? [];
        this.allPoints = res.points ?? [];
        this.note = res.note ?? '';
        this.buildGrid(res.maxCell || 1);
        this.vizState = this.rows.length ? 'ready' : 'empty';
        this.updateView();
      },
      error: () => {
        this.vizState = 'error';
        this.cdr.markForCheck();
      }
    });
  }

  // ---- controls -------------------------------------------------------------

  setYear(year: number): void { this.url.set({ year }); }

  /** Click a year column → show that year on the map (again → all years). */
  pickYear(year: number): void { this.url.set({ year: this.state.year === year ? 0 : year }); }

  /** Click a diocese row → limit the map to that diocese (again → all). */
  pickDiocese(key: string): void { this.url.set({ diocese: this.state.diocese === key ? '' : key }); }

  /** Click a cell → that diocese in that year (again → clear both). */
  pickCell(key: string, year: number): void {
    const same = this.state.diocese === key && this.state.year === year;
    this.url.set({ diocese: same ? '' : key, year: same ? 0 : year });
  }

  clearAll = (): void => this.url.set({ year: 0, diocese: '' });

  // ---- view -----------------------------------------------------------------

  private buildGrid(maxCell: number): void {
    const years = this.years;
    const gapAt = (i: number) => i > 0 && years[i] - years[i - 1] > 3;
    const civilWarAt = (i: number) => i > 0 && years[i - 1] < 1862 && years[i] > 1863;
    this.headerYears = years.map((year, i) => ({ year, gapBefore: gapAt(i), civilWarBefore: civilWarAt(i) }));
    this.rows = this.raw.map(d => {
      const name = d.name || d.key;
      const exists = new Set<number>(d.existYears ?? years);   // no timeline => every year
      const span = d.firstYear == null ? 'no records' : d.firstYear === d.lastYear ? `${d.firstYear}` : `${d.firstYear}–${d.lastYear}`;
      return {
        key: d.key, name,
        title: `${name} — ${d.total.toLocaleString()} institutions · ${span}. Click to focus the map.`,
        cells: years.map((year, i) => {
          const n = d.years?.[year] || 0;
          const error = d.errorYears?.[year];
          const state: CellState = !exists.has(year) ? 'absent' : n > 0 ? 'data' : 'empty';
          const alias = d.namesByYear?.[year] && d.namesByYear[year] !== name ? ` (recorded as “${d.namesByYear[year]}”)` : '';
          const title = error ? `${name} · ${year} — ${error}`
            : state === 'absent' ? `${name} · ${year} — did not exist`
            : n ? `${name} · ${year} — ${n} institution${n === 1 ? '' : 's'}${alias}`
            : `${name} · ${year} — no records yet${alias}`;
          const cls = error ? 'err' : state === 'absent' ? 'absent' : state === 'empty' ? 'l0' : `l${this.level(n, maxCell)}`;
          return { year, n, cls, title, gapBefore: gapAt(i), civilWarBefore: civilWarAt(i) };
        })
      };
    });
    this.dioceseKeys = this.rows.map(r => r.key);
  }

  /** Everything derived from the data + URL state; then focus the map if the diocese changed. */
  private updateView(): void {
    const { year, diocese } = this.state;
    const row = this.rows.find(r => r.key === diocese);
    this.selectedDioceseLabel = row?.name ?? diocese;
    this.chips = [
      ...(year ? [{ label: `Map year: ${year}`, clear: () => this.url.set({ year: 0 }) }] : []),
      ...(diocese ? [{ label: `Diocese: ${this.selectedDioceseLabel}`, clear: () => this.url.set({ diocese: '' }) }] : []),
    ];
    if (!this.rows.length) { this.cdr.markForCheck(); return; }

    const di = diocese ? this.dioceseKeys.indexOf(diocese) : -1;
    let pts = this.allPoints;
    if (year) pts = pts.filter(p => p[2] === year);
    if (di >= 0) pts = pts.filter(p => p[4] === di);
    this.mapData = pts.map(p => ({ latitude: p[0], longitude: p[1], options: { value: p[3] } }));
    this.mapNote = `${year || 'All years'}${diocese ? ' · ' + this.selectedDioceseLabel : ''}`;
    this.takeaway = this.computeTakeaway();
    this.cdr.markForCheck();

    if ((diocese || null) !== this.focusedDiocese) {
      this.focusedDiocese = diocese || null;
      // Let the map receive its new data first (and finish its first layout).
      setTimeout(() => this.focusMap(), 50);
    }
  }

  private computeTakeaway(): string {
    const { year, diocese } = this.state;
    const raw = this.raw.find(d => d.key === diocese);
    const existed = (d: RawDiocese, y: number) => (d.existYears ?? this.years).includes(y);
    const recorded = (d: RawDiocese, y: number) => (d.years?.[y] || 0) > 0;
    if (raw) {
      const ys = this.years.filter(y => existed(raw, y));
      const withData = ys.filter(y => recorded(raw, y)).length;
      return `${raw.name || raw.key}: ${raw.total.toLocaleString()} institutions recorded, with records in ${withData} of the ${ys.length} almanac years it existed.`;
    }
    const tally = (y: number) => {
      const withData = this.raw.filter(d => recorded(d, y));
      const top = withData.reduce<RawDiocese | null>((a, d) => !a || (d.years![y] > a.years![y]) ? d : a, null);
      return { n: d3sum(withData.map(d => d.years![y])), k: withData.length, top };
    };
    const fmt = (n: number) => n.toLocaleString();
    if (year) {
      const t = tally(year);
      const top = t.top ? `, the most in ${t.top.name || t.top.key} (${fmt(t.top.years![year])})` : '';
      return `In ${year}, ${fmt(t.n)} institutions are recorded across ${t.k} dioceses${top}.`;
    }
    const first = this.years[0], last = this.years[this.years.length - 1];
    if (first === undefined || first === last) return '';
    const a = tally(first), b = tally(last);
    return `Recorded institutions grow from ${fmt(a.n)} in ${a.k} dioceses in ${first} to ${fmt(b.n)} in ${b.k} dioceses in ${last}.`;
  }

  // Zoom the map to the diocese's points, or back to the continental US.
  private focusMap(): void {
    if (!this.state.diocese) {
      this.mapVis?.fitToBounds([-125, 24, -66, 50]);
      return;
    }
    let w = Infinity, e = -Infinity, s = Infinity, n = -Infinity;
    for (const m of this.mapData) {
      const lat = m.latitude, lng = m.longitude;
      if (!lat || !lng || Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;  // skip null-island
      if (lng < w) w = lng; if (lng > e) e = lng;
      if (lat < s) s = lat; if (lat > n) n = lat;
    }
    if (w !== Infinity) this.mapVis?.fitToBounds([w, s, e, n]);
  }

  // sqrt scale -> level 1..5, so mid-range coverage stays visible.
  private level(n: number, max: number): number {
    const r = Math.sqrt(n) / Math.sqrt(max);
    return Math.min(RAMP.length, Math.max(1, Math.ceil(r * RAMP.length)));
  }
}
