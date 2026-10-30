import { Component } from '@angular/core';

import { SpaceNamePipe, spaceName } from '../../../pipes/space-name.pipe';
import { DashboardShellComponent, RelatedDashboard } from '../../common/dashboard-shell/dashboard-shell.component';
import { SegmentedComponent } from '../../common/segmented/segmented.component';
import { ControlBarComponent } from '../../common/control-bar/control-bar.component';
import { VizPanelComponent } from '../../common/viz-panel/viz-panel.component';
import { YearRangeComponent } from '../../common/year-range/year-range.component';
import { NetworkGraphComponent } from '../../common/network-graph/network-graph.component';
import { FilterField, NetworkDashboard } from '../../common/network-graph/network-dashboard';
import { MapVisComponent } from '../../common/map-vis/map-vis.component';
import { MapLink } from '../../common/map-vis/map-overlays';
import { INKS } from '../../../utils/palette';
import { Settings } from '../../../app.settings';
import { NetworkFocusComponent } from '../../common/network-focus/network-focus.component';

const DEFAULTS = { tie: 'together', layout: 'graph', diocese: '', state: '', type: '', function: '', order: '', language: '', city: '', from: 0, to: 0, focus: '', hops: '1' };

/** Draw the network as a graph, or on the map at the institutions' places. */
const LAYOUTS = [
  { value: 'graph', label: 'Graph' },
  { value: 'map', label: 'Map' },
];

/** What links two institutions (GET institution/network?tie=). */
const TIES = [
  { value: 'together', label: 'Served together' },
  { value: 'moved', label: 'Moved between' },
];

/** The Institution Network: institutions linked by the people who served at both, in one year or in turn. */
@Component({
  selector: 'app-institutional-network-container',
  imports: [NetworkFocusComponent, MapVisComponent, SegmentedComponent, SpaceNamePipe, DashboardShellComponent, ControlBarComponent, VizPanelComponent, YearRangeComponent, NetworkGraphComponent],
  templateUrl: './institutional-network-container.component.html',
  styleUrl: './institutional-network-container.component.scss'
})
export class InstitutionalNetworkContainerComponent extends NetworkDashboard<typeof DEFAULTS> {
  readonly related: RelatedDashboard[] = [
    { label: 'Explore Institutions on the Map', link: '/dashboards/explore' },
  ];
  protected readonly defaults = DEFAULTS;
  readonly focusKinds: ('institution' | 'person')[] = ['institution'];
  readonly ties = TIES;
  readonly layouts = LAYOUTS;
  /** The map layout: institutions as points coloured like the graph, ties as arcs between them. */
  mapData: any[] = [];
  mapLinks: MapLink[] = [];
  readonly mapOptions = {
    mode: 'point' as const,
    zoom: window.innerWidth < 640 ? 2 : 3.4,
    center: { lat: 39, lng: window.innerWidth < 640 ? -96 : -88 },
    size: { width: '100%', height: 'clamp(320px, 62vh, 620px)' },
  };
  /** Institutions in the view with no recorded place (not on the map). */
  unplaced = 0;
  /** Frame the focused neighbourhood, else the country. */
  mapFit: [number, number, number, number] | null = null;
  protected override readonly nodeNouns: [string, string] = ['institution', 'institutions'];
  protected readonly endpoint = 'institution/network';
  protected readonly fields: FilterField[] = [
    { key: 'tie', param: 'tie', label: 'Ties', isSwitch: true },
    { key: 'layout', param: 'layout', label: 'Show as', isSwitch: true, local: true },
    { key: 'diocese', param: 'diocese', label: 'Diocese' },
    { key: 'state', param: 'state', label: 'State' },
    { key: 'type', param: 'instType', label: 'Type' },
    { key: 'function', param: 'instFunction', label: 'Function' },
    { key: 'order', param: 'order', label: 'Order' },
    { key: 'language', param: 'language', label: 'Language', text: true },
    { key: 'city', param: 'city', label: 'City', text: true },
  ];
  protected readonly moreKeys = ['order', 'language', 'city'];

  protected readonly exportName = 'institution-network';

  protected tieDescription(): string {
    return this.moved
      ? 'Institutions linked by clergy who left one for the other (directed: source = the post left, target = the post taken; weight = people), counted in the year they arrived.'
      : 'Institutions linked by people listed at both in the same almanac year (weight = people shared).';
  }

  protected override clearedValue(key: string): string {
    return key === 'tie' ? 'together' : key === 'layout' ? 'graph' : super.clearedValue(key);
  }

  get moved(): boolean {
    return this.state.tie === 'moved';
  }

  /** The graph's diocese colours, then the same nodes and ties laid out on the map. */
  protected override buildOptions(nodes: any[]): any {
    const options = super.buildOptions(nodes);
    const colour = (n: any) => options.groups?.[n.group || 'Unknown']?.color?.background ?? INKS[0];
    const byId = new Map(nodes.map(n => [n.id, n]));
    const placed = (n: any) => n && Number.isFinite(n.lat) && Number.isFinite(n.lng) && n.lat !== 0;
    const maxRank = Math.max(...nodes.map(n => n.pageRank || 0), 1e-9);
    this.unplaced = nodes.filter(n => !placed(n)).length;
    this.mapData = nodes.filter(placed).map(n => ({
      id: n.id, label: n.label,
      latitude: n.lat, longitude: n.lng,
      title: n.label + (n.diocese && n.diocese !== 'Unknown' ? ` · Diocese of ${spaceName(n.diocese)}` : ''),
      options: { color: colour(n), radius: n.isTarget ? 10 : 3.5 + 6 * Math.sqrt((n.pageRank || 0) / maxRank) },
    }));
    const pts = this.mapData.map(d => [d.longitude, d.latitude]);
    const [[w, s], [e, n]] = Settings.mapBounds;
    this.mapFit = this.state.focus && pts.length
      ? [Math.min(...pts.map(p => p[0])), Math.min(...pts.map(p => p[1])), Math.max(...pts.map(p => p[0])), Math.max(...pts.map(p => p[1]))]
      : [w, s, e, n];
    const maxW = Math.max(1, ...this.network.edges.map(e => Number(e.weight) || 1));
    this.mapLinks = this.network.edges
      .filter(e => placed(byId.get(e.from)) && placed(byId.get(e.to)))
      .map(e => {
        const [a, b] = [byId.get(e.from), byId.get(e.to)];
        const w = Number(e.weight) || 1;
        return {
          from: [a.lng, a.lat] as [number, number], to: [b.lng, b.lat] as [number, number],
          color: INKS[5], width: 0.7 + 3 * Math.sqrt(w / maxW),
          title: this.moved
            ? `${a.label} → ${b.label}: ${w} ${w === 1 ? 'person' : 'people'} moved`
            : `${a.label} — ${b.label}: ${w} ${w === 1 ? 'person' : 'people'} shared`,
        };
      });
    return options;
  }

  /** On the map, a click on an institution centres the network on it. */
  onMapSelect(item: any): void {
    if (item?.id) this.setFocus({ id: item.id, label: item.label });
  }

  protected computeTakeaway(nodes: any[], edges: any[]): string {
    if (this.moved) return this.movedTakeaway(nodes, edges);
    const best = this.top(nodes, this.degrees(edges));
    if (!best) return '';
    const where = best.node.diocese && best.node.diocese !== 'Unknown' ? ` (Diocese of ${spaceName(best.node.diocese)})` : '';
    const name = best.node.unnamed ? `An unnamed institution` : best.node.label;
    return `${name}${where} is the best-connected institution in this view: it shared clergy or staff with ${best.degree.toLocaleString()} other institution${best.degree === 1 ? '' : 's'}.`;
  }

  /** The busiest path between two institutions, and where most people came to. */
  private movedTakeaway(nodes: any[], edges: any[]): string {
    const byId = new Map(nodes.map(n => [n.id, n]));
    const name = (id: string) => {
      const n = byId.get(id);
      return !n ? id : n.unnamed ? `an unnamed ${n.label.replace(/^Unnamed /, '')}` : n.label;
    };
    const busiest = edges.reduce((best: any, e: any) => !best || e.weight > best.weight ? e : best, null);
    const arrivals = new Map<string, number>();
    for (const e of edges) arrivals.set(e.to, (arrivals.get(e.to) ?? 0) + (Number(e.weight) || 1));
    const [hub, came] = [...arrivals.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
    if (!busiest) return '';
    const path = `The busiest path in this view: ${busiest.weight} ${busiest.weight === 1 ? 'person' : 'people'} moved from ${name(busiest.from)} to ${name(busiest.to)}.`;
    return hub && came > busiest.weight ? `${path} ${name(hub)} drew the most, ${came} arrivals from the institutions shown.` : path;
  }
}
