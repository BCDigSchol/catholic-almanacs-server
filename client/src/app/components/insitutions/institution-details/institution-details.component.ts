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
import { DialogComponent } from '../../common/dialog/dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MapComponent } from '../../common/map/map.component';

import { ApiService } from '../../../services/api.service';

@Component({
  selector: 'app-institution-details',
  imports: [CommonModule, MatCardModule, MatListModule, MatTableModule, MatButtonModule,
            RouterLink, SelectYearComponent, MatTooltipModule, GoogleMapsModule, MatIcon,
            MatIconModule, DialogComponent, MatProgressSpinnerModule, MapComponent
  ],
  templateUrl: './institution-details.component.html',
  styleUrl: './institution-details.component.scss'
})
export class InstitutionDetailsComponent implements OnInit {
  loading = true;
  itemId: any;
  data: any = {};
  dioceseInfo: any = [];
  instIDInYear: any = {};
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
    private _router: Router,
    private _dialog: MatDialog
  ) { }

  ngOnInit () {
    // refresh the page whenever the parameter changes
    // this._route.paramMap is an observable that emits whenever the route parameters change
    // and when a new value is emitted, .subscribe is called
    this._route.paramMap.subscribe((params) => {
      this.itemId = params.get('id');
      this.getData();
    });
  }

  getData () {
    this.loading = true;
    this._api.getTypeRequest('institution/' + this.itemId).subscribe((res: any) => {
      this.data = res;
      this.instIDInYear = res.instIDInYear;
      this.loading = false;
      const center = { lat: this.data.latitude, lng: this.data.longitude };
      if (window.innerWidth < 768) {
        this.mapOptionsSmall = { ...this.mapOptionsSmall, center, zoom: 7 };
      } else {
        this.mapOptionsWide = { ...this.mapOptionsWide, center, zoom: 7 };
      }
    });
  }

  /**
   * when a user clicks the year button, the child component emits the variable year and the yearSelected event
   * @param year 
   */
  onYearSelected (year: number | string) {
    //this.loading = true;
    if (year === 'All') {
      this.dioceseInfo = [];
      this.getData();
    } else {
      this._api.getTypeRequest('institution/' + this.instIDInYear[String(year)][0] + '/' + year).subscribe((res: any) => {
      this.loading = false;
      const allYears = this.data.year;
      this.data = res;
      this.data.year = allYears;
      this.itemId = this.data.instID;
      this._api.getTypeRequest('diocese?diocese=' + this.data.diocese[0] + '&year=' + year).subscribe((dioceseInfoData: any) => {
        this.dioceseInfo = dioceseInfoData;
    })});}
  };

  goBack (): void {
    if (window.history.length > 1) {
      this._location.back();
    } else {
      this._router.navigate(['/institutions']);
    }
  };

  displayDioceseInfo () {
    if (this.dioceseInfo.length > 0) {
      const dialogRef = this._dialog.open(DialogComponent, {
        data: {
          diocese: this.dioceseInfo[0].diocese,
          year: this.dioceseInfo[0].year,
          dioceseInfo: this.dioceseInfo[0].dioceseInfo
        }
      });
    }
  }
}
