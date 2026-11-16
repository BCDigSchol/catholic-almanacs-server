import { Component } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';

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
import { institutionLabel } from '../../../utils/record-labels';

const DEFAULTS = { tie: 'under', colour: 'diocese', through: 0, diocese: '', from: 0, to: 0, focus: '', hops: '1' };

/** What counts as serving under someone (GET person/lineage?tie=). */
const TIES = [
  { value: 'under', label: 'All under a head' },
  { value: 'assistant', label: 'Assistants only' },
];

/** One step of a line: a person, when and where they served under (or over) the one before. */
export interface LineNode {
  id: string;
  label: string;
  years: string;
  place: { inst: string; name: string } | null;
  morePlaces: number;
  children: LineNode[];
}
interface Line { id: string; label: string; diocese: string; under: number; line: number; }

/**
 * Served Under: who served under whom, from the roles the almanac printed. A
 * directed network (junior to the head they were listed under) and, around
 * one person, their line as a tree: those they served under above, those who
 * served under them below.
 */
@Component({
  selector: 'app-lineage-network',
  imports: [NgTemplateOutlet, RouterLink, YearPlayerComponent, NetworkCommunitiesComponent, NetworkMixingComponent, NetworkFocusComponent, SegmentedComponent, SpaceNamePipe,
    DashboardShellComponent, ControlBarComponent, VizPanelComponent, YearRangeComponent, NetworkGraphComponent],
  templateUrl: './lineage-network.component.html',
  styleUrl: './lineage-network.component.scss'
})
export class LineageNetworkComponent extends NetworkDashboard<typeof DEFAULTS> {
  readonly related: RelatedDashboard[] = [
    { label: 'Clergy Flows', link: '/dashboards/clergy-flows' },
    { label: 'The Shape of the Clergy', link: '/dashboards/composition', queryParams: { entity: 'people', group: 'rank' } },
  ];
  protected readonly defaults = DEFAULTS;
  protected override readonly colourable = true;
  protected override readonly nodeNouns: [string, string] = ['person', 'people'];
  readonly focusKinds: ('institution' | 'person')[] = ['person'];
  protected readonly endpoint = 'person/lineage';
  protected readonly exportName = 'served-under-network';
  readonly ties = TIES;
  protected readonly fields: FilterField[] = [
    { key: 'tie', param: 'tie', label: 'Ties', isSwitch: true },
    { key: 'colour', param: 'colour', label: 'Colour by', isSwitch: true, local: true },
    { key: 'through', param: 'through', label: 'Through', isSwitch: true, local: true },
    { key: 'diocese', param: 'diocese', label: 'Diocese' },
  ];
  protected readonly moreKeys: string[] = [];

  /** Whose line runs longest, and the longest chains (junior first). */
  lines: Line[] = [];
  chains: { id: string; label: string }[][] = [];
  totals: { ties: number; people: number; both: number } | null = null;
  /** Around the focused person: those above and below, nested. */
  tree: { up: LineNode[]; down: LineNode[] } | null = null;

  protected tieDescription(): string {
    return this.state.tie === 'assistant'
      ? 'People linked to the head they were listed under as an assistant (directed: source = the assistant, target = the head; weight = years).'
      : 'People linked to the one named head of an institution where they were resident in the same year (directed: source = the junior, target = the head; weight = years).';
  }

  protected override clearedValue(key: string): string {
    return key === 'tie' ? 'under' : super.clearedValue(key);
  }

  protected override onResponse(res: any): void {
    this.lines = res.lines ?? [];
    // senior first reads as a line of descent
    this.chains = (res.chains ?? []).map((c: any[]) => [...c].reverse());
    this.totals = res.totals ?? null;
    this.tree = res.tree ?? null;
  }

  place(p: LineNode['place']): string { return p ? institutionLabel(p.name) : ''; }
  dioceseName(d: string): string { return d && d !== 'Unknown' ? spaceName(d) : ''; }

  protected computeTakeaway(): string {
    const t = this.totals;
    if (!t) return '';
    const top = this.lines[0];
    return `${t.ties.toLocaleString()} ties join ${t.people.toLocaleString()} people, each to a head they served under; ${t.both.toLocaleString()} of them served under someone and later headed a place where others served under them.`
      + (top ? ` ${top.label} has the longest line: ${top.under} served directly under them, ${top.line} in all down the line.` : '');
  }
}
