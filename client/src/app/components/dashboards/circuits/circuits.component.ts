import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { DecimalPipe, PercentPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import * as d3 from 'd3';

import { ApiService } from '../../../services/api.service';
import { MapVisComponent } from '../../common/map-vis/map-vis.component';
import { MapContextPoint, MapLink } from '../../common/map-vis/map-overlays';
import { DashboardShellComponent } from '../../common/dashboard-shell/dashboard-shell.component';
import { ControlBarComponent, ControlChip } from '../../common/control-bar/control-bar.component';
import { VizPanelComponent, VizState } from '../../common/viz-panel/viz-panel.component';
import { YearPlayerComponent } from '../../common/year-player/year-player.component';
import { UrlState } from '../../../utils/url-state';
import { yearScale, drawYearAxis } from '../../../utils/year-scale';
import { institutionLabel, isUnnamed } from '../../../utils/record-labels';
import { RECORD_MAP_INKS } from '../../../utils/record-map';
import { Settings } from '../../../app.settings';

/** GET /api/stats/circuits */
interface CircuitsResponse {
  years: { year: number; institutions: number; stations: number; hubs: number; links: number; byDiocese: Record<string, number> }[];
  /** instID → [name, type, town, dioceseId] */
  places: Record<string, [string, string, string, string]>;
  /** [year, hub, station, hubLat, hubLng, stLat, stLng, via] */
  links: [number, string, string, number, number, number, number, number][];
  dioceseNames: Record<string, string>;
  /** Links left out as impossibly long (a misplaced record): [year, hub, station, miles] */
  misplaced: [number, string, string, number][];
  note: string;
}

type Link = CircuitsResponse['links'][number];

/** One year's figures for the chart and the strip (after the diocese filter). */
interface YearFigures {
  year: number;
  institutions: number;
  stations: number;
  hubs: number;
  share: number;
}

/** A hub of the selected year: the places it served and how far they lay. */
interface Hub {
  instID: string;
  label: string;
  town: string;
  stations: number;
  farthest: number;
}

const DEFAULTS = { year: 0, diocese: '' };
const MILES_PER_RADIAN = 3959;

@Component({
  selector: 'app-circuits',
  imports: [DecimalPipe, PercentPipe, RouterLink, MapVisComponent, DashboardShellComponent, ControlBarComponent,
    VizPanelComponent, YearPlayerComponent],
  templateUrl: './circuits.component.html',
  styleUrl: './circuits.component.scss'
})
export class CircuitsComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('share', { static: true }) shareRef!: ElementRef<HTMLDivElement>;

  readonly related = [
    { label: 'The Spread of the Church', link: '/dashboards/spread' },
    { label: 'Diocese by Diocese', link: '/dashboards/diocese-tracker' },
    { label: 'Coverage — the Shape of the Data', link: '/dashboards/coverage' },
  ];
  readonly ink = RECORD_MAP_INKS;

  state = { ...DEFAULTS };
  vizState: VizState = 'loading';
  note = '';
  /** How many links were left out as misplaced records. */
  misplaced = 0;
  takeaway = '';
  chips: ControlChip[] = [];
  dioceseOptions: { id: string; name: string }[] = [];

  years: number[] = [];
  year: number | null = null;
  figures: YearFigures[] = [];
  current: YearFigures | null = null;
  hubs: Hub[] = [];
  readonly topHubs = 12;
  farthest: Hub | null = null;

  mapData: any[] = [];
  mapLinks: MapLink[] = [];
  mapContext: MapContextPoint[] = [];
  mapFit: [number, number, number, number] | null = null;
  readonly mapOptions = {
    mode: 'point' as const,
    zoom: window.innerWidth < 640 ? 2 : 3.4,
    center: { lat: 39, lng: window.innerWidth < 640 ? -96 : -94 },
    size: { width: '100%', height: 'clamp(320px, 62vh, 620px)' },
  };

  private data: CircuitsResponse | null = null;
  private linksByYear = new Map<number, Link[]>();
  private url: UrlState<typeof DEFAULTS>;
  private subs: Subscription[] = [];
  private resizeObserver?: ResizeObserver;
  private lastWidth = 0;

  constructor(private api: ApiService, router: Router, route: ActivatedRoute) {
    this.url = new UrlState(router, route, DEFAULTS);
  }

  ngOnInit(): void {
    this.subs.push(this.url.changes().subscribe(state => {
      const dioceseChanged = state.diocese !== this.state.diocese;
      this.state = state;
      const name = this.data?.dioceseNames[state.diocese];
      this.chips = state.diocese ? [{ label: `Diocese: ${name ?? state.diocese}`, clear: () => this.setDiocese('') }] : [];
      if (this.data) this.update(dioceseChanged);
    }));
    this.fetchData();
  }

  ngAfterViewInit(): void {
    this.resizeObserver = new ResizeObserver(() => {
      const w = this.shareRef.nativeElement.clientWidth;
      if (w > 0 && w !== this.lastWidth) this.renderShare();
    });
    this.resizeObserver.observe(this.shareRef.nativeElement);
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    this.resizeObserver?.disconnect();
  }

  // ---- controls -------------------------------------------------------------

  setYear(year: number): void { this.url.set({ year }); }
  setDiocese(diocese: string): void { this.url.set({ diocese }); }
  clearAll = (): void => this.url.set({ diocese: '' });

  // ---- data -----------------------------------------------------------------

  fetchData(): void {
    this.vizState = 'loading';
    this.api.getTypeRequest('stats/circuits').subscribe({
      next: (res: any) => {
        this.data = res as CircuitsResponse;
        this.note = this.data.note;
        this.misplaced = this.data.misplaced?.length ?? 0;
        this.linksByYear = new Map();
        for (const l of this.data.links) {
          const list = this.linksByYear.get(l[0]);
          if (list) list.push(l); else this.linksByYear.set(l[0], [l]);
        }
        // only dioceses that had a circuit at some point
        const withCircuits = new Set(this.data.links.map(l => this.data!.places[l[1]]?.[3]));
        this.dioceseOptions = Object.entries(this.data.dioceseNames)
          .filter(([id]) => withCircuits.has(id) && id !== 'unknown')
          .map(([id, name]) => ({ id, name }))
          .sort((a, b) => a.name.localeCompare(b.name));
        const name = this.data.dioceseNames[this.state.diocese];
        this.chips = this.state.diocese ? [{ label: `Diocese: ${name ?? this.state.diocese}`, clear: () => this.setDiocese('') }] : [];
        this.vizState = this.data.links.length ? 'ready' : 'empty';
        this.update(true);
      },
      error: () => this.vizState = 'error',
    });
  }

  private inDiocese = (l: Link): boolean => !this.state.diocese || this.data!.places[l[1]]?.[3] === this.state.diocese;

  /** Recompute everything derived from the state: figures, map, hubs, takeaway, chart. */
  private update(reframe: boolean): void {
    const data = this.data!;
    const dio = this.state.diocese;
    this.figures = data.years.map(y => {
      const links = (this.linksByYear.get(y.year) ?? []).filter(this.inDiocese);
      const stations = new Set(links.map(l => l[2])).size;
      const institutions = dio ? (y.byDiocese[dio] ?? 0) : y.institutions;
      return { year: y.year, institutions, stations, hubs: new Set(links.map(l => l[1])).size,
        share: institutions ? stations / institutions : 0 };
    });
    // the player steps through years that had circuits (the 1833 almanac has none)
    this.years = this.figures.filter(f => f.stations > 0).map(f => f.year);
    const latest = this.years[this.years.length - 1];
    this.year = this.years.includes(this.state.year) ? this.state.year : latest ?? null;
    this.current = this.figures.find(f => f.year === this.year) ?? null;

    const links = this.year === null ? [] : (this.linksByYear.get(this.year) ?? []).filter(this.inDiocese);
    this.buildHubs(links);
    this.buildMap(links, reframe);
    this.takeaway = this.computeTakeaway();
    this.renderShare();
  }

  private label(id: string): string {
    const p = this.data!.places[id];
    if (!p) return id;
    const name = institutionLabel(p[0], p[1]);
    return isUnnamed(p[0]) && p[2] ? `${name}, ${p[2]}` : name;
  }

  private miles(l: Link): number {
    return Math.round(d3.geoDistance([l[4], l[3]], [l[6], l[5]]) * MILES_PER_RADIAN);
  }

  private buildHubs(links: Link[]): void {
    const hubs = new Map<string, Hub>();
    for (const l of links) {
      let h = hubs.get(l[1]);
      if (!h) {
        h = { instID: l[1], label: this.label(l[1]), town: this.data!.places[l[1]]?.[2] ?? '', stations: 0, farthest: 0 };
        hubs.set(l[1], h);
      }
      h.stations++;
      h.farthest = Math.max(h.farthest, this.miles(l));
    }
    this.hubs = [...hubs.values()].sort((a, b) => b.stations - a.stations || b.farthest - a.farthest);
    this.farthest = this.hubs.reduce<Hub | null>((best, h) => !best || h.farthest > best.farthest ? h : best, null);
  }

  private buildMap(links: Link[], reframe: boolean): void {
    const year = this.year;
    const query = year ? `?year=${year}` : '';
    const counts = new Map(this.hubs.map(h => [h.instID, h.stations]));
    const hubAt = new Map<string, [number, number]>();
    for (const l of links) hubAt.set(l[1], [l[3], l[4]]);
    this.mapData = [...hubAt].map(([id, [lat, lng]]) => {
      const n = counts.get(id) ?? 1;
      return {
        latitude: lat, longitude: lng,
        title: `${this.label(id)}: served ${n === 1 ? 'one place' : n + ' places'}`,
        internalLink: `/institutions/${id}${query}`,
        options: { color: this.ink.self, radius: Math.min(3.5 + Math.sqrt(n) * 1.6, 14) },
      };
    });
    this.mapLinks = links.map(l => ({ from: [l[4], l[3]], to: [l[6], l[5]], color: this.ink.out, width: 1,
      title: `${this.label(l[2])}: served from ${this.label(l[1])}, ${this.miles(l)} mi` }));
    const stations = new Map<string, Link>();
    for (const l of links) stations.set(l[2], l);
    this.mapContext = [...stations.values()].map(l => ({ lat: l[5], lng: l[6], color: this.ink.out, radius: 2.5,
      title: `${this.label(l[2])}: served from ${this.label(l[1])}`, link: ['/institutions', l[2]],
      query: year ? { year } : undefined }));

    // frame the diocese's circuits when one is chosen, else the whole country
    if (reframe) {
      const all = this.state.diocese ? this.data!.links.filter(this.inDiocese) : [];
      if (all.length) {
        const lats = all.flatMap(l => [l[3], l[5]]), lngs = all.flatMap(l => [l[4], l[6]]);
        this.mapFit = [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
      } else {
        const [[w, s], [e, n]] = Settings.mapBounds;
        this.mapFit = [w, s, e, n];
      }
    }
  }

  private computeTakeaway(): string {
    const cur = this.current;
    if (!cur || !cur.stations) return '';
    const where = this.state.diocese ? ` in the Diocese of ${this.data!.dioceseNames[this.state.diocese]}` : '';
    const pct = Math.round(cur.share * 100);
    const top = this.hubs[0];
    const lead = `In ${cur.year}, ${cur.stations.toLocaleString()} places${where}, ${pct}% of the institutions recorded, `
      + `were attended from another church: ${cur.hubs.toLocaleString()} ${cur.hubs === 1 ? 'church or institution served' : 'churches and institutions served'} them.`;
    return top && top.stations > 1
      ? `${lead} The largest circuit, ${top.label}${top.town && !top.label.includes(top.town) ? ' in ' + top.town : ''}, reached ${top.stations} places, the farthest ${top.farthest} miles away.`
      : lead;
  }

  // ---- chart: share of institutions served from elsewhere, by year ----------

  private renderShare(): void {
    const host = this.shareRef?.nativeElement;
    if (!host || host.clientWidth === 0) return;
    d3.select(host).selectAll('*').remove();
    if (!this.figures.length) return;

    const width = host.clientWidth;
    this.lastWidth = width;
    const compact = width < 520;
    const margin = { top: 14, right: 12, bottom: 30, left: compact ? 40 : 46 };
    const height = compact ? 180 : 210;
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;
    const allYears = this.figures.map(f => f.year);

    const svg = d3.select(host).append('svg').attr('width', width).attr('height', height)
      .attr('role', 'img').attr('aria-label', 'Share of recorded institutions served from another place, by year');
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    const x = yearScale(allYears, [0, innerW]);
    const max = Math.max(0.05, d3.max(this.figures, f => f.share) ?? 0);
    const y = d3.scaleLinear().domain([0, max]).nice(4).range([innerH, 0]);

    const yTicks = y.ticks(4);
    g.append('g').attr('class', 'gridline').selectAll('line').data(yTicks).join('line')
      .attr('x1', 0).attr('x2', innerW).attr('y1', d => y(d)).attr('y2', d => y(d));
    g.append('g').call(d3.axisLeft(y).tickValues(yTicks).tickSize(0).tickPadding(6).tickFormat(d3.format('.0%')))
      .call(sel => sel.select('.domain').remove());
    drawYearAxis(g, x, innerH, { minSpacing: compact ? 40 : 36 });

    const bw = Math.max(4, Math.min(28, innerW / allYears.length * 0.6));
    const tooltip = d3.select(host).append('div').attr('class', 'chart-tooltip');
    g.append('g').selectAll('rect').data(this.figures).join('rect')
      .attr('x', d => x(d.year) - bw / 2).attr('width', bw)
      .attr('y', d => y(d.share)).attr('height', d => innerH - y(d.share))
      .attr('fill', d => d.year === this.year ? 'var(--c-year)' : this.ink.out)
      .style('cursor', d => d.stations ? 'pointer' : 'default')
      .on('click', (_e, d) => { if (d.stations) this.setYear(d.year); })
      .on('mousemove', (event: MouseEvent, d) => {
        const [mx, my] = d3.pointer(event, host);
        tooltip.style('opacity', '1')
          .style('left', `${Math.min(mx + 12, width - 220)}px`).style('top', `${my + 12}px`)
          .html(`<strong>${d.year}</strong><br>${d.stations.toLocaleString()} of ${d.institutions.toLocaleString()} institutions `
            + `(${Math.round(d.share * 100)}%)<br>served from ${d.hubs.toLocaleString()} others`);
      })
      .on('mouseleave', () => tooltip.style('opacity', '0'));
  }
}
