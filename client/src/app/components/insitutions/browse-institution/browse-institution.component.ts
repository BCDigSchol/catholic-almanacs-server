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
    church_type: '',
    instYear: null,
    city_reg: '',
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
    queryString += this.filterBy.church_type ? `&church_type=${this.filterBy.church_type}` : '';
    queryString += this.filterBy.city_reg ? `&city_reg=${this.filterBy.city_reg}` : '';
    queryString += this.filterBy.instYear ? `&instYear=${this.filterBy.instYear}` : '';

    this.apiService.getTypeRequest('church'+ queryString).subscribe((res:any) => {
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
   * reset year filter
   */
  resetYear () {
    this.filterBy.instYear = null;
    this.getData();
  }
}