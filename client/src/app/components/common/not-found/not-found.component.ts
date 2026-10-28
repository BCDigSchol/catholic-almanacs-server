import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PageHeaderComponent } from '../page-header/page-header.component';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink, PageHeaderComponent],
  templateUrl: './not-found.component.html',
  styleUrl: './not-found.component.scss'
})
export class NotFoundComponent {

}
