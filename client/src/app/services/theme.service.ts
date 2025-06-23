import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable()
export class ThemeService {
  private _darkTheme = new BehaviorSubject<boolean>(false);
  readonly isDarkTheme$ = this._darkTheme.asObservable();

  setTheme(isDarkTheme: boolean): void {
    this._darkTheme.next(isDarkTheme);
  }
}