import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { RouterLink, Router } from '@angular/router';

import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { SelectYearComponent } from '../../common/select-year/select-year.component';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatIcon, MatIconModule } from '@angular/material/icon';
import { Location } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MapComponent } from '../../common/map/map.component';

import { ApiService } from '../../../services/api.service';


@Component({
  selector: 'app-person-details',
  imports: [CommonModule, MatCardModule, MatListModule, MatTableModule, MatButtonModule,
    RouterLink, SelectYearComponent, MatTooltipModule, MatIconModule,
    MatIcon, MatProgressSpinnerModule, MapComponent],
  templateUrl: './person-details.component.html',
  styleUrl: './person-details.component.scss'
})


export class PersonDetailsComponent implements OnInit{
  loading = true;
  itemId: any;
  data: any = [];
  get longestName(): string {
    if (!this.data?.name || !Array.isArray(this.data.name)) return '';
    return this.data.name.reduce((a: string, b: string) => a.length > b.length ? a : b, '');
  }

  constructor(
    private _route: ActivatedRoute,
    private _api: ApiService,
    private _router: Router,
    private _location: Location,
  ) {}

  ngOnInit () {
    this.itemId = this._route.snapshot.paramMap.get('id');
    this.getData();
  }

  getData () {
    this.loading = true;
    this._api.getTypeRequest('person/' + this.itemId).subscribe((res: any) => {
      this.data = res;
      this.loading = false;
      //console.log(this.data);
    });
  }

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
  }};

  goBack (): void {
    if (window.history.length > 1) {
      this._location.back();
    } else {
      this._router.navigate(['/people']);
    }
  }
}
