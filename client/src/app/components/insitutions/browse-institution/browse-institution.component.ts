import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, NavigationStart } from '@angular/router';
import { Observable } from 'rxjs';
import { Location } from '@angular/common';

import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule } from '@angular/material/paginator';
import { PageEvent } from '@angular/material/paginator';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSliderModule } from '@angular/material/slider';
import { MatButtonModule } from '@angular/material/button';
import { FilterComponent } from '../../common/filter/filter.component';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { ApiService } from '../../../services/api.service'; 
import { FilterService } from '../../../services/filter.service';
import { NavigationService } from '../../../services/navigation.service';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';

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
  selector: 'app-browse-institution',
  imports: [CommonModule, MatCardModule, MatListModule, MatIconModule,
    MatPaginatorModule, MatInputModule, FormsModule, MatFormFieldModule,
    RouterLink, MatSliderModule, MatButtonModule, FilterComponent, MatProgressSpinnerModule
  ],
  templateUrl: './browse-institution.component.html',
  styleUrl: './browse-institution.component.scss'
})
export class BrowseInstitutionComponent implements OnInit {
  // flag for loading
  loading : boolean = true;
  data : any[] = [];
  private wasNavigatedToByBackButton = false;

  // paginator variables, default values
  itemsPerPage = 5;
  currentPage = 0;
  totalItems = 0;

  filterValues$!: Observable<any>; //! = can be null
  filterValues: any = {
  };

  filterFields: FilterField[] = [
    { type: 'input', label: 'Institution Name', keyword: 'instName', active: false },
    { type: 'input', label: 'Institution Type', keyword: 'instType', active: false },
    { type: 'input', label: 'Language', keyword: 'language', active: false },
    { type: 'input', label: 'County', keyword: 'countyOrig', active: false },
    { type: 'input', label: 'City', keyword: 'cityOrig', active: false },
    { type: 'autocomplete', label: 'State', keyword: 'stateOrig', active: false },
    { type: 'autocomplete', label: 'Diocese', keyword: 'diocese', active: false, autocompleteOptions: [] },
    { type: 'autocomplete', label: 'Religious Order', keyword: 'religiousOrder', active: false, autocompleteOptions: []},
    { type: 'input', label: 'Person Name', keyword: 'persName', active: false },
    { type: 'range', keywordStart: 'instStartYear', keywordEnd: 'instEndYear', label: 'Year', min: 1834, max:1870, active: true },
  ]
  

  constructor(
    public apiService: ApiService, 
    public filterService: FilterService,
    private navigationService: NavigationService,
    private http: HttpClient,
    private route: ActivatedRoute,
  ) {
    
  }

  ngOnInit () {
    //console.log(this.navigationService.lastNavigationTrigger);
    this.http.get('order.csv', { responseType: 'text' }).subscribe((data) => {
      const orders = data.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      const orderFilter = this.filterFields.find(field => field.keyword === 'religiousOrder');
      if (orderFilter) {
        orderFilter.autocompleteOptions = orders;
        orderFilter.filteredOptions = orders;
      }
    });

    this.http.get('diocese.csv', { responseType: 'text' }).subscribe((data) => {
      const dioceses = data.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      const dioceseFilter = this.filterFields.find(field => field.keyword === 'diocese');
      if (dioceseFilter) {
        dioceseFilter.autocompleteOptions = dioceses;
        dioceseFilter.filteredOptions = dioceses;
      }
    });

    this.http.get('states.csv', { responseType: 'text' }).subscribe((data) => {
      const states = data.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      const stateFilter = this.filterFields.find(field => field.keyword === 'stateOrig');
      if (stateFilter) {
        stateFilter.autocompleteOptions = states;
        stateFilter.filteredOptions = states;
      }
    });

    if (this.navigationService.lastNavigationTrigger !== 'popstate') {
      this.filterService.clearFilters();
      this.filterService.setFields(this.filterFields);
    }

    this.route.queryParams.subscribe(params => {
      const instNameQuery = params['name'];
      if (instNameQuery) {
        this.filterService.setFilterValue('instName', instNameQuery);
        const instNameField = this.filterFields.find(field => field.keyword === 'instName');
        if (instNameField) {
          instNameField.active = true;
        }
      }
    });

    this.filterValues$ = this.filterService.filterValues$;
    this.filterValues$.subscribe(values => {
      this.filterValues = values;
      this.getData();
    });
  }

  /**
   * fetches data from api service and stores it in .data
   */
  getData () {
    this.loading = true;
    let queryString = `?page=${this.currentPage}&size=${this.itemsPerPage}`;
    queryString += this.filterValues.instName ? `&instName=${this.filterValues.instName}` : '';
    queryString += this.filterValues.persName ? `&persName=${this.filterValues.persName}` : '';
    queryString += this.filterValues.diocese ? `&diocese=${this.filterValues.diocese}` : '';
    queryString += this.filterValues.language ? `&language=${this.filterValues.language}` : '';
    queryString += this.filterValues.instType ? `&instType=${this.filterValues.instType}` : '';
    queryString += this.filterValues.countyOrig ? `&countyOrig=${this.filterValues.countyOrig}` : '';
    queryString += this.filterValues.cityOrig ? `&cityOrig=${this.filterValues.cityOrig}` : '';
    queryString += this.filterValues.stateOrig ? `&stateOrig=${this.filterValues.stateOrig}` : '';
    queryString += this.filterValues.instStartYear ? `&instStartYear=${this.filterValues.instStartYear}` : '';
    queryString += this.filterValues.instEndYear ? `&instEndYear=${this.filterValues.instEndYear}` : '';
    queryString += this.filterValues.religiousOrder ? `&religiousOrder=${this.filterValues.religiousOrder}` : '';

    this.apiService.getTypeRequest('institution'+ queryString).subscribe((res:any) => {
      this.data  = res.rows;
      this.totalItems = res.count;
      this.loading = false;
    })
  }

  /**
   * when the filter is updated, reset the current page
   */
  updateFilter () {
    this.currentPage = 0;
    this.getData();
  }

  /**
   * fires when mat-paginator changes the page
   * @param e page event object
   */
  changePage (e: PageEvent) {
    this.currentPage = e.pageIndex;
    this.itemsPerPage = e.pageSize;
    this.getData();
  }
}