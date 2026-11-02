import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { ReviewAuthService } from './review-auth.service';

/** API paths that need the editors' token (see server/utils/review-auth.js). */
const GUARDED = ['/stats/data-issues', '/auth/review'];

/**
 * Sends the editors' token with Data Issues requests only, and signs out
 * (back to the sign-in page) when the server turns it down.
 */
export const reviewAuthInterceptor: HttpInterceptorFn = (req, next) => {
  if (!GUARDED.some(p => req.url.includes(p))) return next(req);
  const auth = inject(ReviewAuthService);
  const router = inject(Router);
  const token = auth.token;
  const sent = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
  return next(sent).pipe(catchError((err: HttpErrorResponse) => {
    if (err.status === 401 && req.url.includes('/stats/data-issues')) {
      auth.rejected();
      router.navigate(['/sign-in'], { queryParams: { next: router.url } });
    }
    return throwError(() => err);
  }));
};
