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
import { MapComponent as CommonMapComponent} from '../../common/map/map.component';

import { ApiService } from '../../../services/api.service';
import { FilterService } from '../../../services/filter.service';
import { NavigationService } from '../../../services/navigation.service';
import { HttpClient } from '@angular/common/http';

interface FilterField {
    type: string;
    label?: string;
    keyword?: string;
    active?: boolean;
    autocompleteOptions?: string[];
    keywordStart?: string;
    keywordEnd?: string;
    min?: number; 
    max?: number; 
    filteredOptions?: string[];
  }

@Component({
  selector: 'app-institutions-map',
  imports: [GoogleMapsModule, FilterComponent, MatCardModule, CommonModule, 
    MatButtonModule, MatIconModule, MatSliderModule, MatInputModule, FormsModule,
    MatProgressSpinnerModule, MatProgressBarModule, CommonMapComponent
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

  filterFields: FilterField[] = [
    //{ type: 'slider', label: 'Year', keyword: 'year', min: 1830, max: 1870, active: true, defaultValue: '1864'},
    { type: 'autocomplete', label: 'Institution Type', keyword: 'instType', active: false, autocompleteOptions: []},
    { type: 'input', label: 'Institution Name', keyword: 'instName', active: false},
    { type: 'autocomplete', label: 'Diocese', keyword: 'diocese', active: false, autocompleteOptions: []}
  ]

  constructor(
    private _api: ApiService, 
    private filterService: FilterService, 
    private _router:Router,
    private navigationService: NavigationService,
    private http: HttpClient
  ) { }

  ngOnInit(): void {
    this.http.get('diocese.csv', { responseType: 'text' }).subscribe((data) => {
      const dioceses = data.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      const dioceseFilter = this.filterFields.find(field => field.keyword === 'diocese');
      if (dioceseFilter) {
        dioceseFilter.autocompleteOptions = dioceses;
        dioceseFilter.filteredOptions = dioceses;
      }
    });

    this.http.get('types.csv', { responseType: 'text' }).subscribe((data) => {
      const types = data.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      const typeFilter = this.filterFields.find(field => field.keyword === 'instType');
      if (typeFilter) {
        typeFilter.autocompleteOptions = types;
        typeFilter.filteredOptions = types;
      }
    });

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
    if (this.filterValues.diocese) {
      queryString += queryString ? `&diocese=${this.filterValues.diocese}` : `?diocese=${this.filterValues.diocese}`;
    }
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
      'consecrated life institutions': '#FF0000', // red
      'religious institutions': '#FFFF00', // yellow
      'educational institutions': '#b300ffff', // orange
      'healthcare institutions': '#0000FF', // blue
      'charitable institutions': '#00FF00', // green
    };
    return colorMap[type] || '#FFFFFF'; // default to white if type not found
  };

  togglePlay () {
    this.isPlaying = !this.isPlaying;
  }
}
