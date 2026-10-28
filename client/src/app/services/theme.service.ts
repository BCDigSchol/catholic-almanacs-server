import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

const STORAGE_KEY = 'almanacs-theme';

@Injectable()
export class ThemeService {
  // Starts from the visitor's saved choice, else light. (Following the system
  // preference waits until every page has been checked in dark mode.)
  private _darkTheme = new BehaviorSubject<boolean>(ThemeService.initialDark());
  readonly isDarkTheme$ = this._darkTheme.asObservable();

  setTheme(isDarkTheme: boolean): void {
    this._darkTheme.next(isDarkTheme);
    try {
      localStorage.setItem(STORAGE_KEY, isDarkTheme ? 'dark' : 'light');
    } catch { /* storage unavailable: the choice lasts for this visit only */ }
  }

  private static initialDark(): boolean {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return saved === 'dark';
    } catch { /* storage unavailable: default to light */ }
    return false;
  }
}
