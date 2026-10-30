import { Directive, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { ApiService } from '../../../services/api.service';
import { spaceName } from '../../../pipes/space-name.pipe';
import { ControlChip } from '../control-bar/control-bar.component';
import { RelatedDashboard } from '../dashboard-shell/dashboard-shell.component';
import { VizState } from '../viz-panel/viz-panel.component';
import { YearRange } from '../year-range/year-range.component';
import { US_STATES, loadOptions, stateName } from '../../../utils/options';
import { UrlState } from '../../../utils/url-state';
import { institutionLabel, isUnnamed } from '../../../utils/record-labels';
import { NetworkGraphComponent } from './network-graph.component';
import { HIGHLIGHT_INK, MANY_INKS, OTHER_INK } from '../../../utils/palette';
import { citation, downloadCsv, downloadGexf, ExportGraph } from '../../../utils/network-export';
import { FocusPick } from '../network-focus/network-focus.component';

/** Almanac years the network endpoints can filter on. */
export const NETWORK_MIN_YEAR = 1833;
export const NETWORK_MAX_YEAR = 1870;

/** Every network dashboard keeps these in the URL; from/to of 0 mean "all years";
    focus/hops centre the graph on one node (hops '1' | '2' | 'all'). */
export type NetworkFilters = Record<string, string | number> & { from: number; to: number; focus: string; hops: string };

/** A connected group of the whole network (GET …/network: `groups`). */
export interface NetworkGroup {
  id: string;
  label: string;
  size: number;
  dioceses: string[];
}

/** The focus node, as the server found it under the filters. */
export interface NetworkFocus {
  id: string;
  found: boolean;
  label?: string;
  hops?: number | 'all';
}

const FOCUS_FIELDS: FilterField[] = [
  { key: 'focus', param: 'focus', label: 'Focus' },
  { key: 'hops', param: 'hops', label: 'Steps', isSwitch: true },
];

/** One filter: its URL key, the API param it maps to and how its chip reads. */
export interface FilterField {
  key: string;
  param: string;
  label: string;
  /** Free text (debounced) rather than a pick list. */
  text?: boolean;
  /** A switch (e.g. what a link means), not a filter: sent to the API, never a chip, kept by "Clear all". */
  isSwitch?: boolean;
  /** Only changes how the page draws (e.g. graph or map): never sent to the API. */
  local?: boolean;
}

export interface KeyEntry {
  group: string;
  label: string;
  color: string;
  count: number;
  hidden: boolean;
}

/** 20 distinguishable categorical colours, for dioceses. */
const PALETTE = MANY_INKS;

/**
 * Shared behaviour of the three network dashboards: filters in the URL,
 * debounced text fields, chips, fetching, a colour key and the takeaway.
 * Each page supplies its endpoint, its filters and its wording.
 */
@Directive()
export abstract class NetworkDashboard<T extends NetworkFilters> implements OnInit, OnDestroy {
  @ViewChild(NetworkGraphComponent) graph?: NetworkGraphComponent;

  readonly minYear = NETWORK_MIN_YEAR;
  readonly maxYear = NETWORK_MAX_YEAR;
  readonly usStates = US_STATES;
  abstract readonly related: RelatedDashboard[];
  protected abstract readonly defaults: T;
  protected abstract readonly endpoint: string;
  protected abstract readonly fields: FilterField[];
  /** The page's filters plus focus and steps, which every network has. */
  protected get allFields(): FilterField[] {
    return [...this.fields, ...FOCUS_FIELDS];
  }
  /** What kinds of record the nodes are, for the "Focus on" search. */
  abstract readonly focusKinds: ('institution' | 'person')[];
  readonly hopOptions = [
    { value: '1', label: '1 step' },
    { value: '2', label: '2 steps' },
    { value: 'all', label: 'Whole group' },
  ];
  /** The largest connected groups of the whole (filtered) network. */
  groups: NetworkGroup[] = [];
  focusInfo: NetworkFocus | null = null;
  /** The name picked in the search, until the server answers with its own. */
  private pickedLabel = '';
  /** Filters shown only after "More filters" (on wide screens). */
  protected abstract readonly moreKeys: string[];
  /** What a node is, singular and plural, for the panel note. */
  protected readonly nodeNouns: [string, string] = ['node', 'nodes'];
  /** Extra API params, e.g. a node limit. */
  protected readonly extraParams: Record<string, string> = {};

  dioceseOptions: string[] = [];
  typeOptions: string[] = [];
  functionOptions: string[] = [];
  orderOptions: string[] = [];

  state!: T;
  /** Text fields as typed (the URL catches up after a pause). */
  draft: Record<string, string> = {};
  moreOpen = false;

  /** The three networks share one page (/dashboards/networks?view=…). */
  readonly networkViews = [
    { value: 'institutions', label: 'Institutions' },
    { value: 'people', label: 'People' },
    { value: 'service', label: 'Both' },
  ];

  get networkView(): string {
    return this.route.snapshot.queryParamMap.get('view') || 'institutions';
  }

  /** Each network has its own filters, so switching starts from a clean slate. */
  switchNetwork(view: string): void {
    this.router.navigate(['/dashboards/networks'], { queryParams: { view: view === 'institutions' ? null : view } });
  }
  /** The colour key starts collapsed on phones, where it would push the graph off screen. */
  keyOpen = !window.matchMedia('(max-width: 760px)').matches;
  vizState: VizState = 'loading';
  chips: ControlChip[] = [];
  network: { nodes: any[]; edges: any[] } = { nodes: [], edges: [] };
  networkOptions: any = {};
  key: KeyEntry[] = [];
  panelNote = '';
  takeaway = '';
  truncated = false;
  totalNodes = 0;
  moreCount = 0;

  protected api = inject(ApiService);
  protected http = inject(HttpClient);
  protected url!: UrlState<T>;
  private subs: Subscription[] = [];
  private fetchSub?: Subscription;
  private textTimer?: ReturnType<typeof setTimeout>;
  protected router = inject(Router);
  protected route = inject(ActivatedRoute);

  ngOnInit(): void {
    this.url = new UrlState(this.router, this.route, this.defaults);
    this.state = { ...this.defaults };
    this.subs.push(loadOptions(this.http, 'diocese.csv').subscribe(o => this.dioceseOptions = o));
    this.subs.push(loadOptions(this.http, 'types.csv').subscribe(o => this.typeOptions = o));
    this.subs.push(loadOptions(this.http, 'functions.csv').subscribe(o => this.functionOptions = o));
    this.subs.push(loadOptions(this.http, 'order.csv').subscribe(o => this.orderOptions = o));
    let last: string | null = null;
    this.subs.push(this.url.changes().subscribe(state => {
      this.state = state;
      for (const f of this.allFields) if (f.text) this.draft[f.key] = String(state[f.key] ?? '');
      this.chips = this.buildChips(state);
      this.moreCount = this.moreKeys.filter(k => this.isSet(k)).length;
      if (this.moreCount) this.moreOpen = true;
      const query = this.query(state);
      if (query !== last) {
        last = query;
        this.fetchData();
      }
    }));
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    this.fetchSub?.unsubscribe();
    clearTimeout(this.textTimer);
  }

  // ---- controls -------------------------------------------------------------

  set(key: string, value: string | number): void {
    this.url.set({ [key]: value } as Partial<T>);
  }

  /** Text fields update the URL (and the graph) after a 400 ms pause. */
  setText(key: string, value: string): void {
    this.draft[key] = value;
    clearTimeout(this.textTimer);
    this.textTimer = setTimeout(() => this.set(key, value.trim()), 400);
  }

  setYears(range: YearRange): void {
    const all = range.from === this.minYear && range.to === this.maxYear;
    this.url.set({ from: all ? 0 : range.from, to: all ? 0 : range.to } as Partial<T>);
  }

  clearAll = (): void => {
    const cleared: Record<string, string | number> = { from: 0, to: 0 };
    for (const f of this.allFields) if (!f.isSwitch) cleared[f.key] = this.clearedValue(f.key);
    this.url.set(cleared as Partial<T>);
  };

  /** The value that means "no filter" (a page may default a filter to something else). */
  protected clearedValue(key: string): string {
    return key === 'hops' ? '1' : '';
  }

  // ---- focus ----------------------------------------------------------------

  setFocus(pick: FocusPick): void {
    this.pickedLabel = pick.label;
    this.url.set({ focus: pick.id } as unknown as Partial<T>);
  }

  /** "Show this group": its most central member, every step out. */
  showGroup(group: NetworkGroup): void {
    this.pickedLabel = group.label;
    this.url.set({ focus: group.id, hops: 'all' } as unknown as Partial<T>);
  }

  get focusLabel(): string {
    return this.focusInfo?.found && this.focusInfo.id === this.state.focus ? this.focusInfo.label ?? this.state.focus : this.pickedLabel || String(this.state.focus);
  }

  /** "the Diocese of Galveston, Texas" etc. for a group's dioceses. */
  groupDioceses(group: NetworkGroup): string {
    const d = group.dioceses.map(x => spaceName(x));
    return d.length <= 2 ? d.join(' and ') : `${d.slice(0, 2).join(', ')} and ${d.length - 2} more`;
  }

  protected isSet(key: string): boolean {
    const v = this.state[key];
    return !!v && v !== this.clearedValue(key);
  }

  get yearLabel(): string {
    return this.state.from || this.state.to ? `${this.state.from || this.minYear}–${this.state.to || this.maxYear}` : `${this.minYear}–${this.maxYear}`;
  }

  private buildChips(state: T): ControlChip[] {
    const chips: ControlChip[] = [];
    for (const f of this.allFields) {
      if (f.isSwitch || !this.isSet(f.key)) continue;
      const v = String(state[f.key]);
      const shown = f.key === 'state' ? stateName(v) : f.key === 'diocese' ? spaceName(v) : f.key === 'focus' ? this.focusLabel : v;
      chips.push({ label: `${f.label}: ${shown}`, clear: () => this.set(f.key, this.clearedValue(f.key)) });
    }
    if (state.from || state.to) {
      chips.push({ label: `Years: ${this.yearLabel}`, clear: () => this.url.set({ from: 0, to: 0 } as Partial<T>) });
    }
    return chips;
  }

  /** "in the Diocese of Boston, Massachusetts, 1864–1870" for headings. */
  get scopeLabel(): string {
    const parts: string[] = [];
    if (this.state.focus) parts.push(`around ${this.focusLabel}`);
    if (this.isSet('diocese')) parts.push(`in the Diocese of ${spaceName(String(this.state['diocese']))}`);
    if (this.isSet('state')) parts.push(`in ${stateName(String(this.state['state']))}`);
    if (!parts.length) parts.push('across all dioceses');
    return `${parts.join(', ')}, ${this.yearLabel}`;
  }

  setKeyHidden(entry: KeyEntry): void {
    entry.hidden = !entry.hidden;
    this.graph?.setGroupHidden(entry.group, entry.hidden);
  }

  // ---- data -----------------------------------------------------------------

  private query(state: T): string {
    const q = new URLSearchParams();
    for (const f of this.allFields) if (!f.local && this.isSet(f.key)) q.set(f.param, String(state[f.key]));
    if (state.from) q.set('startYear', String(state.from));
    if (state.to) q.set('endYear', String(state.to));
    for (const [k, v] of Object.entries(this.extraParams)) q.set(k, v);
    return q.toString();
  }

  fetchData(): void {
    this.vizState = 'loading';
    const q = this.query(this.state);
    this.fetchSub?.unsubscribe();
    this.fetchSub = this.api.getTypeRequest(this.endpoint + (q ? '?' + q : '')).subscribe({
      next: (res: any) => {
        const nodes = (res.nodes ?? []).map((n: any) => this.prepareNode(n));
        this.network = { nodes, edges: res.edges ?? [] };
        this.truncated = !!res.truncated;
        this.totalNodes = res.totalNodes ?? nodes.length;
        this.groups = (res.groups ?? []).map((g: NetworkGroup) => isUnnamed(g.label) ? { ...g, label: institutionLabel(g.label) } : g);
        this.focusInfo = res.focus ?? null;
        this.chips = this.buildChips(this.state);   // the focus chip now has its name
        this.networkOptions = this.buildOptions(nodes);
        this.panelNote = this.buildNote();
        this.takeaway = !nodes.length ? ''
          : this.focusInfo?.found ? this.focusTakeaway(nodes)
          : this.computeTakeaway(nodes, this.network.edges);
        this.vizState = nodes.length ? 'ready' : 'empty';
      },
      error: () => {
        this.network = { nodes: [], edges: [] };
        this.takeaway = '';
        this.vizState = 'error';
      },
    });
  }

  /** While focused: who is linked directly, and further out. */
  private focusTakeaway(nodes: any[]): string {
    const near = nodes.filter(n => n.distance === 1).length;
    const far = nodes.filter(n => n.distance >= 2).length;
    const noun = (k: number) => this.nodeNouns[k === 1 ? 0 : 1];
    const whole = this.state.hops === 'all';
    return `${this.focusLabel} is linked directly to ${near.toLocaleString()} ${noun(near)} in this view`
      + (far ? (whole ? `, and through them to ${far.toLocaleString()} more: a connected group of ${(nodes.length).toLocaleString()}.` : `, and to ${far.toLocaleString()} more two steps away.`) : '.');
  }

  /** Readable labels: unnamed institutions become "Unnamed church" etc. */
  protected prepareNode(n: any): any {
    // the focus node: a rubric ring and a larger, bold name (vis draws on a canvas, so no CSS variables)
    if (n.isTarget) n = { ...n, borderWidth: 5, color: { border: HIGHLIGHT_INK }, font: { size: 20, bold: true } };
    if (n.routeSegment === 'institutions' && isUnnamed(n.label)) return { ...n, label: institutionLabel(n.label), unnamed: true };
    if (!n.label) return { ...n, label: n.id };
    return n;
  }

  /** Colour nodes by diocese; the key lists dioceses by node count. */
  protected buildOptions(nodes: any[]): any {
    const counts = new Map<string, number>();
    for (const n of nodes) counts.set(n.group || 'Unknown', (counts.get(n.group || 'Unknown') ?? 0) + 1);
    const ordered = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const groups: any = {};
    this.key = ordered.map(([group, count], i) => {
      const color = group === 'Unknown' ? OTHER_INK : PALETTE[i % PALETTE.length];
      groups[group] = { color: { background: color, border: color }, borderWidth: 1, shape: 'dot' };
      return { group, label: group === 'Unknown' ? 'Diocese not recorded' : spaceName(group), color, count, hidden: false };
    });
    return { groups };
  }

  protected buildNote(): string {
    const shown = this.network.nodes.length.toLocaleString();
    if (this.focusInfo?.found) {
      return this.truncated ? `${shown} nearest of ${this.totalNodes.toLocaleString()} reached` : `${shown} ${this.nodeNouns[this.network.nodes.length === 1 ? 0 : 1]}`;
    }
    return this.truncated
      ? `${shown} most connected of ${this.totalNodes.toLocaleString()}`
      : `${shown} ${this.nodeNouns[this.network.nodes.length === 1 ? 0 : 1]}`;
  }

  /** Degree (distinct neighbours) of every node in the current view. */
  protected degrees(edges: any[]): Map<string, number> {
    const neighbours = new Map<string, Set<string>>();
    for (const e of edges) {
      if (!neighbours.has(e.from)) neighbours.set(e.from, new Set());
      if (!neighbours.has(e.to)) neighbours.set(e.to, new Set());
      neighbours.get(e.from)!.add(e.to);
      neighbours.get(e.to)!.add(e.from);
    }
    return new Map([...neighbours.entries()].map(([id, s]) => [id, s.size]));
  }

  /** The node with most neighbours among `nodes`, with its degree. */
  protected top(nodes: any[], degree: Map<string, number>): { node: any; degree: number } | null {
    let best: { node: any; degree: number } | null = null;
    for (const node of nodes) {
      const d = degree.get(node.id) ?? 0;
      // Ties go to a named node: "St. Mary's" says more than "Unnamed church".
      if (!best || d > best.degree || (d === best.degree && best.node.unnamed && !node.unnamed)) best = { node, degree: d };
    }
    return best && best.degree > 0 ? best : null;
  }

  protected abstract computeTakeaway(nodes: any[], edges: any[]): string;

  // ---- export -----------------------------------------------------------------

  /** What a link means on this page, for the downloaded file's description. */
  protected abstract tieDescription(): string;
  /** File name stem, e.g. 'institution-network'. */
  protected abstract readonly exportName: string;

  /** The graph as drawn (after the server's cut to the most central nodes), with its filters and a citation. */
  private exportGraph(): ExportGraph {
    const kind = (n: any) => n.routeSegment === 'people' ? 'person' : n.routeSegment === 'institutions' ? 'institution' : 'node';
    const cut = this.truncated ? ` Only the ${this.network.nodes.length} most central of ${this.totalNodes} matching nodes (by PageRank) are included.` : '';
    return {
      directed: this.network.edges.some(e => e.arrows),
      description: `${this.tieDescription()} Years: ${this.yearLabel}. Filters: ${this.chips.filter(c => !c.label.startsWith('Years')).map(c => c.label).join('; ') || 'none'}.${cut} ${citation()}`,
      nodes: this.network.nodes.map(n => ({
        id: n.id, label: n.label, kind: kind(n),
        diocese: n.diocese ?? (['people', 'institutions'].includes(n.group) ? undefined : n.group),
        pageRank: typeof n.pageRank === 'number' ? Number(n.pageRank.toFixed(6)) : undefined,
      })),
      edges: this.network.edges.map(e => ({ source: e.from, target: e.to, weight: Number(e.weight) || 1 })),
    };
  }

  downloadCsv(): void { downloadCsv(this.exportName, this.exportGraph()); }
  downloadGexf(): void { downloadGexf(this.exportName, this.exportGraph()); }
}
