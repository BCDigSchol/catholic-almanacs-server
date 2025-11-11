import { Component, Input, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-select-year',
  imports: [CommonModule, MatButtonModule],
  templateUrl: './select-year.component.html',
  styleUrl: './select-year.component.scss'
})
export class SelectYearComponent implements OnInit {
  @Input() years: number[] = [];
  @Output() yearSelected = new EventEmitter<number | string>();
  selectedYear: number | string = 'All';
  
  ngOnInit() {
    //console.log(this.years);
  }

  onYearClick(year: number) {
    this.yearSelected.emit(year);
    this.selectedYear = year;
  }

  onAllYearsClick() {
    this.selectedYear = 'All';
    this.yearSelected.emit('All');
}
}