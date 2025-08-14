import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';

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
import { ActivatedRoute } from '@angular/router';
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
  selector: 'app-browse-people',
  imports: [CommonModule, MatCardModule, MatListModule, MatIconModule,
    MatPaginatorModule, MatInputModule, FormsModule, MatFormFieldModule,
    RouterLink, MatSliderModule, MatButtonModule, FilterComponent, 
    MatProgressSpinnerModule
  ],
  templateUrl: './browse-people.component.html',
  styleUrl: './browse-people.component.scss'
})
export class BrowsePeopleComponent implements OnInit {
// flag for loading
loading : boolean = true;
data : any[] = [];

filterValues$!: Observable<any>; //! = can be null
filterValues: any = {};
private wasNavigatedToByBackButton = false;

// paginator variables, default values
itemsPerPage = 5;
currentPage = 0;
totalItems = 0;

filterFields: FilterField[] = [
  { type: 'input', label: 'Person Name', keyword: 'persName', active: false },
  { type: 'input', label: 'County', keyword: 'countyReg', active: false },
  { type: 'input', label: 'City', keyword: 'cityReg', active: false },
  { type: 'input', label: 'State', keyword: 'stateReg', active: false },
  { type: 'autocomplete', label: 'Diocese', keyword: 'diocese', active: false, autocompleteOptions: [] },
  { type: 'input', label: 'Institution Name', keyword: 'instName', active: false },
  { type: 'range', keywordStart: 'instStartYear', keywordEnd: 'instEndYear', label: 'Year', min: 1834, max: 1870, active: true },
]

constructor(
  public apiService: ApiService, 
  public filterService: FilterService,
  public navigationService: NavigationService,
  private http: HttpClient,
  private route: ActivatedRoute
) {}

ngOnInit () {
  this.http.get('diocese.csv', { responseType: 'text' }).subscribe((data) => {
      const dioceses = data.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      const dioceseFilter = this.filterFields.find(field => field.keyword === 'diocese');
      if (dioceseFilter) {
        dioceseFilter.autocompleteOptions = dioceses;
        dioceseFilter.filteredOptions = dioceses;
      }
  });
  if (this.navigationService.lastNavigationTrigger !== 'popstate') {
    this.filterService.clearFilters();
    this.filterService.setFields(this.filterFields);
  };
  this.route.queryParams.subscribe(params => {
    const persNameQuery = params['name'];
    if (persNameQuery) {
      this.filterService.setFilterValue('persName', persNameQuery);
      const persNameField = this.filterFields.find(field => field.keyword === 'persName');
      if (persNameField) {
        persNameField.active = true;
      }
    }
  })
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
  queryString += this.filterValues.persName ? `&persName=${this.filterValues.persName}` : '';
  queryString += this.filterValues.countyReg ? `&countyReg=${this.filterValues.countyReg}` : '';
  queryString += this.filterValues.cityReg ? `&cityReg=${this.filterValues.cityReg}` : '';
  queryString += this.filterValues.stateReg ? `&stateReg=${this.filterValues.stateReg}` : '';
  queryString += this.filterValues.diocese ? `&diocese=${this.filterValues.diocese}` : '';
  queryString += this.filterValues.instName ? `&instName=${this.filterValues.instName}` : '';
  queryString += this.filterValues.instStartYear  ? `&instStartYear=${this.filterValues.instStartYear}` : '';
  queryString += this.filterValues.instEndYear ? `&instEndYear=${this.filterValues.instEndYear}` : '';

  this.apiService.getTypeRequest('person'+ queryString).subscribe((res:any) => {
    this.data  = res.rows;
    this.totalItems = res.count;
    this.loading = false;
  })
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

/** 
 * when filter is updated, reset current page
*/
updateFilter () {
    this.currentPage = 0;
    this.getData();
  }

/**
 * return unique years to be displayed for each person
 * @param records 
 */
getUniqueYears(records: any[]): any[] {
  const uniqueYears = new Set<number>();
  records.forEach(record => {
    if (record.year && !uniqueYears.has(record.year)) {
      uniqueYears.add(record.year);
    }
  });
  return Array.from(uniqueYears);
}
}
