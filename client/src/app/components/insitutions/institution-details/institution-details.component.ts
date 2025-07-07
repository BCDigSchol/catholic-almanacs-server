import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { RouterLink } from '@angular/router';

import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { SelectYearComponent } from '../../common/select-year/select-year.component';
import { MatTooltipModule } from '@angular/material/tooltip';
import { GoogleMapsModule } from '@angular/google-maps';
import { Location } from '@angular/common';
import { MatIcon, MatIconModule } from '@angular/material/icon';

import { ApiService } from '../../../services/api.service';

@Component({
  selector: 'app-institution-details',
  imports: [CommonModule, MatCardModule, MatListModule, MatTableModule, MatButtonModule,
            RouterLink, SelectYearComponent, MatTooltipModule, GoogleMapsModule, MatIcon,
            MatIconModule
  ],
  templateUrl: './institution-details.component.html',
  styleUrl: './institution-details.component.scss'
})
export class InstitutionDetailsComponent implements OnInit {
  loading = true;
  itemId: any;
  data: any = {};
  mapOptionsWide: google.maps.MapOptions = {
    center: { lat: 39.8283, lng: -98.5795 },
    zoom: 3.7,
    disableDefaultUI: true,
    clickableIcons: false
  };

  mapOptionsSmall: google.maps.MapOptions = {
    center: { lat: 39.8283, lng: -98.5795 },
    zoom: 3.4,
    disableDefaultUI: true,
    clickableIcons: false
  };

  constructor(
    private _route: ActivatedRoute,
    private _api: ApiService,
    private _location: Location,
    private _router: Router
  ) { }

  ngOnInit () {
    // refresh the page whenever the parameter changes
    // this._route.paramMap is an observable that emits whenever the route parameters change
    // and when a new value is emitted, .subscribe is called
      this.itemId = this._route.snapshot.paramMap.get('id');
      this.getData();
  }

  getData () {
    this._api.getTypeRequest('institution/' + this.itemId).subscribe((res: any) => {
      this.data = res;
      this.loading = false;
      //console.log(this.data.religiousOrder)
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
  };

  clickMap (event: google.maps.MapMouseEvent) {
  };

  goBack (): void {
    if (window.history.length > 1) {
      this._location.back();
    } else {
      this._router.navigate(['/institutions']);
    }
  }
}
