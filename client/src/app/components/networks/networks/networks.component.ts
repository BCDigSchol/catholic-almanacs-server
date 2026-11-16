import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs/operators';
import { AsyncPipe } from '@angular/common';

import { InstitutionalNetworkContainerComponent } from '../institutional-network-container/institutional-network-container.component';
import { PersonalNetworkContainerComponent } from '../personal-network-container/personal-network-container.component';
import { BipartiteNetworkComponent } from '../bipartite-network/bipartite-network.component';
import { NetworkPathComponent } from '../network-path/network-path.component';
import { LineageNetworkComponent } from '../lineage-network/lineage-network.component';

/**
 * /dashboards/networks: one page for the networks and the path finder,
 * chosen by ?view= (institutions, the default; people; service — people and
 * institutions together; lineage — who served under whom; path — how two
 * records are connected). Each keeps
 * its own state; the switch lives in each one's control bar.
 */
@Component({
  selector: 'app-networks',
  imports: [AsyncPipe, InstitutionalNetworkContainerComponent, PersonalNetworkContainerComponent, BipartiteNetworkComponent, NetworkPathComponent, LineageNetworkComponent],
  templateUrl: './networks.component.html',
  styleUrl: './networks.component.scss'
})
export class NetworksComponent {
  readonly view$ = inject(ActivatedRoute).queryParamMap.pipe(map(p => p.get('view') || 'institutions'));
}
