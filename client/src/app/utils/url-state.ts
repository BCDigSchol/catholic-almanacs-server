import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Keeps a dashboard's controls in the query string, so any view can be
 * linked, bookmarked or cited. Declare the defaults once; values equal to
 * their default are left out of the URL.
 *
 *   const state = new UrlState(router, route, { entity: 'institutions', diocese: '', year: 0 });
 *   state.changes().subscribe(s => ...);  // typed values, defaults filled in
 *   state.set({ diocese: 'Boston' });     // updates the URL (replaceUrl)
 */
export class UrlState<T extends Record<string, string | number | boolean>> {
  constructor(private router: Router, private route: ActivatedRoute, private defaults: T) {}

  /** The current values, read from a param map. */
  read(params: ParamMap): T {
    const out = { ...this.defaults };
    for (const key of Object.keys(this.defaults) as (keyof T & string)[]) {
      const raw = params.get(key);
      if (raw === null) continue;
      const d = this.defaults[key];
      const value = typeof d === 'number' ? Number(raw) : typeof d === 'boolean' ? raw === 'true' : raw;
      if (typeof value === 'number' && !Number.isFinite(value)) continue;
      out[key] = value as T[typeof key];
    }
    return out;
  }

  /** Emits the typed state whenever the query string changes. */
  changes(): Observable<T> {
    return this.route.queryParamMap.pipe(map(p => this.read(p)));
  }

  /** Merges `changes` into the URL, dropping values equal to their default. */
  set(changes: Partial<T>): void {
    const current = this.read(this.route.snapshot.queryParamMap);
    const next = { ...current, ...changes };
    const queryParams: Record<string, string | number | boolean | null> = {};
    for (const key of Object.keys(this.defaults)) {
      const value = next[key];
      queryParams[key] = value === this.defaults[key] || value === '' ? null : value;
    }
    this.router.navigate([], { relativeTo: this.route, queryParams, queryParamsHandling: 'merge', replaceUrl: true });
  }
}
