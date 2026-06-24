import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { MerchantApiService } from '../../services/merchant-api.service';
import { MerchantFlowService } from '../../services/merchant-flow.service';
import { ElvaFooterComponent } from '../../../shared/components/elva-footer/elva-footer.component';
import { ElvaHeaderComponent } from '../../../shared/components/elva-header/elva-header.component';

@Component({
  selector: 'app-merchant-verify-otp',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, ElvaHeaderComponent, ElvaFooterComponent],
  template: `
    <div class="flex min-h-screen flex-col bg-gradient-to-br from-elva-950 via-elva-900 to-elva-brand">
      <app-elva-header align="center" subtitle="Verify OTP" />

      <main class="flex flex-1 items-center justify-center px-4 py-8">
        <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
          <div class="mb-6 text-center sm:mb-8">
            <h1 class="text-xl font-bold text-slate-900 sm:text-2xl">Check your email</h1>
            <p class="mt-2 text-sm text-slate-500">
              Enter the 6-digit code sent to<br />
              <span class="font-medium text-slate-700">{{ email() }}</span>
            </p>
          </div>

          @if (devOtp()) {
            <div class="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Dev OTP: <span class="font-mono font-bold">{{ devOtp() }}</span>
            </div>
          }

          @if (error()) {
            <div class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {{ error() }}
            </div>
          }

          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-4">
            <div>
              <label class="form-label" for="otp">OTP Code</label>
              <input
                id="otp"
                type="text"
                maxlength="6"
                inputmode="numeric"
                class="form-input text-center font-mono text-lg tracking-widest"
                formControlName="otpCode"
                autocomplete="one-time-code"
              />
            </div>
            <button type="submit" class="btn-primary w-full" [disabled]="form.invalid || loading()">
              {{ loading() ? 'Verifying...' : 'Verify & Sign In' }}
            </button>
          </form>

          <p class="mt-6 text-center text-sm text-slate-500">
            <a routerLink="/merchant/login" class="text-elva-brand hover:underline">Use a different email</a>
          </p>
        </div>
      </main>

      <app-elva-footer variant="dark" />
    </div>
  `
})
export class MerchantVerifyOtpComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(MerchantApiService);
  private readonly flow = inject(MerchantFlowService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly error = signal('');
  readonly email = signal('');
  readonly devOtp = signal('');

  readonly form = this.fb.nonNullable.group({
    otpCode: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]]
  });

  ngOnInit(): void {
    const queryEmail = this.route.snapshot.queryParamMap.get('email');
    const flowEmail = this.flow.pendingEmail();
    const resolved = queryEmail || flowEmail;

    if (!resolved) {
      this.router.navigate(['/merchant/login']);
      return;
    }

    this.email.set(resolved);

    const navState = history.state as { devOtp?: string };
    if (navState?.devOtp) {
      this.devOtp.set(navState.devOtp);
    }
  }

  onSubmit(): void {
    if (this.form.invalid || !this.email()) return;

    this.loading.set(true);
    this.error.set('');

    this.api.verifyOtp(this.email(), this.form.controls.otpCode.value).subscribe({
      next: () => {
        this.flow.clearPendingEmail();
        this.router.navigate(['/merchant/dashboard']);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(err.error?.message || 'Verification failed');
        this.loading.set(false);
      },
      complete: () => this.loading.set(false)
    });
  }
}
