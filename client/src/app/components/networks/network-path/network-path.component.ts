import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import { ApiService } from '../../../services/api.service';
import { DashboardShellComponent, RelatedDashboard } from '../../common/dashboard-shell/dashboard-shell.component';
import { ControlBarComponent, ControlChip } from '../../common/control-bar/control-bar.component';
import { SegmentedComponent } from '../../common/segmented/segmented.component';
import { VizPanelComponent, VizState } from '../../common/viz-panel/viz-panel.component';
import { NetworkFocusComponent, FocusPick } from '../../common/network-focus/network-focus.component';
import { NETWORK_VIEWS } from '../../common/network-graph/network-dashboard';
import { UrlState } from '../../../utils/url-state';
import { institutionLabel } from '../../../utils/record-labels';

/** GET /api/stats/path */
interface PathStep {
  kind: 'person' | 'institution';
  id: string;
  name: string;
  title?: string;
  suffix?: string;
  type?: string;
  place?: string;
}
interface PathResponse {
  found: boolean;
  from: PathStep | null;
  to: PathStep | null;
  steps: PathStep[];
  links: { years: number[] }[];
  maxPeople: number;
}

/** A step as shown: its label and record link, and the years joining it to the next. */
interface ChainItem {
  kind: 'pers' | 'inst';
  label: string;
  place: string;
  link: any[];
  years: string;
  together: boolean;
}

// ?view=path is left alone: UrlState only touches these keys
const DEFAULTS = { from: '', to: '' };
/** A pair that shows what the page does before anything is picked. */
const EXAMPLE = { from: 'bos.ma.0001', to: 'alb.ny.0001' };

/**
 * "How are these two connected?": the shortest chain of people linking two
 * records, each step two people listed at the same institution in the same
 * year. A view of /dashboards/networks (?view=path&from=&to=).
 */
@Component({
  selector: 'app-network-path',
  imports: [RouterLink, DashboardShellComponent, ControlBarComponent, SegmentedComponent, VizPanelComponent, NetworkFocusComponent],
  templateUrl: './network-path.component.html',
  styleUrl: './network-path.component.scss'
})
export class NetworkPathComponent implements OnInit, OnDestroy {
  readonly related: RelatedDashboard[] = [
    { label: 'Clergy Flows', link: '/dashboards/clergy-flows' },
    { label: 'Religious Orders', link: '/dashboards/orders' },
  ];
  readonly networkViews = NETWORK_VIEWS;

  state = { ...DEFAULTS };
  vizState: VizState = 'empty';
  chips: ControlChip[] = [];
  takeaway = '';
  heading = 'The chain';
  fromLabel = '';
  toLabel = '';
  chain: ChainItem[] = [];
  maxPeople = 12;
  focusLink: { label: string; params: Record<string, string> } | null = null;

  private url: UrlState<typeof DEFAULTS>;
  private subs: Subscription[] = [];
  private fetchSub?: Subscription;

  constructor(private api: ApiService, private router: Router, route: ActivatedRoute) {
    this.url = new UrlState(router, route, DEFAULTS);
  }

  ngOnInit(): void {
    this.subs.push(this.url.changes().subscribe(state => {
      this.state = state;
      this.fetchData();
    }));
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    this.fetchSub?.unsubscribe();
  }

  switchNetwork(view: string): void {
    this.router.navigate(['/dashboards/networks'], { queryParams: { view: view === 'institutions' ? null : view } });
  }

  pickFrom(pick: FocusPick): void { this.url.set({ from: pick.id }); }
  pickTo(pick: FocusPick): void { this.url.set({ to: pick.id }); }
  swap(): void { this.url.set({ from: this.state.to, to: this.state.from }); }
  showExample(): void { this.url.set(EXAMPLE); }
  clearAll = (): void => this.url.set({ from: '', to: '' });

  fetchData(): void {
    this.fetchSub?.unsubscribe();
    this.chain = [];
    this.takeaway = '';
    this.focusLink = null;
    const { from, to } = this.state;
    if (!from && !to) {
      this.fromLabel = this.toLabel = '';
      this.chips = [];
      this.vizState = 'empty';
      this.heading = 'The chain';
      return;
    }
    this.vizState = from && to ? 'loading' : 'empty';
    this.fetchSub = this.api.getTypeRequest(`stats/path?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`).subscribe({
      next: (res: any) => this.show(res as PathResponse),
      error: () => this.vizState = 'error',
    });
  }

  private show(res: PathResponse): void {
    this.maxPeople = res.maxPeople;
    this.fromLabel = res.from ? this.stepLabel(res.from) : this.state.from;
    this.toLabel = res.to ? this.stepLabel(res.to) : this.state.to;
    this.chips = this.makeChips();
    const last = res.steps.length - 1;
    this.chain = res.steps.map((s, i) => ({
      kind: s.kind === 'person' ? 'pers' : 'inst',
      label: this.stepLabel(s),
      place: s.place ?? '',
      link: [s.kind === 'person' ? '/people' : '/institutions', s.id],
      // an institution in the chain: the years both neighbours were listed there;
      // at an end, the years its one neighbour was
      years: s.kind === 'person' ? '' : yearSpans(res.links[i === 0 ? 0 : i - 1]?.years ?? []),
      together: s.kind === 'institution' && i > 0 && i < last,
    }));
    const between = res.steps.slice(1, -1).filter(s => s.kind === 'person').length;
    if (!res.from || !res.to) {
      this.heading = 'The chain';
      this.vizState = 'empty';
    } else if (!res.found) {
      this.heading = 'No chain found';
      this.takeaway = `No chain of up to ${res.maxPeople} people links ${this.fromLabel} and ${this.toLabel} through the almanacs.`;
      this.vizState = 'empty';
    } else {
      this.heading = between === 0 ? 'Directly connected' : `${between} ${between === 1 ? 'person' : 'people'} between them`;
      this.takeaway = between === 0
        ? `${this.fromLabel} and ${this.toLabel} are directly connected: ${this.directly(res)}.`
        : `${this.fromLabel} and ${this.toLabel} are ${between} ${between === 1 ? 'person' : 'people'} apart in the almanacs' listings.`;
      this.vizState = 'ready';
      const first = res.from;
      this.focusLink = {
        label: `See ${this.fromLabel}'s network`,
        params: first.kind === 'person' ? { view: 'people', focus: first.id } : { focus: first.id },
      };
    }
  }

  private directly(res: PathResponse): string {
    const [a, b] = res.steps;
    return a.kind === 'person' && b.kind === 'person' ? 'listed together'
      : `listed there ${yearSpans(res.links[0]?.years ?? [])}`;
  }

  private stepLabel(s: PathStep): string {
    return s.kind === 'person'
      ? [s.title, s.name, s.suffix].filter(Boolean).join(' ')
      : institutionLabel(s.name, s.type);
  }

  private makeChips(): ControlChip[] {
    const chips: ControlChip[] = [];
    if (this.state.from) chips.push({ label: `From: ${this.fromLabel || this.state.from}`, clear: () => this.url.set({ from: '' }) });
    if (this.state.to) chips.push({ label: `To: ${this.toLabel || this.state.to}`, clear: () => this.url.set({ to: '' }) });
    return chips;
  }
}

/** [1864, 1865, 1866, 1869] → "1864–66, 1869" */
export function yearSpans(years: number[]): string {
  const runs: number[][] = [];
  for (const y of [...years].sort((a, b) => a - b)) {
    const run = runs[runs.length - 1];
    if (run && y === run[run.length - 1] + 1) run.push(y); else runs.push([y]);
  }
  return runs.map(r => r.length === 1 ? `${r[0]}` : `${r[0]}–${String(r[r.length - 1]).slice(2)}`).join(', ');
}
