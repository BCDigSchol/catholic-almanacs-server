import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, map, tap } from 'rxjs';

import { Settings } from '../app.settings';

const STORE = 'almanacs.reviewToken';

/**
 * The editors' sign-in for the Data Issues page: a shared password exchanged
 * at POST /api/auth/review for a signed token (30 days), kept in this browser.
 * The server checks the token on every Data Issues request, so hiding the
 * page here is only for tidiness; the data stays closed without it.
 */
@Injectable({ providedIn: 'root' })
export class ReviewAuthService {
  // a private window may refuse storage: the sign-in then lasts until the page reloads
  private memory: { token: string; expires: number } | null = null;
  private readonly signedIn = new BehaviorSubject<boolean>(this.read() !== null);
  /** Whether this browser holds an unexpired token. */
  readonly signedIn$ = this.signedIn.asObservable();

  constructor(private http: HttpClient) {}

  get isSignedIn(): boolean { return this.signedIn.value; }

  /** The token to send, or null. */
  get token(): string | null { return this.read()?.token ?? null; }

  signIn(password: string): Observable<void> {
    return this.http.post<{ token: string; expires: number }>(`${Settings.apiUrl.replace(/\/$/, '')}/auth/review`, { password }).pipe(
      tap(res => {
        try { localStorage.setItem(STORE, JSON.stringify(res)); } catch { /* kept for this page only */ }
        this.memory = res;
        this.signedIn.next(true);
      }),
      map(() => undefined),
    );
  }

  signOut(): void {
    try { localStorage.removeItem(STORE); } catch { /* nothing kept */ }
    this.memory = null;
    this.signedIn.next(false);
  }

  /** Called when the server turns a token down (expired, or the password changed). */
  rejected(): void {
    if (this.isSignedIn) this.signOut();
  }

  private read(): { token: string; expires: number } | null {
    let stored = this.memory;
    try { stored = JSON.parse(localStorage.getItem(STORE) ?? 'null') ?? this.memory; } catch { /* use memory */ }
    return stored && stored.expires > Date.now() ? stored : null;
  }
}
