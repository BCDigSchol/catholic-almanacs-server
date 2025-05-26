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
  selector: 'app-person-details',
  imports: [CommonModule, MatCardModule, MatListModule, MatTableModule, MatButtonModule,
    RouterLink, SelectYearComponent
],
  templateUrl: './person-details.component.html',
  styleUrl: './person-details.component.scss'
})
export class PersonDetailsComponent implements OnInit{
  loading = true;
  itemId: any;
  data: any = [];

  constructor(
    private _route: ActivatedRoute,
    private _api: ApiService,
  ) {}

  ngOnInit () {
    this.itemId = this._route.snapshot.paramMap.get('id');
    this.getData();
  }

  getData () {
    this._api.getTypeRequest('person/' + this.itemId).subscribe((res: any) => {
      this.data = res;
      this.loading = false;
    }
    );}

  onYearSelected (year: number | string) {
    //this.loading = true;
    if (year === 'All') {
      this.getData();
    } else {
      this._api.getTypeRequest('person/' + this.data.persID + '/' + year).subscribe((res: any) => {
      this.loading = false;
      const allYears = this.data.year;
      this.data = res;
      this.data.year = allYears;
      this.itemId = this.data.persID;
      });
  }}
}
