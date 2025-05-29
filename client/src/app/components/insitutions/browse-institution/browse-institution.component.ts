import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

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

  // paginator variables, default values
  itemsPerPage = 5;
  currentPage = 0;
  totalItems = 0;

  // filter variables
  filterBy: any = {
    instName: '',
    diocese: '',
    language: '',
    instType: '',
    instStartYear: 1860,
    instEndYear: 1870,
    cityReg: '',
    persName: ''
  }
  
  filterFields = [
    { type: 'input', label: 'Institution Name', key: 'instName', active: false },
    { type: 'input', label: 'Language', key: 'language', active: false },
    { type: 'input', label: 'Institution Type', key: 'instType', active: false },
    { type: 'input', label: 'County', key: 'countyReg', active: false },
    { type: 'input', label: 'City', key: 'cityReg', active: false },
    { type: 'input', label: 'State', key: 'stateReg', active: false },
    { type: 'input', label: 'Diocese', key: 'diocese', active: false },
    { type: 'input', label: 'Person Name', key: 'persName', active: false },
    { type: 'range', keyStart: 'instStartYear', keyEnd: 'instEndYear', label: 'Year', min: 1860, max:1870}
  ]
  

  constructor(public apiService: ApiService) {}

  ngOnInit () {
    this.getData()
  }

  /**
   * fetches data from api service and stores it in .data
   */
  getData () {

    let queryString = `?page=${this.currentPage}&size=${this.itemsPerPage}`;
    queryString += this.filterBy.instName ? `&instName=${this.filterBy.instName}` : '';
    queryString += this.filterBy.persName ? `&persName=${this.filterBy.persName}` : '';
    queryString += this.filterBy.diocese ? `&diocese=${this.filterBy.diocese}` : '';
    queryString += this.filterBy.language ? `&language=${this.filterBy.language}` : '';
    queryString += this.filterBy.instType ? `&instType=${this.filterBy.instType}` : '';
    queryString += this.filterBy.countyReg ? `&countyReg=${this.filterBy.countyReg}` : '';
    queryString += this.filterBy.cityReg ? `&cityReg=${this.filterBy.cityReg}` : '';
    queryString += this.filterBy.stateReg ? `&stateReg=${this.filterBy.stateReg}` : '';
    queryString += this.filterBy.instStartYear ? `&instStartYear=${this.filterBy.instStartYear}` : '';
    queryString += this.filterBy.instEndYear ? `&instEndYear=${this.filterBy.instEndYear}` : '';

    this.apiService.getTypeRequest('institution'+ queryString).subscribe((res:any) => {
      this.data  = res.rows;
      this.totalItems = res.count;
      this.loading = false;
    })
  }

  updateFilter () {
    this.currentPage = 0;
    this.getData();
  }

  onFilterChanged (filterValues: any) {
    for (const key in this.filterBy) {
    if (typeof this.filterBy[key] === 'string') {
      this.filterBy[key] = '';
    }
  }
    for (const key in filterValues) {
      if (filterValues[key] !== '') {
        this.filterBy[key] = filterValues[key];
      }
  }
    this.updateFilter();
  }

  /**
   * runs when the slider is changed
   */
  getYearData () {
    this.filterBy.instYear = true;
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

  /**
   * reset year filter
   */
  resetYear () {
    this.filterBy.instStartYear = 1860;
    this.filterBy.instEndYear = 1870;
    this.filterBy.instYear = false;
    this.getData();
  }
}