import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PaginationService {

  private _currentPage = new BehaviorSubject<number>(0);
  readonly currentPage$ = this._currentPage.asObservable();
  private currentPage: number = 0;

  private _pageSize = new BehaviorSubject<number>(5);
  readonly pageSize$ = this._pageSize.asObservable();
  private pageSize: number = 5;

  constructor() { }

  setCurrentPage(page: number) {
    this.currentPage = page;
    this._currentPage.next(page);
  }

  setPageSize(size: number) {
    this.pageSize = size;
    this._pageSize.next(size);
  }
}
