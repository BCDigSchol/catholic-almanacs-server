import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GoogleMapsModule } from '@angular/google-maps';
import { FilterComponent } from '../../common/filter/filter.component';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSliderModule } from '@angular/material/slider';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { Router } from '@angular/router';

import { ApiService } from '../../../services/api.service';
import { FilterService } from '../../../services/filter.service';
import { NavigationService } from '../../../services/navigation.service';

@Component({
  selector: 'app-map',
  imports: [GoogleMapsModule, FilterComponent, MatCardModule, CommonModule, MatButtonModule, 
    MatIconModule, MatInputModule, FormsModule, MatSliderModule],
  templateUrl: './map.component.html',
  styleUrl: './map.component.scss'
})
export class MapComponent implements OnInit {

  data: any[] = [];
  isPlaying: boolean = false;
  year: number = 1834;
  yearMin: number = 1834;
  yearMax: number = 1870;

  mapOptions: google.maps.MapOptions = {
    center: { lat: 39.8283, lng: -98.5795 },
    zoom: 4,
    disableDefaultUI: true,
    clickableIcons: false
  };

  filterValues$!: Observable<any>; //! = can be null
  filterValues: any = {
  };

  filterFields = [
    //{ type: 'slider', label: 'Year', keyword: 'year', min: 1830, max: 1870, active: true, defaultValue: '1864'}
    // Add more filter fields as needed
  ]

  constructor(
    private _api: ApiService, 
    private filterService: FilterService, 
    private _router:Router,
    private navigationService: NavigationService
  ) { }

  ngOnInit(): void {
    if (this.navigationService.lastNavigationTrigger !== 'popstate') {
    this.filterService.clearFilters();
    this.filterService.setFields(this.filterFields);
  }
    this.filterValues$ = this.filterService.filterValues$;
    this.filterValues$.subscribe(values => {
      this.filterValues = values;
      this.getData();
    });

    setInterval(() => {
      if (this.isPlaying && this.year < this.yearMax) {
        this.year += 1;
        this.getData();
      }
      if (this.year >= this.yearMax) {
        this.isPlaying = false;
      };
    }, 2000);
  }

  getData() {
    
    let queryString = `?year=${this.year}`;

    this._api.getTypeRequest('maps/people' + queryString).subscribe((res: any) => {
      let peopleData: any[] = [];
      for (let pers of res.rows) {
        for (let almanacRecord of pers.almanacRecords) {
          if (almanacRecord.latitude && almanacRecord.longitude) {
            let existingInst = peopleData.find(item => item.instID === almanacRecord.instID);
            if (existingInst) {
              if (!Array.isArray(existingInst.personInAlmanacRecord)) {
                existingInst.personInAlmanacRecord = [existingInst.personInAlmanacRecord];
              };
              existingInst.personInAlmanacRecord.push(almanacRecord.personInAlmanacRecord);
            } else {
              let almanacRecordCopy = { ...almanacRecord };
              if (!Array.isArray(almanacRecordCopy.personInAlmanacRecord)) {
                almanacRecordCopy.personInAlmanacRecord = [almanacRecordCopy.personInAlmanacRecord];
              };
              peopleData.push(almanacRecordCopy);
            };
          };
        }
      };
      this.data = peopleData;
    })
  };

  clickMap(item: any) {
    this._router.navigate(['/institutions', item.instID]);
  };

  persDetailVisible: boolean = false;
  persDetailData: any = {};
  
  showPersDetail(event: any, item: any) {
    this.persDetailData = item;
    this.persDetailVisible = true;
  };

  hidePersDetail() {
    this.persDetailVisible = false;
    this.persDetailData = {};
  };

  togglePlay() {
    this.isPlaying = !this.isPlaying;
  }
}
