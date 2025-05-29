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
  selector: 'app-browse-people',
  imports: [CommonModule, MatCardModule, MatListModule, MatIconModule,
    MatPaginatorModule, MatInputModule, FormsModule, MatFormFieldModule,
    RouterLink, MatSliderModule, MatButtonModule, FilterComponent
  ],
  templateUrl: './browse-people.component.html',
  styleUrl: './browse-people.component.scss'
})
export class BrowsePeopleComponent implements OnInit {
// flag for loading
loading : boolean = true;
data : any[] = [];

// paginator variables, default values
itemsPerPage = 5;
currentPage = 0;
totalItems = 0;

// filter variables
filterBy: any = {
  persName: '',
  cityReg: '',
  diocese: '',
  instName: '',
  year: null,
}

filterFields = [
  { type: 'input', label: 'Person Name', key: 'persName', active: false },
  { type: 'input', label: 'City', key: 'cityReg', active: false },
  { type: 'input', label: 'Diocese', key: 'diocese', active: false },
  { type: 'input', label: 'Institution Name', key: 'instName', active: false },
  { type: 'range', keyStart: 'year', keyEnd: '', label: 'Year', min: 1860, max: 1870 }
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
  queryString += this.filterBy.name ? `&persName=${this.filterBy.name}` : '';
  queryString += this.filterBy.cityReg ? `&cityReg=${this.filterBy.cityReg}` : '';
  queryString += this.filterBy.diocese ? `&diocese=${this.filterBy.diocese}` : '';
  queryString += this.filterBy.instName ? `&instName=${this.filterBy.instName}` : '';
  queryString += this.filterBy.year ? `&year=${this.filterBy.year}` : '';

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
 * reset year filter
 */
resetYear () {
  this.filterBy.year = null;
  this.getData();
}

/**
 * return unique dioceses to be displayed for each person
 * @param institutions 
 *
getUniqueDioceses(institutions: any[]): any[] {
  const uniqueDioceses = new Set<string>();
  return institutions.filter(institution => {
    if (!uniqueDioceses.has(institution.diocese)) {
      uniqueDioceses.add(institution.diocese);
      return true;
    }
    return false;
  })
} */

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
