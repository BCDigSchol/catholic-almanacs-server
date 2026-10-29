import { Component, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs/operators';

import { MapComponent as InstitutionsMapComponent } from '../../insitutions/map/map.component';
import { MapComponent as PeopleMapComponent } from '../../people/map/map.component';

/**
 * /dashboards/explore: institutions or people on the map, chosen by
 * ?entity= (institutions by default). The switch lives in each map's control bar.
 */
@Component({
  selector: 'app-explore',
  imports: [AsyncPipe, InstitutionsMapComponent, PeopleMapComponent],
  templateUrl: './explore.component.html',
  styleUrl: './explore.component.scss'
})
export class ExploreComponent {
  readonly entity$ = inject(ActivatedRoute).queryParamMap.pipe(map(p => p.get('entity') === 'people' ? 'people' : 'institutions'));
}
