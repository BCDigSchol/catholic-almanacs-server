import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';

import { AlmanacScans, NO_SCANS, parseScans } from '../utils/almanac-scans';

/** The list of scanned almanac volumes (public/almanac-scans.csv), read once. */
@Injectable({ providedIn: 'root' })
export class AlmanacScansService {
  readonly scans$: Observable<AlmanacScans>;

  constructor(http: HttpClient) {
    this.scans$ = http.get('almanac-scans.csv', { responseType: 'text' }).pipe(
      map(parseScans),
      catchError(() => of(NO_SCANS)),
      shareReplay(1),
    );
  }
}
