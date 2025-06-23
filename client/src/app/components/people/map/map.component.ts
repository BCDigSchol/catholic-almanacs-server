import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GoogleMapsModule } from '@angular/google-maps';
import { FilterComponent } from '../../common/filter/filter.component';
import { MatCardModule } from '@angular/material/card';
import { Observable } from 'rxjs';
import { Router } from '@angular/router';

import { ApiService } from '../../../services/api.service';
import { FilterService } from '../../../services/filter.service';
import { NavigationService } from '../../../services/navigation.service';

@Component({
  selector: 'app-map',
  imports: [GoogleMapsModule, FilterComponent, MatCardModule, CommonModule],
  templateUrl: './map.component.html',
  styleUrl: './map.component.scss'
})
export class MapComponent implements OnInit {

  data: any[] = [];

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
    { type: 'slider', label: 'Year', keyword: 'year', min: 1830, max: 1870, active: true, defaultValue: '1864'}
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
  }

  getData() {
    
    let queryString = '';
    if (this.filterValues.year) {
      queryString = `?year=${this.filterValues.year}`;
    };

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
  }
}
