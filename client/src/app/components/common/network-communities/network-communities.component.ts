import { Component, Input } from '@angular/core';
import { DecimalPipe, PercentPipe } from '@angular/common';

import { Communities } from '../../../utils/network-communities';
import { spaceName } from '../../../pipes/space-name.pipe';

/**
 * The communities found from a network's ties, set against the dioceses of
 * their members: where the two agree, clergy kept to diocese lines; where a
 * community spans dioceses (or a diocese splits), they did not.
 */
@Component({
  selector: 'app-network-communities',
  imports: [DecimalPipe, PercentPipe],
  templateUrl: './network-communities.component.html',
  styleUrl: './network-communities.component.scss'
})
export class NetworkCommunitiesComponent {
  @Input() communities: Communities | null = null;
  /** What a node is, plural: "institutions", "people". */
  @Input() nodes = 'nodes';

  diocese(name: string): string { return name === 'Unknown' ? 'diocese not recorded' : spaceName(name); }
}
