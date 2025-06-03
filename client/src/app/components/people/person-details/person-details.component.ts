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
import { GoogleMapsModule } from '@angular/google-maps';

import { ApiService } from '../../../services/api.service';

@Component({
  selector: 'app-person-details',
  imports: [CommonModule, MatCardModule, MatListModule, MatTableModule, MatButtonModule,
    RouterLink, SelectYearComponent, MatTooltipModule, GoogleMapsModule
],
  templateUrl: './person-details.component.html',
  styleUrl: './person-details.component.scss'
})


export class PersonDetailsComponent implements OnInit{
  loading = true;
  itemId: any;
  data: any = [];
  mapOptions: google.maps.MapOptions = {
    center: { lat: 39.8283, lng: -98.5795 },
    zoom: 4,
    disableDefaultUI: true,
    clickableIcons: false
  };

  constructor(
    private _route: ActivatedRoute,
    private _api: ApiService,
    private _router: Router
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
  }};

  clickMap (event: google.maps.MapMouseEvent, instID: string) {
    this._router.navigate(['/institutions', instID]);
  };
}
