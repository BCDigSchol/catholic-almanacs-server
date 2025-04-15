import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { ApiService } from '../../../services/api.service'; 

import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule } from '@angular/material/paginator';
import { PageEvent } from '@angular/material/paginator';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';

@Component({
  selector: 'app-browse-institution',
  imports: [CommonModule, MatCardModule, MatListModule, MatIconModule,
    MatPaginatorModule, MatInputModule, FormsModule, MatFormFieldModule,
    RouterLink
  ],
  templateUrl: './browse-institution.component.html',
  styleUrl: './browse-institution.component.scss'
})
export class BrowseInstitutionComponent implements OnInit {
  // flag for loading
  loading : boolean = true;
  data : any[] = [];

  // paginator variables
  itemsPerPage = 5;
  currentPage = 0;
  totalItems = 0;

  // filter variables
  filterBy: any = {
    instName: '',
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
}