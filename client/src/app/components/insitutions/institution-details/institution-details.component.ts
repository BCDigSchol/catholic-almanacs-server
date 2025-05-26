import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { RouterLink } from '@angular/router';

import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { SelectYearComponent } from '../../common/select-year/select-year.component';

import { ApiService } from '../../../services/api.service';

@Component({
  selector: 'app-institution-details',
  imports: [CommonModule, MatCardModule, MatListModule, MatTableModule, MatButtonModule,
            RouterLink, SelectYearComponent
  ],
  templateUrl: './institution-details.component.html',
  styleUrl: './institution-details.component.scss'
})
export class InstitutionDetailsComponent implements OnInit {
  loading = true;
  itemId: any;
  data: any = [];

  constructor(
    private _route: ActivatedRoute,
    private _api: ApiService,
  ) { }

  ngOnInit () {
    // refresh the page whenever the parameter changes
    // this._route.paramMap is an observable that emits whenever the route parameters change
    // and when a new value is emitted, .subscribe is called
    this._route.paramMap.subscribe(params => {
      this.itemId = params.get('id');
      this.getData();
    });
  }

  getData () {
    this._api.getTypeRequest('institution/' + this.itemId).subscribe((res: any) => {
      this.data = res;
      this.loading = false;
    }
    );
  }

  /**
   * when a user clicks the year button, the child component emits the variable year and the yearSelected event
   * @param year 
   */
  onYearSelected (year: number | string) {
    //this.loading = true;
    if (year === 'All') {
      this.getData();
    } else {
      this._api.getTypeRequest('institution/' + this.data.instID + '/' + year).subscribe((res: any) => {
      this.loading = false;
      const allYears = this.data.year;
      this.data = res;
      this.data.year = allYears;
      this.itemId = this.data.instID;
    })};
  }
}
