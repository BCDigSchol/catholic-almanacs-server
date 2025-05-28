import { Component, Input, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { MatExpansionModule } from '@angular/material/expansion';
import { MatChipsModule } from '@angular/material/chips';
import { MatIcon, MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-filter',
  imports: [MatExpansionModule, CommonModule, MatChipsModule, MatIconModule, 
    MatButtonModule, MatFormFieldModule, MatInputModule, FormsModule, MatIcon],
  templateUrl: './filter.component.html',
  styleUrl: './filter.component.scss'
})
export class FilterComponent implements OnInit{

  @Input() filterOptions: string[] = [];
  @Output() filterSelected = new EventEmitter<{ [key: string]: string}>();

  isOpen = true;
  selectedFilters: string [] = [];
  filterValues: { [key: string]: string } = {};

  ngOnInit(): void {
  }

  onChipSelect (filter: string) {
    this.filterOptions = this.filterOptions.filter(f => f !== filter);
    this.selectedFilters.push(filter);
    setTimeout(() => {
    this.isOpen = true;
    });
    //console.log(this.selectedFilters);
  }

  removeFilter (filter: string) {
    this.selectedFilters = this.selectedFilters.filter(f => f !== filter);
    this.filterOptions.push(filter);
    delete this.filterValues[filter];
    this.filterSelected.emit(this.filterValues);
    if (this.selectedFilters.length === 0) {
      this.isOpen = false;
    }
  }

  onFilterValueChange(filter: string, value: string) {
    this.filterValues[filter] = value;
    this.filterSelected.emit(this.filterValues);
  }

}
