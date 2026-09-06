import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { PlatformAuthApiService } from '../../../core/services/platform-auth-api.service';
import { ElvaFooterComponent } from '../../../shared/components/elva-footer/elva-footer.component';
import { ElvaHeaderComponent } from '../../../shared/components/elva-header/elva-header.component';
import { formatApiError } from '../../../shared/utils/api-error.util';

@Component({
  selector: 'app-platform-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ElvaHeaderComponent, ElvaFooterComponent],
  template: `
    <div class="flex min-h-screen flex-col bg-gradient-to-br from-elva-950 via-elva-900 to-elva-brand">
      <app-elva-header align="center" subtitle="Platform Administration" tagline="ELVA Support PaaS" />

      <main class="flex flex-1 items-center justify-center px-4 py-8">
        <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
          <div class="mb-6 text-center sm:mb-8">
            <h1 class="text-xl font-bold text-slate-900 sm:text-2xl">Platform Sign In</h1>
            <p class="mt-2 text-sm text-slate-500">
              Sign in with your platform administrator credentials
            </p>
          </div>

          @if (sessionExpired()) {
            <div class="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Your platform session ended. Please sign in again.
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

      <app-elva-footer variant="dark" companyName="ELVA Support" />
    </div>
  `
})
export class PlatformLoginComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(PlatformAuthApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(false);
  readonly error = signal('');
  readonly sessionExpired = signal(false);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required]
  });

  ngOnInit(): void {
    const email = this.route.snapshot.queryParamMap.get('email');
    if (email) {
      this.form.patchValue({ email });
    }
    this.sessionExpired.set(this.route.snapshot.queryParamMap.get('session') === 'expired');
  }

  onSubmit(): void {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set('');

    this.api.login(this.form.getRawValue()).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: (err: HttpErrorResponse) => {
        this.error.set(formatApiError(err, 'Invalid email or password'));
        this.loading.set(false);
      },
      complete: () => this.loading.set(false)
    });
  }
}
