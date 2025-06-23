import { Component, Input, OnInit, Output, EventEmitter, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';

import { MatExpansionModule } from '@angular/material/expansion';
import { MatChipsModule } from '@angular/material/chips';
import { MatIcon, MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSliderModule } from '@angular/material/slider';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

import { FilterService } from '../../../services/filter.service';

@Component({
  selector: 'app-filter',
  imports: [MatExpansionModule, CommonModule, MatChipsModule, MatIconModule, 
    MatButtonModule, MatFormFieldModule, MatInputModule, FormsModule, MatIcon,
    MatSliderModule, MatSelectModule, MatSlideToggleModule],
  templateUrl: './filter.component.html',
  styleUrl: './filter.component.scss'
})
export class FilterComponent implements OnInit{

  isOpen = true;
  filterValues$!: Observable<any>; //! = can be null
  filterValues: any = {
  };

  constructor(public filterService: FilterService) {
  }

  ngOnInit(): void {
    this.filterValues$ = this.filterService.filterValues$;
    this.filterValues$.subscribe(values => {
      this.filterValues = values;
    })
  }

  clearFilters() {
  }

  toggleFilter(filterIndex: any) {
    this.filterService.toggleFilterField(filterIndex);
  }

  updateFilter(filter: any) {
    if (filter.type === 'input' || filter.type === 'dropdown' || filter.type === 'boolean' || filter.type === 'slider') {
      this.filterService.setFilterValue(filter.keyword, this.filterValues[filter.keyword]);
    } else if (filter.type === 'range') {
      this.filterService.setFilterValue(filter.keywordStart, this.filterValues[filter.keywordStart]);
      this.filterService.setFilterValue(filter.keywordEnd, this.filterValues[filter.keywordEnd]);
    }
  }

}
