import { Component } from '@angular/core';

import { FilterComponent } from '../filter/filter.component';

@Component({
  selector: 'app-about',
  imports: [FilterComponent],
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss'
})
export class AboutComponent {

  filterFields = [
    { type: 'input', label: 'Institution Name', key: 'instName', active: false },
    { type: 'input', label: 'Diocese', key: 'diocese', active: false },
    { type: 'input', label: 'Language', key: 'language', active: false },
  ]

}
