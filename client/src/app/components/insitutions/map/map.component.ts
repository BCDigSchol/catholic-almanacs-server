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
    { type: 'slider', label: 'Year', keyword: 'year', min: 1830, max: 1870, active: true, defaultValue: '1864'},
    { type: 'input', label: 'Institution Type', keyword: 'instType', active: true},
    { type: 'input', label: 'Institution Name', keyword: 'instName', active: true},
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
    if (this.filterValues.instType) {
      queryString += queryString ? `&instType=${this.filterValues.instType}` : `?instType=${this.filterValues.instType}`;
    };
    if (this.filterValues.instName) {
      queryString += queryString ? `&instName=${this.filterValues.instName}` : `?instName=${this.filterValues.instName}`;
    };

    this._api.getTypeRequest('maps/institutions' + queryString).subscribe((res: any) => {
      let institutionData: any[] = [];
      for (let item of res.rows) {
        for (let almanacRecord of item.almanacRecord) {
          if (almanacRecord.latitude && almanacRecord.longitude) {
            institutionData.push(Object.assign(almanacRecord, {id: item.ID}));
          }
        }
      };
      this.data = institutionData;
      //console.log(this.data);
    })
  };

  clickMap(item: any) {
    this._router.navigate(['/institutions', item.id]);
  };

  instDetailVisible: boolean = false;
  instDetailData: any = {};
  
  showInstDetail(event: any, item: any) {
    this.instDetailData = item;
    this.instDetailVisible = true;
  };

  hideInstDetail() {
    this.instDetailVisible = false;
    this.instDetailData = {};
  }
}
