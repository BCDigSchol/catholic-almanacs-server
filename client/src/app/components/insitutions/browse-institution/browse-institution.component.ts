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

import { ApiService } from '../../../services/api.service'; 

@Component({
  selector: 'app-browse-institution',
  imports: [CommonModule, MatCardModule, MatListModule, MatIconModule,
    MatPaginatorModule, MatInputModule, FormsModule, MatFormFieldModule,
    RouterLink, MatSliderModule, MatButtonModule
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
    instYear: false,
    cityReg: '',
    persName: ''
  }

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
    queryString += this.filterBy.cityReg ? `&cityReg=${this.filterBy.cityReg}` : '';
    if (this.filterBy.instYear) {
      queryString += this.filterBy.instStartYear ? `&instStartYear=${this.filterBy.instStartYear}` : '';
      queryString += this.filterBy.instEndYear ? `&instEndYear=${this.filterBy.instEndYear}` : '';
    }

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