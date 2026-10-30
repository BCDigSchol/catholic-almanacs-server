import { Component, OnInit, OnDestroy } from '@angular/core';
import { DecimalPipe, PercentPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { ApiService } from '../../../services/api.service';
import { MapVisComponent } from '../../common/map-vis/map-vis.component';
import { MapLink } from '../../common/map-vis/map-overlays';
import { DashboardShellComponent } from '../../common/dashboard-shell/dashboard-shell.component';
import { ControlBarComponent, ControlChip } from '../../common/control-bar/control-bar.component';
import { VizPanelComponent, VizState } from '../../common/viz-panel/viz-panel.component';
import { SegmentedComponent } from '../../common/segmented/segmented.component';
import { YearRange, YearRangeComponent } from '../../common/year-range/year-range.component';
import { UrlState } from '../../../utils/url-state';
import { yearRuns } from '../../../utils/record-labels';
import { INKS } from '../../../utils/palette';
import { citation, downloadCsv, downloadGexf, ExportGraph } from '../../../utils/network-export';
import { Settings } from '../../../app.settings';

/** GET /api/stats/clergy-flows */
interface FlowsResponse {
  dioceses: Diocese[];
  flows: Flow[];
  totals: { moves: number; people: number; cross: number; gapMoves: number };
  meta: { gapYears: number; includesGap: boolean };
}
interface Diocese { id: string; name: string; lat: number | null; lng: number | null; out: number; in: number; within: number }
interface Flow { from: string; to: string; people: number; names: string[]; years: number[] }

const MIN_YEAR = 1833;
const MAX_YEAR = 1870;
const DEFAULTS = { from: 0, to: 0, gap: 'leave', focus: '' };

/** Sent more than received / received more / about even. */
const SENDER = INKS[1];
const RECEIVER = INKS[0];
const EVEN = INKS[5];

@Component({
  selector: 'app-clergy-flows',
  imports: [DecimalPipe, PercentPipe, MapVisComponent, DashboardShellComponent, ControlBarComponent, VizPanelComponent,
    SegmentedComponent, YearRangeComponent],
  templateUrl: './clergy-flows.component.html',
  styleUrl: './clergy-flows.component.scss'
})
export class ClergyFlowsComponent implements OnInit, OnDestroy {
  readonly related = [
    { label: 'The Institution Network: moves', link: '/dashboards/networks', queryParams: { tie: 'moved' } },
    { label: 'Mission Circuits', link: '/dashboards/circuits' },
    { label: 'Diocese by Diocese', link: '/dashboards/diocese-tracker' },
  ];
  readonly minYear = MIN_YEAR;
  readonly maxYear = MAX_YEAR;
  readonly gapOptions = [{ value: 'leave', label: 'Leave out' }, { value: 'include', label: 'Include' }];
  readonly ink = { sender: SENDER, receiver: RECEIVER, even: EVEN, flow: INKS[6] };

  state = { ...DEFAULTS };
  vizState: VizState = 'loading';
  takeaway = '';
  chips: ControlChip[] = [];

  data: FlowsResponse | null = null;
  /** The flows shown (all, or the focused see's), largest first. */
  flows: (Flow & { fromName: string; toName: string; yearsLabel: string })[] = [];
  /** Dioceses by how many priests they sent or received. */
  balances: (Diocese & { net: number })[] = [];
  focusName = '';
  crossShare = 0;

  mapData: any[] = [];
  mapLinks: MapLink[] = [];
  mapFit: [number, number, number, number] | null = null;
  readonly mapOptions = {
    mode: 'point' as const,
    zoom: window.innerWidth < 640 ? 2 : 3.4,
    center: { lat: 39, lng: window.innerWidth < 640 ? -96 : -88 },
    size: { width: '100%', height: 'clamp(320px, 62vh, 620px)' },
  };

  private url: UrlState<typeof DEFAULTS>;
  private subs: Subscription[] = [];
  private fetchSub?: Subscription;
  private lastQuery: string | null = null;

  constructor(private api: ApiService, router: Router, route: ActivatedRoute) {
    this.url = new UrlState(router, route, DEFAULTS);
  }

  ngOnInit(): void {
    this.subs.push(this.url.changes().subscribe(state => {
      this.state = state;
      const q = this.query();
      if (q !== this.lastQuery) {
        this.lastQuery = q;
        this.fetchData();
      } else {
        this.update();
      }
    }));
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    this.fetchSub?.unsubscribe();
  }

  // ---- controls -------------------------------------------------------------

  setYears(range: YearRange): void {
    const all = range.from === MIN_YEAR && range.to === MAX_YEAR;
    this.url.set({ from: all ? 0 : range.from, to: all ? 0 : range.to });
  }
  setGap(gap: string): void { this.url.set({ gap }); }
  setFocus(focus: string): void { this.url.set({ focus: focus === this.state.focus ? '' : focus }); }
  clearAll = (): void => this.url.set({ from: 0, to: 0, focus: '' });

  /** A click on the map picks the nearest see (map-vis' clickToSelect). */
  onMapSelect(item: any): void {
    if (item?.id) this.setFocus(item.id);
  }

  get yearLabel(): string {
    return `${this.state.from || MIN_YEAR}–${this.state.to || MAX_YEAR}`;
  }

  // ---- data -----------------------------------------------------------------

  private query(): string {
    const q = new URLSearchParams();
    if (this.state.from) q.set('from', String(this.state.from));
    if (this.state.to) q.set('to', String(this.state.to));
    if (this.state.gap === 'include') q.set('gap', 'include');
    return q.toString();
  }

  fetchData(): void {
    this.vizState = 'loading';
    this.fetchSub?.unsubscribe();
    const q = this.query();
    this.fetchSub = this.api.getTypeRequest('stats/clergy-flows' + (q ? '?' + q : '')).subscribe({
      next: (res: any) => {
        this.data = res as FlowsResponse;
        this.vizState = this.data.flows.length ? 'ready' : 'empty';
        this.update();
      },
      error: () => this.vizState = 'error',
    });
  }

  private update(): void {
    const data = this.data;
    if (!data) return;
    const byId = new Map(data.dioceses.map(d => [d.id, d]));
    const name = (id: string) => byId.get(id)?.name ?? id;
    const focus = byId.has(this.state.focus) ? this.state.focus : '';
    this.focusName = focus ? name(focus) : '';

    this.chips = [
      ...(focus ? [{ label: `Diocese: ${this.focusName}`, clear: () => this.setFocus('') }] : []),
      ...(this.state.from || this.state.to ? [{ label: `Years: ${this.yearLabel}`, clear: () => this.url.set({ from: 0, to: 0 }) }] : []),
    ];

    const shown = focus ? data.flows.filter(f => f.from === focus || f.to === focus) : data.flows;
    this.flows = shown.map(f => ({ ...f, fromName: name(f.from), toName: name(f.to), yearsLabel: yearRuns(f.years) }));
    this.balances = data.dioceses
      .filter(d => d.out || d.in)
      .map(d => ({ ...d, net: d.in - d.out }))
      .sort((a, b) => (b.in + b.out) - (a.in + a.out) || a.name.localeCompare(b.name));
    this.crossShare = data.totals.moves ? data.totals.cross / data.totals.moves : 0;

    // the map: sees sized by priests sent and received, coloured by balance;
    // arcs from the sending to the receiving see, thicker for more people
    const max = Math.max(1, ...shown.map(f => f.people));
    const at = (id: string) => byId.get(id);
    this.mapLinks = shown
      .filter(f => at(f.from)?.lat != null && at(f.to)?.lat != null)
      .map(f => ({
        from: [at(f.from)!.lng!, at(f.from)!.lat!],
        to: [at(f.to)!.lng!, at(f.to)!.lat!],
        color: this.ink.flow,
        width: 0.8 + 4.2 * Math.sqrt(f.people / max),
        title: `${name(f.from)} → ${name(f.to)}: ${f.people} ${f.people === 1 ? 'priest' : 'priests'}, ${yearRuns(f.years)}`
          + (f.names.length ? ` (${f.names.slice(0, 3).join(', ')}${f.people > 3 ? '…' : ''})` : ''),
      }));
    const involved = focus ? new Set(shown.flatMap(f => [f.from, f.to])) : null;
    this.mapData = this.balances
      .filter(d => d.lat != null && (!involved || involved.has(d.id)))
      .map(d => ({
        id: d.id,
        latitude: d.lat, longitude: d.lng,
        title: `Diocese of ${d.name}: sent ${d.out}, received ${d.in}` + (d.within ? `, ${d.within} moved within` : ''),
        options: {
          color: d.net > 0 ? RECEIVER : d.net < 0 ? SENDER : EVEN,
          radius: Math.min(4 + Math.sqrt(d.in + d.out) * 2, 16),
        },
      }));
    const pts = this.mapData.map(d => [d.longitude, d.latitude]);
    if (focus && pts.length) {
      this.mapFit = [Math.min(...pts.map(p => p[0])), Math.min(...pts.map(p => p[1])), Math.max(...pts.map(p => p[0])), Math.max(...pts.map(p => p[1]))];
    } else {
      const [[w, s], [e, n]] = Settings.mapBounds;
      this.mapFit = [w, s, e, n];
    }
    this.takeaway = this.computeTakeaway(name, focus);
  }

  private computeTakeaway(name: (id: string) => string, focus: string): string {
    const data = this.data!;
    const t = data.totals;
    if (!t.moves) return '';
    if (focus) {
      const d = data.dioceses.find(x => x.id === focus)!;
      const top = this.flows[0];
      const lead = `Between ${this.yearLabel} the Diocese of ${d.name} sent ${d.out} ${d.out === 1 ? 'priest' : 'priests'} to other dioceses and received ${d.in}`;
      return top ? `${lead}; its largest exchange was ${top.people} from ${top.fromName} to ${top.toName}.` : `${lead}.`;
    }
    const top = this.flows[0];
    const lead = `Between ${this.yearLabel}, ${t.people.toLocaleString()} clergy moved between posts; ${Math.round(100 * this.crossShare)}% of the moves crossed into another diocese.`;
    return top ? `${lead} The largest flow ran from ${top.fromName} to ${top.toName} (${top.people}).` : lead;
  }

  // ---- export -----------------------------------------------------------------

  private exportGraph(): ExportGraph {
    const data = this.data!;
    const shown = new Set(this.flows.flatMap(f => [f.from, f.to]));
    return {
      directed: true,
      description: `Clergy moving between dioceses, ${this.yearLabel}${this.focusName ? ', Diocese of ' + this.focusName : ''}`
        + `${data.meta.includesGap ? ', including moves across the 1838–1864 gap' : ''}. Nodes: dioceses (sent, received, moved within). `
        + `Edges: people who left a post in one diocese for a post in the other, in the year they arrived. ${citation()}`,
      nodes: data.dioceses.filter(d => shown.has(d.id)).map(d => ({ id: d.id, label: d.name, lat: d.lat, lng: d.lng, sent: d.out, received: d.in, within: d.within })),
      edges: this.flows.map(f => ({ source: f.from, target: f.to, weight: f.people, years: f.years.join(' '), people: f.names })),
    };
  }

  downloadCsv(): void { downloadCsv('clergy-flows', this.exportGraph()); }
  downloadGexf(): void { downloadGexf('clergy-flows', this.exportGraph()); }
}
