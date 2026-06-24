import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { MerchantApiService } from '../../services/merchant-api.service';
import { MerchantFlowService } from '../../services/merchant-flow.service';
import { ElvaFooterComponent } from '../../../shared/components/elva-footer/elva-footer.component';
import { ElvaHeaderComponent } from '../../../shared/components/elva-header/elva-header.component';

@Component({
  selector: 'app-merchant-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, ElvaHeaderComponent, ElvaFooterComponent],
  template: `
    <div class="flex min-h-screen flex-col bg-gradient-to-br from-elva-950 via-elva-900 to-elva-brand">
      <app-elva-header align="center" subtitle="Merchant Sign In" [showTitle]="true" />

      <main class="flex flex-1 items-center justify-center px-4 py-8">
        <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
          <div class="mb-6 text-center sm:mb-8">
            <h1 class="text-xl font-bold text-slate-900 sm:text-2xl">Welcome back</h1>
            <p class="mt-2 text-sm text-slate-500">Enter your registered email to receive an OTP</p>
          </div>

          @if (error()) {
            <div class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {{ error() }}
            </div>
          }

          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-4">
            <div>
              <label class="form-label" for="merchant-email">Email</label>
              <input
                id="merchant-email"
                type="email"
                class="form-input"
                formControlName="email"
                autocomplete="email"
              />
            </div>
            <button type="submit" class="btn-primary w-full" [disabled]="form.invalid || loading()">
              {{ loading() ? 'Sending OTP...' : 'Send OTP' }}
            </button>
          </form>

          <p class="mt-6 text-center text-xs text-slate-400">
            <a routerLink="/" class="text-elva-brand hover:underline">Back to home</a>
            <span class="mx-2">·</span>
            Staff member?
            <a routerLink="/auth/login" class="text-elva-brand hover:underline">Admin portal</a>
          </p>
        </div>
      </main>

      <app-elva-footer variant="dark" />
    </div>
  `
})
export class MerchantLoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(MerchantApiService);
  private readonly flow = inject(MerchantFlowService);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly error = signal('');

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]]
  });

  onSubmit(): void {
    if (this.form.invalid) return;

    this.loading.set(true);
    this.error.set('');
    const email = this.form.controls.email.value;

    this.api.requestOtp(email).subscribe({
      next: (res) => {
        this.flow.setPendingEmail(email);
        this.router.navigate(['/merchant/verify-otp'], {
          queryParams: { email },
          state: { devOtp: res.otp }
        });
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(err.error?.message || 'Failed to send OTP');
        this.loading.set(false);
      },
      complete: () => this.loading.set(false)
    });
  }
}
