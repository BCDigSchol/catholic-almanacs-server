import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs/operators';
import { AsyncPipe } from '@angular/common';

import { InstitutionalNetworkContainerComponent } from '../institutional-network-container/institutional-network-container.component';
import { PersonalNetworkContainerComponent } from '../personal-network-container/personal-network-container.component';
import { BipartiteNetworkComponent } from '../bipartite-network/bipartite-network.component';

/**
 * /dashboards/networks: one page for the three networks, chosen by ?view=
 * (institutions, the default; people; service — people and institutions
 * together). Each network keeps its own filters; the switch lives in each
 * network's control bar.
 */
@Component({
  selector: 'app-networks',
  imports: [AsyncPipe, InstitutionalNetworkContainerComponent, PersonalNetworkContainerComponent, BipartiteNetworkComponent],
  templateUrl: './networks.component.html',
  styleUrl: './networks.component.scss'
})
export class NetworksComponent {
  readonly view$ = inject(ActivatedRoute).queryParamMap.pipe(map(p => p.get('view') || 'institutions'));
}
