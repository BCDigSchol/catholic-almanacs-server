import { Component, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import { PageHeaderComponent } from '../common/page-header/page-header.component';
import { ReviewAuthService } from '../../services/review-auth.service';

/**
 * The editors' sign-in: one shared password opens the Data Issues page in
 * this browser for 30 days (services/review-auth.service.ts).
 */
@Component({
  selector: 'app-sign-in',
  imports: [FormsModule, RouterLink, PageHeaderComponent],
  templateUrl: './sign-in.component.html',
  styleUrl: './sign-in.component.scss'
})
export class SignInComponent implements OnDestroy {
  password = '';
  error = '';
  busy = false;
  private sub?: Subscription;

  constructor(readonly auth: ReviewAuthService, private router: Router, private route: ActivatedRoute) {}

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  submit(): void {
    if (!this.password || this.busy) return;
    this.busy = true;
    this.error = '';
    this.sub = this.auth.signIn(this.password).subscribe({
      next: () => {
        this.busy = false;
        this.password = '';
        const next = this.route.snapshot.queryParamMap.get('next');
        this.router.navigateByUrl(next && next.startsWith('/') ? next : '/dashboards/data-issues');
      },
      error: err => {
        this.busy = false;
        this.error = err?.error?.message || 'Signing in did not work; try again.';
      },
    });
  }

  signOut(): void {
    this.auth.signOut();
  }
}
