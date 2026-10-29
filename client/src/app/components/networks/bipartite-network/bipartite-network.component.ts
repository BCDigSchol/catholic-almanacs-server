import { Component } from '@angular/core';

import { SpaceNamePipe, spaceName } from '../../../pipes/space-name.pipe';
import { DashboardShellComponent } from '../../common/dashboard-shell/dashboard-shell.component';
import { ControlBarComponent } from '../../common/control-bar/control-bar.component';
import { VizPanelComponent } from '../../common/viz-panel/viz-panel.component';
import { YearRangeComponent } from '../../common/year-range/year-range.component';
import { NetworkGraphComponent } from '../../common/network-graph/network-graph.component';
import { FilterField, NetworkDashboard } from '../../common/network-graph/network-dashboard';

/** Opens on one diocese: the whole church is ~10,700 people and institutions,
 *  too many to draw, and its top-N slice is mostly disconnected fragments. */
const DEFAULT_DIOCESE = 'Baltimore';
const ALL = 'all';
const DEFAULTS = { diocese: DEFAULT_DIOCESE, state: '', type: '', order: '', role: '', title: '', city: '', from: 0, to: 0 };

/** People Serving Institutions: a two-mode graph of people and the institutions they served. */
@Component({
  selector: 'app-bipartite-network',
  imports: [SpaceNamePipe, DashboardShellComponent, ControlBarComponent, VizPanelComponent, YearRangeComponent, NetworkGraphComponent],
  templateUrl: './bipartite-network.component.html',
  styleUrl: './bipartite-network.component.scss'
})
export class BipartiteNetworkComponent extends NetworkDashboard<typeof DEFAULTS> {
  readonly all = ALL;
  readonly related = [
    { label: 'The Institution Network', link: '/dashboards/network-institutions' },
    { label: 'The People Network', link: '/dashboards/network-people' },
    { label: 'Explore People on the Map', link: '/dashboards/explore-people' },
  ];
  protected readonly defaults = DEFAULTS;
  protected readonly endpoint = 'institution/network/bipartite';
  // A whole diocese is ~500–650 nodes; ask for enough to draw it complete.
  protected override readonly extraParams = { limit: '1000' };
  protected readonly fields: FilterField[] = [
    { key: 'diocese', param: 'diocese', label: 'Diocese' },
    { key: 'state', param: 'state', label: 'State' },
    { key: 'type', param: 'instType', label: 'Type' },
    { key: 'role', param: 'role', label: 'Role', text: true },
    { key: 'title', param: 'title', label: 'Title', text: true },
    { key: 'order', param: 'order', label: 'Order' },
    { key: 'city', param: 'city', label: 'City', text: true },
  ];
  protected readonly moreKeys = ['role', 'title', 'order', 'city'];

  protected override clearedValue(key: string): string {
    return key === 'diocese' ? ALL : '';
  }

  /** Two kinds of node, coloured with the site's institution and person colours. */
  protected override buildOptions(nodes: any[]): any {
    const count = (g: string) => nodes.filter(n => n.group === g).length;
    this.key = [
      { group: 'people', label: 'People', color: 'var(--c-pers)', count: count('people'), hidden: false },
      { group: 'institutions', label: 'Institutions', color: 'var(--c-inst)', count: count('institutions'), hidden: false },
    ];
    return {};
  }

  protected override buildNote(): string {
    const people = this.key[0]?.count ?? 0, insts = this.key[1]?.count ?? 0;
    const shown = `${people.toLocaleString()} people · ${insts.toLocaleString()} institutions`;
    return this.truncated ? `${shown} (most connected of ${this.totalNodes.toLocaleString()})` : shown;
  }

  protected computeTakeaway(nodes: any[], edges: any[]): string {
    const degree = this.degrees(edges);
    const person = this.top(nodes.filter(n => n.group === 'people'), degree);
    const inst = this.top(nodes.filter(n => n.group === 'institutions'), degree);
    if (!person || !inst) return '';
    const where = inst.node.diocese && inst.node.diocese !== 'Unknown' && !this.isSet('diocese') ? ` (Diocese of ${spaceName(inst.node.diocese)})` : '';
    return `${person.node.label} served at the most institutions in this view (${person.degree}); ${inst.node.label}${where} had the most people listed (${inst.degree}).`;
  }
}
