import { Component } from '@angular/core';

import { SpaceNamePipe, spaceName } from '../../../pipes/space-name.pipe';
import { DashboardShellComponent } from '../../common/dashboard-shell/dashboard-shell.component';
import { ControlBarComponent } from '../../common/control-bar/control-bar.component';
import { VizPanelComponent } from '../../common/viz-panel/viz-panel.component';
import { YearRangeComponent } from '../../common/year-range/year-range.component';
import { NetworkGraphComponent } from '../../common/network-graph/network-graph.component';
import { FilterField, NetworkDashboard } from '../../common/network-graph/network-dashboard';

const DEFAULTS = { diocese: '', state: '', type: '', function: '', order: '', language: '', city: '', from: 0, to: 0 };

/** The Institution Network: institutions linked when the same person served at both. */
@Component({
  selector: 'app-institutional-network-container',
  imports: [SpaceNamePipe, DashboardShellComponent, ControlBarComponent, VizPanelComponent, YearRangeComponent, NetworkGraphComponent],
  templateUrl: './institutional-network-container.component.html',
  styleUrl: './institutional-network-container.component.scss'
})
export class InstitutionalNetworkContainerComponent extends NetworkDashboard<typeof DEFAULTS> {
  readonly related = [
    { label: 'The People Network', link: '/dashboards/network-people' },
    { label: 'People Serving Institutions', link: '/dashboards/network-service' },
    { label: 'Explore Institutions on the Map', link: '/dashboards/explore-institutions' },
  ];
  protected readonly defaults = DEFAULTS;
  protected override readonly nodeNouns: [string, string] = ['institution', 'institutions'];
  protected readonly endpoint = 'institution/network';
  protected readonly fields: FilterField[] = [
    { key: 'diocese', param: 'diocese', label: 'Diocese' },
    { key: 'state', param: 'state', label: 'State' },
    { key: 'type', param: 'instType', label: 'Type' },
    { key: 'function', param: 'instFunction', label: 'Function' },
    { key: 'order', param: 'order', label: 'Order' },
    { key: 'language', param: 'language', label: 'Language', text: true },
    { key: 'city', param: 'city', label: 'City', text: true },
  ];
  protected readonly moreKeys = ['order', 'language', 'city'];

  protected computeTakeaway(nodes: any[], edges: any[]): string {
    const best = this.top(nodes, this.degrees(edges));
    if (!best) return '';
    const where = best.node.diocese && best.node.diocese !== 'Unknown' ? ` (Diocese of ${spaceName(best.node.diocese)})` : '';
    const name = best.node.unnamed ? `An unnamed institution` : best.node.label;
    return `${name}${where} is the best-connected institution in this view: it shared clergy or staff with ${best.degree.toLocaleString()} other institution${best.degree === 1 ? '' : 's'}.`;
  }
}
