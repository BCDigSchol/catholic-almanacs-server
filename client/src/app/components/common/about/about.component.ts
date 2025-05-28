import { Component } from '@angular/core';

import { FilterComponent } from '../filter/filter.component';

@Component({
  selector: 'app-about',
  imports: [FilterComponent],
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss'
})
export class AboutComponent {

  filterOptions: string[] = ['Institution Name', 'Institution Type', 'Language', 'Location', 'Diocese', 'Relevant People']

}
