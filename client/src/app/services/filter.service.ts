import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

interface FilterField {
  type: 'input' | 'range' | 'boolean' | 'dropdown' | 'slider' | 'autocomplete';
  label?: string;
  keyword: string;
  keywordStart?: string; 
  keywordEnd?: string;
  min?: number;
  max?: number;
  active?: boolean;
  dropdown?: string[];
  autocompleteOptions?: string[];
  defaultValue?: any;
  filteredOptions?: string[];
}

@Injectable({
  providedIn: 'root'
})
export class FilterService {

  /*
  Stores information about the fields to be filtered as an array of objects. The structure of the object
  depends on the type of filter. Acceptable types include 'input' and 'range'.
  Each object can have the following properties:
  */
  // { type: 'input', label: 'Person Name', keyword: 'persName', active: false },
  // { type: 'range', keywordStart: 'instStartYear', keywordEnd: 'instEndYear', label: 'Year', min: 1860, max:1870, active: false },
  // { type: 'boolean', keyword: 'isPrecise', label: 'Precise' }
  // { type: 'dropdown', keyword: 'action', label: 'Action', dropdown: ['CREATE', 'UPDATE', 'DELETE']}
  public fields: FilterField[] = []; // can be set as an Observable if the filter component and the browse component are initialized at the same time

  private _filterValues = new BehaviorSubject<FilterField[]>([]);
  readonly filterValues$ = this._filterValues.asObservable();
  private filterValues: any = {};

  constructor() { }

  setFields(fields: any[]) {
    this.fields = [];
    for (let field of fields) {
      this.fields.push(field as FilterField);
      // set the default value for the filter field if it exists
      if (field.defaultValue && field.keyword) {
        this.filterValues[field.keyword] = field.defaultValue;
      }
    }
    this.filterValues = {};
  };

  setFilterValue(keyword: string, value: any) {
    this.filterValues[keyword] = value;
    this._filterValues.next(this.filterValues); // signal the change to subscribers
  };

  // receives a filter field index and toggles the active state of the filter field
  toggleFilterField(filterIndex: number) {
    const filter = this.fields[filterIndex] as FilterField;
    if (filter.active === undefined) {
      filter.active = true;
    }
    else {
      filter.active = !filter.active;
    }
    if (!filter.active) {
      if (filter.type === 'input') {
        this.filterValues[filter.keyword] = '';
      } else if (filter.type === 'range') {
        if (filter.keywordStart && filter.keywordEnd) {
          this.filterValues[filter.keywordStart] = filter.min || 1860;
          this.filterValues[filter.keywordEnd] = filter.max || 1870;
        }
      } else if (filter.type === 'autocomplete') {
        this.filterValues[filter.keyword] = '';
        filter.filteredOptions = filter.autocompleteOptions || [];
      }
    }
    this._filterValues.next(this.filterValues);
  };

  clearFilters() {
    this.fields.forEach(field => {
      field.active = false;
    });
    this.filterValues = {};
    this._filterValues.next(this.filterValues);
  }
}
