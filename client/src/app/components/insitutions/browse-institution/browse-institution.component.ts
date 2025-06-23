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

import { ApiService } from '../../../services/api.service'; 
import { FilterService } from '../../../services/filter.service';
import { NavigationService } from '../../../services/navigation.service';

@Component({
  selector: 'app-browse-institution',
  imports: [CommonModule, MatCardModule, MatListModule, MatIconModule,
    MatPaginatorModule, MatInputModule, FormsModule, MatFormFieldModule,
    RouterLink, MatSliderModule, MatButtonModule, FilterComponent
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
  
  filterFields = [
    { type: 'input', label: 'Institution Name', keyword: 'instName', active: false },
    { type: 'input', label: 'Language', keyword: 'language', active: false },
    { type: 'input', label: 'Institution Type', keyword: 'instType', active: false },
    { type: 'input', label: 'County', keyword: 'countyReg', active: false },
    { type: 'input', label: 'City', keyword: 'cityReg', active: false },
    { type: 'input', label: 'State', keyword: 'stateReg', active: false },
    { type: 'input', label: 'Diocese', keyword: 'diocese', active: false },
    { type: 'input', label: 'Religious Order', keyword: 'religiousOrder', active: false },
    { type: 'input', label: 'Person Name', keyword: 'persName', active: false },
    { type: 'range', keywordStart: 'instStartYear', keywordEnd: 'instEndYear', label: 'Year', min: 1830, max:1870, active: false },
  ]
  

  constructor(
    public apiService: ApiService, 
    public filterService: FilterService,
    private navigationService: NavigationService,
  ) {
    
  }

  ngOnInit () {
    //console.log(this.navigationService.lastNavigationTrigger);
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

  /**
   * fetches data from api service and stores it in .data
   */
  getData () {

    let queryString = `?page=${this.currentPage}&size=${this.itemsPerPage}`;
    queryString += this.filterValues.instName ? `&instName=${this.filterValues.instName}` : '';
    queryString += this.filterValues.persName ? `&persName=${this.filterValues.persName}` : '';
    queryString += this.filterValues.diocese ? `&diocese=${this.filterValues.diocese}` : '';
    queryString += this.filterValues.language ? `&language=${this.filterValues.language}` : '';
    queryString += this.filterValues.instType ? `&instType=${this.filterValues.instType}` : '';
    queryString += this.filterValues.countyReg ? `&countyReg=${this.filterValues.countyReg}` : '';
    queryString += this.filterValues.cityReg ? `&cityReg=${this.filterValues.cityReg}` : '';
    queryString += this.filterValues.stateReg ? `&stateReg=${this.filterValues.stateReg}` : '';
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