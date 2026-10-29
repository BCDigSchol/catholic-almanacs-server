import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

const STORAGE_KEY = 'almanacs-theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

@Injectable()
export class ThemeService {
  // Starts from the visitor's saved choice, else the system preference, which it
  // keeps following until the visitor picks a theme with the toggle.
  private _darkTheme = new BehaviorSubject<boolean>(ThemeService.initialDark());
  readonly isDarkTheme$ = this._darkTheme.asObservable();

  constructor() {
    const media = ThemeService.systemQuery();
    media?.addEventListener('change', e => {
      if (!ThemeService.savedChoice()) this._darkTheme.next(e.matches);
    });
  }

  setTheme(isDarkTheme: boolean): void {
    this._darkTheme.next(isDarkTheme);
    try {
      localStorage.setItem(STORAGE_KEY, isDarkTheme ? 'dark' : 'light');
    } catch { /* storage unavailable: the choice lasts for this visit only */ }
  }

  private static initialDark(): boolean {
    const saved = ThemeService.savedChoice();
    if (saved) return saved === 'dark';
    return ThemeService.systemQuery()?.matches ?? false;
  }

  private static savedChoice(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }

  private static systemQuery(): MediaQueryList | null {
    return typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(DARK_QUERY) : null;
  }
}
