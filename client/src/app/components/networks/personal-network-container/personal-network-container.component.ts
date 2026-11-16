import { Component } from '@angular/core';

import { SpaceNamePipe, spaceName } from '../../../pipes/space-name.pipe';
import { DashboardShellComponent, RelatedDashboard } from '../../common/dashboard-shell/dashboard-shell.component';
import { SegmentedComponent } from '../../common/segmented/segmented.component';
import { ControlBarComponent } from '../../common/control-bar/control-bar.component';
import { VizPanelComponent } from '../../common/viz-panel/viz-panel.component';
import { YearRangeComponent } from '../../common/year-range/year-range.component';
import { NetworkGraphComponent } from '../../common/network-graph/network-graph.component';
import { FilterField, NetworkDashboard } from '../../common/network-graph/network-dashboard';
import { NetworkMixingComponent } from '../../common/network-mixing/network-mixing.component';
import { NetworkCommunitiesComponent } from '../../common/network-communities/network-communities.component';
import { YearPlayerComponent } from '../../common/year-player/year-player.component';
import { NetworkFocusComponent } from '../../common/network-focus/network-focus.component';

const DEFAULTS = { colour: 'diocese', through: 0, diocese: '', state: '', role: '', title: '', order: '', city: '', from: 0, to: 0, focus: '', hops: '1' };

/** The People Network: people linked when they served at the same institution. */
@Component({
  selector: 'app-personal-network-container',
  imports: [YearPlayerComponent, NetworkCommunitiesComponent, NetworkMixingComponent, NetworkFocusComponent, SegmentedComponent, SpaceNamePipe, DashboardShellComponent, ControlBarComponent, VizPanelComponent, YearRangeComponent, NetworkGraphComponent],
  templateUrl: './personal-network-container.component.html',
  styleUrl: './personal-network-container.component.scss'
})
export class PersonalNetworkContainerComponent extends NetworkDashboard<typeof DEFAULTS> {
  readonly related: RelatedDashboard[] = [
    { label: 'The Shape of the Clergy', link: '/dashboards/composition', queryParams: { entity: 'people', group: 'rank' } },
    { label: 'Explore People on the Map', link: '/dashboards/explore', queryParams: { entity: 'people' } },
  ];
  protected readonly defaults = DEFAULTS;
  protected override readonly colourable = true;
  protected override readonly nodeNouns: [string, string] = ['person', 'people'];
  readonly focusKinds: ('institution' | 'person')[] = ['person'];
  protected readonly endpoint = 'person/network';
  protected readonly exportName = 'people-network';

  protected tieDescription(): string {
    return 'People linked when listed at the same institution in the same almanac year (weight = institutions shared).';
  }
  protected readonly fields: FilterField[] = [
    { key: 'colour', param: 'colour', label: 'Colour by', isSwitch: true, local: true },
    { key: 'through', param: 'through', label: 'Through', isSwitch: true, local: true },
    { key: 'diocese', param: 'diocese', label: 'Diocese' },
    { key: 'state', param: 'state', label: 'State' },
    { key: 'role', param: 'role', label: 'Role', text: true },
    { key: 'title', param: 'title', label: 'Title', text: true },
    { key: 'order', param: 'order', label: 'Order' },
    { key: 'city', param: 'city', label: 'City', text: true },
  ];
  protected readonly moreKeys = ['title', 'order', 'city'];

  protected computeTakeaway(nodes: any[], edges: any[]): string {
    const best = this.top(nodes, this.degrees(edges));
    if (!best) return '';
    const where = best.node.diocese && best.node.diocese !== 'Unknown' ? ` (Diocese of ${spaceName(best.node.diocese)})` : '';
    return `${best.node.label}${where} is the best-connected person in this view: they served alongside ${best.degree.toLocaleString()} other ${best.degree === 1 ? 'person' : 'people'} shown here.`;
  }
}
