import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import * as d3 from 'd3';

import { ApiService } from '../../../services/api.service';
import { MapVisComponent } from '../../common/map-vis/map-vis.component';
import { DashboardShellComponent } from '../../common/dashboard-shell/dashboard-shell.component';
import { ControlBarComponent, ControlChip } from '../../common/control-bar/control-bar.component';
import { VizPanelComponent, VizState } from '../../common/viz-panel/viz-panel.component';
import { YearPlayerComponent } from '../../common/year-player/year-player.component';
import { UrlState } from '../../../utils/url-state';
import { yearScale } from '../../../utils/year-scale';
import { institutionLabel } from '../../../utils/record-labels';
import { citation, downloadTable } from '../../../utils/network-export';

/** GET /api/stats/languages */
interface Category { id: string; label: string; kind: 'language' | 'people'; records: number; }
interface LanguagesResponse {
  categories: Category[];
  years: { year: number; total: number; counts: Record<string, number> }[];
  /** [lat, lng, instID, name, type, year, categories, source, dioceseId] */
  points: [number | null, number | null, string, string, string, number, string[], 'listed' | 'note', string][];
  dioceses: Record<string, string>;
}

/** Each category's ink, the same on the map, the key and the charts (rubric is kept for the selection). */
const INK: Record<string, string> = {
  german: '#3f6290', french: '#8a4f86', polish: '#c08a2e', bohemian: '#7d9bc2', dutch: '#b98c6c',
  italian: '#4d8463', spanish: '#dcb36a', irish: '#86b89a', native: '#8a5a3a', black: '#335f6b',
};

const DEFAULTS = { lang: '', year: 0 };

@Component({
  selector: 'app-languages',
  imports: [DecimalPipe, MapVisComponent, DashboardShellComponent, ControlBarComponent, VizPanelComponent, YearPlayerComponent],
  templateUrl: './languages.component.html',
  styleUrl: './languages.component.scss'
})
export class LanguagesComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('multiples', { static: true }) multiplesRef!: ElementRef<HTMLDivElement>;

  readonly related = [
    { label: 'Religious Orders', link: '/dashboards/orders' },
    { label: 'Diocese by Diocese', link: '/dashboards/diocese-tracker' },
    { label: 'The Spread of the Church', link: '/dashboards/spread' },
  ];
  readonly ink = INK;

  state = { ...DEFAULTS };
  vizState: VizState = 'loading';
  takeaway = '';
  chips: ControlChip[] = [];

  categories: Category[] = [];
  years: number[] = [];
  year: number | null = null;
  /** This year: how many institutions each category marks, and all recorded. */
  key: (Category & { count: number })[] = [];
  marked = 0;
  total = 0;
  unplaced = 0;
  dioceseRows: { id: string; name: string; count: number }[] = [];
  allDioceses = false;
  /** Records marked in the language column, and in a name or note, over all years. */
  sources = { listed: 0, note: 0 };

  mapData: any[] = [];
  readonly mapOptions = {
    mode: 'point' as const,
    zoom: window.innerWidth < 640 ? 2 : 3.4,
    center: { lat: 39, lng: window.innerWidth < 640 ? -96 : -90 },
    size: { width: '100%', height: 'clamp(320px, 58vh, 580px)' },
  };

  private data: LanguagesResponse | null = null;
  private url: UrlState<typeof DEFAULTS>;
  private subs: Subscription[] = [];
  private fetchSub?: Subscription;
  private resizeObserver?: ResizeObserver;
  private lastWidth = 0;

  constructor(private api: ApiService, router: Router, route: ActivatedRoute) {
    this.url = new UrlState(router, route, DEFAULTS);
  }

  ngOnInit(): void {
    this.subs.push(this.url.changes().subscribe(state => {
      this.state = state;
      if (this.data) this.update(); else this.fetchData();
    }));
  }

  ngAfterViewInit(): void {
    this.resizeObserver = new ResizeObserver(() => {
      const w = this.multiplesRef.nativeElement.clientWidth;
      if (w > 0 && w !== this.lastWidth) this.renderMultiples();
    });
    this.resizeObserver.observe(this.multiplesRef.nativeElement);
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    this.fetchSub?.unsubscribe();
    this.resizeObserver?.disconnect();
  }

  setLang(lang: string): void { this.url.set({ lang }); }
  toggleLang(lang: string): void { this.url.set({ lang: lang === this.state.lang ? '' : lang }); }
  setYear(year: number): void { this.url.set({ year }); }
  showAllDioceses(): void { this.allDioceses = true; }
  clearAll = (): void => this.url.set({ lang: '' });

  labelFor(id: string): string {
    return this.categories.find(c => c.id === id)?.label ?? id;
  }

  /** One request: every year's counts and every marked record. */
  fetchData(): void {
    this.vizState = 'loading';
    this.fetchSub?.unsubscribe();
    this.fetchSub = this.api.getTypeRequest('stats/languages').subscribe({
      next: (res: any) => {
        this.data = res as LanguagesResponse;
        this.categories = this.data.categories;
        this.years = this.data.years.map(y => y.year);
        this.sources = { listed: this.data.points.filter(p => p[7] === 'listed').length, note: this.data.points.filter(p => p[7] === 'note').length };
        this.update();
      },
      error: () => this.vizState = 'error',
    });
  }

  private update(): void {
    const data = this.data!;
    const lang = this.categories.some(c => c.id === this.state.lang) ? this.state.lang : '';
    const year = this.years.includes(this.state.year) ? this.state.year : this.years[this.years.length - 1];
    this.year = year;
    const row = data.years.find(y => y.year === year)!;
    this.total = row.total;
    this.key = this.categories.map(c => ({ ...c, count: row.counts[c.id] ?? 0 }));

    const pts = data.points.filter(p => p[5] === year && (!lang || p[6].includes(lang)));
    this.marked = pts.length;
    this.unplaced = pts.filter(p => p[0] == null).length;
    this.mapData = pts.filter(p => p[0] != null).map(([lat, lng, id, name, type, y, cats, source]) => {
      const shown = lang || cats[0];
      return {
        latitude: lat, longitude: lng,
        title: `${institutionLabel(name, type)}: ${cats.map(c => this.labelFor(c)).join(', ')}${source === 'note' ? ' (from its note)' : ''}`,
        internalLink: `/institutions/${id}?year=${y}`,
        options: { color: INK[shown] ?? INK['german'], radius: 4.5 },
      };
    });

    const byDio = new Map<string, number>();
    for (const p of pts) byDio.set(p[8], (byDio.get(p[8]) ?? 0) + 1);
    this.dioceseRows = [...byDio.entries()]
      .map(([id, count]) => ({ id, name: data.dioceses[id] ?? id, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    this.chips = [
      ...(lang ? [{ label: `Marked: ${this.labelFor(lang)}`, clear: this.clearAll }] : []),
      ...(this.state.year ? [{ label: `Year: ${this.state.year}`, clear: () => this.url.set({ year: 0 }) }] : []),
    ];
    this.takeaway = this.computeTakeaway(lang, year);
    this.vizState = this.marked ? 'ready' : 'empty';
    this.renderMultiples();
  }

  private computeTakeaway(lang: string, year: number): string {
    const data = this.data!;
    const count = (y: (typeof data.years)[number]) => lang ? y.counts[lang] ?? 0 : this.markedIn(y.year);
    const first = data.years.find(y => count(y) > 0);
    const now = data.years.find(y => y.year === year)!;
    const n = count(now);
    const what = lang ? `marked ${this.labelFor(lang)}` : 'marked as serving a language other than English, or a particular people';
    if (!n) return `In ${year} the almanac marked no institution ${lang ? this.labelFor(lang) : 'this way'}.`;
    const share = (100 * n / now.total).toFixed(1);
    const grew = first && first.year < year ? `, against ${count(first)} in ${first.year}` : '';
    const top = this.dioceseRows[0];
    return `In ${year} the almanac listed ${n.toLocaleString()} institutions ${what} (${share}% of all it recorded)${grew}.`
      + (top ? ` The most were in the Diocese of ${top.name} (${top.count}).` : '');
  }

  /** Institutions marked any way in a year (a record marked twice counts once). */
  private markedIn(year: number): number {
    return this.data!.points.filter(p => p[5] === year).length;
  }

  downloadCsv(): void {
    const lang = this.state.lang;
    const rows = this.data!.points
      .filter(p => p[5] === this.year && (!lang || p[6].includes(lang)))
      .map(([lat, lng, id, name, type, year, cats, source, dio]) => ({
        institution: id, name: institutionLabel(name, type), type, year,
        marked: cats.map(c => this.labelFor(c)), found_in: source === 'note' ? 'name or note' : 'language column',
        diocese: this.data!.dioceses[dio] ?? dio, latitude: lat, longitude: lng,
      }));
    downloadTable(`languages-${this.year}${lang ? '-' + lang : ''}.csv`, rows,
      `Institutions the Catholic Almanac of ${this.year} marked as serving a language other than English or a particular people${lang ? ` (${this.labelFor(lang)})` : ''}. ${citation()}`);
  }

  // ---- small multiples: each category over the years, on its own scale --------

  private renderMultiples(): void {
    const host = this.multiplesRef?.nativeElement;
    if (!host || host.clientWidth === 0 || !this.data) return;
    d3.select(host).selectAll('*').remove();
    const width = host.clientWidth;
    this.lastWidth = width;
    // two across even on phones: ten charts one under another would run long
    const cols = Math.max(width >= 300 ? 2 : 1, Math.min(5, Math.floor(width / 190)));
    const cellW = Math.floor(width / cols);
    const cellH = 124;
    const m = { top: 40, right: 12, bottom: 18, left: 30 };
    const innerW = cellW - m.left - m.right, innerH = cellH - m.top - m.bottom;
    const years = this.years;
    const x = yearScale(years, [0, innerW]);
    const rows = Math.ceil(this.categories.length / cols);

    const svg = d3.select(host).append('svg').attr('width', width).attr('height', rows * cellH)
      .attr('role', 'img').attr('aria-label', 'Institutions marked with each language or people, by year, each on its own scale');
    this.categories.forEach((c, i) => {
      const series = this.data!.years.map(y => ({ year: y.year, n: y.counts[c.id] ?? 0 }));
      const max = d3.max(series, d => d.n) || 1;
      // whole institutions only: small series get ticks at 0, 1, 2 rather than 0.5s
      const y = d3.scaleLinear().domain([0, Math.max(2, max)]).nice(2).range([innerH, 0]);
      const selected = c.id === this.state.lang;
      const g = svg.append('g')
        .attr('class', 'multiple' + (selected ? ' selected' : '') + (this.state.lang && !selected ? ' dim' : ''))
        .attr('transform', `translate(${(i % cols) * cellW},${Math.floor(i / cols) * cellH})`)
        .style('cursor', 'pointer').on('click', () => this.toggleLang(c.id));
      g.append('rect').attr('class', 'hit').attr('width', cellW).attr('height', cellH).attr('fill', 'transparent');
      g.append('text').attr('class', 'm-title').attr('x', m.left).attr('y', 14).text(c.label);
      g.append('text').attr('class', 'm-total').attr('x', m.left).attr('y', 28)
        .text(`${(this.data!.years.find(v => v.year === this.year)?.counts[c.id] ?? 0)} in ${this.year}`);
      const plot = g.append('g').attr('transform', `translate(${m.left},${m.top})`);
      plot.append('g').call(d3.axisLeft(y).ticks(2).tickFormat(d3.format(',d')).tickSize(-innerW).tickPadding(4))
        .call(s => s.select('.domain').remove()).call(s => s.selectAll('.tick line').attr('class', 'gridline'));
      // a separate line for each run of consecutive years, so the 1838–1864 gap stays open
      const runs: (typeof series)[] = [];
      series.forEach((d, k) => { if (k === 0 || d.year - series[k - 1].year > 1) runs.push([d]); else runs[runs.length - 1].push(d); });
      const area = d3.area<{ year: number; n: number }>().x(d => x(d.year)).y0(innerH).y1(d => y(d.n));
      const line = d3.line<{ year: number; n: number }>().x(d => x(d.year)).y(d => y(d.n));
      plot.selectAll('path.area').data(runs).join('path').attr('class', 'area').attr('d', area)
        .attr('fill', INK[c.id]).attr('fill-opacity', 0.15);
      plot.selectAll('path.line').data(runs).join('path').attr('class', 'line').attr('d', line)
        .attr('fill', 'none').attr('stroke', INK[c.id]).attr('stroke-width', 1.8);
      const now = series.find(d => d.year === this.year);
      if (now) plot.append('circle').attr('cx', x(now.year)).attr('cy', y(now.n)).attr('r', 3.5)
        .attr('fill', 'var(--c-year)').attr('stroke', 'var(--surface)').attr('stroke-width', 1.2);
      plot.append('text').attr('class', 'm-year').attr('x', 0).attr('y', innerH + 13).text(years[0]);
      plot.append('text').attr('class', 'm-year').attr('x', innerW).attr('y', innerH + 13).attr('text-anchor', 'end').text(years[years.length - 1]);
      g.append('title').text(`${c.label}: click to ${selected ? 'show every language' : 'show only this'}`);
    });
  }
}
