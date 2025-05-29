import { Component, Input, OnInit, Output, EventEmitter, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { MatExpansionModule } from '@angular/material/expansion';
import { MatChipsModule } from '@angular/material/chips';
import { MatIcon, MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSliderModule } from '@angular/material/slider';

@Component({
  selector: 'app-filter',
  imports: [MatExpansionModule, CommonModule, MatChipsModule, MatIconModule, 
    MatButtonModule, MatFormFieldModule, MatInputModule, FormsModule, MatIcon,
    MatSliderModule],
  templateUrl: './filter.component.html',
  styleUrl: './filter.component.scss'
})
export class FilterComponent implements OnInit{

  @Input() filterFields: any[] = [];
  @Output() filterSelected = new EventEmitter<string>();

  isOpen = true;
  filterValues: any = {
  };

  ngOnInit(): void {
    this.clearFilters();
  }

  ngOnChanges(changes: SimpleChanges) { //not necessarily needed for now, but useful for future changes
    this.clearFilters();
  };

  clearFilters() {
    this.filterValues = {};
    for (let filter of this.filterFields) {
      if (filter.active) {
        if (filter.type === 'range') {
          this.filterValues[filter.keyStart] = filter.min || 1860;
          this.filterValues[filter.keyEnd] = filter.max || 1870;
        } else {
          this.filterValues[filter.key] = '';
        }
      }
    }
  }

  toggleFilter(filter: any) {
    if (filter.active === undefined) {
      filter.active = true;
    }
    else {
      filter.active = !filter.active;
    }
    if (!filter.active) {
      if (filter.type === 'input') {
        this.filterValues[filter.key] = '';
      } else if (filter.type === 'range') {
        this.filterValues[filter.keyStart] = filter.min || 1860;
        this.filterValues[filter.keyEnd] = filter.max || 1870;
      }
    }
    this.updateFilter();
  }

  updateFilter() {
    this.filterSelected.emit(this.filterValues);
    //console.log('Filter values updated:', this.filterValues);
  }

}
