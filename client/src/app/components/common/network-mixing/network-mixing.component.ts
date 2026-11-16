import { Component, Input } from '@angular/core';
import { DecimalPipe, PercentPipe } from '@angular/common';

import { Mixing } from '../../../utils/network-mixing';

/**
 * Whether a network's ties keep to the categories its nodes are coloured by:
 * for each category, the share of its ties that stay inside it, beside the
 * share that would if ties ignored the category.
 */
@Component({
  selector: 'app-network-mixing',
  imports: [DecimalPipe, PercentPipe],
  templateUrl: './network-mixing.component.html',
  styleUrl: './network-mixing.component.scss'
})
export class NetworkMixingComponent {
  @Input() mixing: Mixing | null = null;
  /** What the nodes are coloured by, lower case: "diocese", "kind of institution". */
  @Input() attribute = 'diocese';
  /** What a node is, plural: "institutions", "people". */
  @Input() nodes = 'nodes';

  /** "3.2 times": how much more ties stay inside than chance would have it. */
  times(within: number, expected: number): string {
    if (!expected) return '';
    const t = within / expected;
    return t >= 10 ? `${Math.round(t)}×` : `${t.toFixed(1)}×`;
  }
}
