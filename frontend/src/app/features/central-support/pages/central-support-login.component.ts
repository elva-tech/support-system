import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { CentralSupportAuthApiService } from '../../../core/services/central-support-auth-api.service';
import { BrandingService } from '../../../core/portal/branding.service';
import { ElvaFooterComponent } from '../../../shared/components/elva-footer/elva-footer.component';
import { ElvaHeaderComponent } from '../../../shared/components/elva-header/elva-header.component';
import { formatApiError } from '../../../shared/utils/api-error.util';

@Component({
  selector: 'app-central-support-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ElvaHeaderComponent, ElvaFooterComponent],
  template: `
    <div class="flex min-h-screen flex-col bg-gradient-to-br from-elva-950 via-elva-900 to-elva-brand">
      <app-elva-header
        [subtitle]="branding.branding().displayName"
        [tagline]="branding.branding().productName"
        [productName]="branding.branding().supportDisplayName"
        [logoUrl]="branding.branding().logoUrl || '/images/elva-logo.png'"
      />

      <main class="flex flex-1 items-center justify-center px-4 py-8">
        <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
          <div class="mb-6 text-center sm:mb-8">
            <h1 class="text-xl font-bold text-slate-900 sm:text-2xl">Central Support Sign In</h1>
            <p class="mt-2 text-sm text-slate-500">
              Sign in to ELVA Central Support operations
            </p>
          </div>

          @if (sessionExpired()) {
            <div class="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Your session ended. Please sign in again.
            </div>
          }

          @if (error()) {
            <div class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {{ error() }}
            </div>
          }

          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-4">
            <div>
              <label class="form-label" for="email">Email</label>
              <input id="email" type="email" class="form-input" formControlName="email" autocomplete="email" />
            </div>
            <div>
              <label class="form-label" for="password">Password</label>
              <input
                id="password"
                type="password"
                class="form-input"
                formControlName="password"
                autocomplete="current-password"
              />
            </div>
            <button type="submit" class="btn-primary w-full" [disabled]="form.invalid || loading()">
              {{ loading() ? 'Signing in...' : 'Sign in' }}
            </button>
          </form>
        </div>
      </main>

      <app-elva-footer variant="dark" companyName="ELVA Central Support" />
    </div>
  `
})
export class CentralSupportLoginComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(CentralSupportAuthApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly branding = inject(BrandingService);

  readonly loading = signal(false);
  readonly error = signal('');
  readonly sessionExpired = signal(false);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required]
  });

  ngOnInit(): void {
    this.branding.applyPlatformDefaults();
    this.sessionExpired.set(this.route.snapshot.queryParamMap.get('session') === 'expired');
  }

  onSubmit(): void {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set('');

    this.api.login(this.form.getRawValue()).subscribe({
      next: () => void this.router.navigateByUrl('/dashboard'),
      error: (err: HttpErrorResponse) => {
        this.error.set(formatApiError(err, 'Sign in failed'));
        this.loading.set(false);
      },
      complete: () => this.loading.set(false)
    });
  }
}
