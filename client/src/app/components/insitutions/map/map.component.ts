import { Component, OnInit} from '@angular/core';
import { CommonModule } from '@angular/common';
import { GoogleMapsModule } from '@angular/google-maps';
import { FilterComponent } from '../../common/filter/filter.component';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { MatInput, MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FormsModule } from  '@angular/forms';
import { Observable } from 'rxjs';
import { Router } from '@angular/router';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import { ApiService } from '../../../services/api.service';
import { FilterService } from '../../../services/filter.service';
import { NavigationService } from '../../../services/navigation.service';

@Component({
  selector: 'app-map',
  imports: [GoogleMapsModule, FilterComponent, MatCardModule, CommonModule, 
    MatButtonModule, MatIconModule, MatSliderModule, MatInputModule, FormsModule,
    MatProgressSpinnerModule, MatProgressBarModule
  ],
  templateUrl: './map.component.html',
  styleUrl: './map.component.scss'
})
export class MapComponent implements OnInit {

  loading: boolean = true;
  data: any[] = [];
  isPlaying: boolean = false;
  year: number = 1834;
  yearMin: number = 1834;
  yearMax: number = 1870;

  mapOptions: google.maps.MapOptions = {
    center: { lat: 39.8283, lng: -98.5795 },
    zoom: 4.5,
    disableDefaultUI: true,
    clickableIcons: false
  };

  filterValues$!: Observable<any>; //! = can be null
  filterValues: any = {
  };

  filterFields = [
    //{ type: 'slider', label: 'Year', keyword: 'year', min: 1830, max: 1870, active: true, defaultValue: '1864'},
    { type: 'input', label: 'Institution Type', keyword: 'instType', active: false},
    { type: 'input', label: 'Institution Name', keyword: 'instName', active: false},
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
    
    setInterval (() => {
      if (this.isPlaying && this.year < this.yearMax) {
        this.year += 1;
        this.getData();
      };
      if (this.isPlaying && this.year >= this.yearMax) {
        this.isPlaying = false;
      }
    }, 2000);
  }

  getData() {
    
    this.loading = true;
    let queryString = '';
    //if (this.filterValues.year) {
    //  queryString = `?year=${this.filterValues.year}`;
    //};
    queryString = `?year=${this.year}`;
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
      this.loading = false;
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
  };

  getCircleColor (type: string) : string {
    const colorMap : { [key: string] : string} = {
      'cathedral': '#FF0000', // red
      'church': '#FFFF00', // yellow
      'convent': '#FFA500', // orange
      'school': '#0000FF', // blue
      'hospital': '#00FF00', // green
    };
    return colorMap[type] || '#FFFFFF'; // default to white if type not found
  };

  togglePlay () {
    this.isPlaying = !this.isPlaying;
  }
}
