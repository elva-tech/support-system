import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  InvitationValidation,
  OnboardingApiService
} from '../../core/services/onboarding-api.service';
import { BrandingService } from '../../core/portal/branding.service';
import { ElvaFooterComponent } from '../../shared/components/elva-footer/elva-footer.component';
import { ElvaHeaderComponent } from '../../shared/components/elva-header/elva-header.component';
import { formatApiError } from '../../shared/utils/api-error.util';

@Component({
  selector: 'app-setup-account',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, ElvaHeaderComponent, ElvaFooterComponent],
  template: `
    <div class="flex min-h-screen flex-col bg-gradient-to-br from-elva-950 via-elva-900 to-elva-brand">
      <app-elva-header
        align="center"
        [subtitle]="branding.branding().displayName || 'Account setup'"
        [productName]="branding.branding().productName"
        [tagline]="branding.branding().supportDisplayName || 'Activate your workspace account'"
        [logoUrl]="branding.branding().logoUrl || '/images/elva-logo.png'"
      />

      <main class="flex flex-1 items-center justify-center px-4 py-8">
        <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
          @if (loadingInvite()) {
            <p class="text-center text-sm text-slate-500">Validating invitation…</p>
          } @else if (!invite()?.valid) {
            <div class="text-center">
              <h1 class="text-xl font-bold text-slate-900">Invitation unavailable</h1>
              <p class="mt-3 text-sm text-slate-600">
                This invitation is invalid, expired, revoked, or already used.
              </p>
              <a routerLink="/auth/login" class="btn-primary mt-6 inline-flex">Go to sign in</a>
            </div>
          } @else if (done()) {
            <div class="text-center">
              <h1 class="text-xl font-bold text-slate-900">Account ready</h1>
              <p class="mt-3 text-sm text-slate-600">
                Your password is set. You can sign in to your workspace.
              </p>
              <a routerLink="/auth/login" class="btn-primary mt-6 inline-flex">Sign in</a>
            </div>
          } @else {
            <div class="mb-6 text-center">
              <h1 class="text-xl font-bold text-slate-900">Set your password</h1>
              <p class="mt-2 text-sm text-slate-500">
                {{
                  invite()?.invitationType === 'STAFF'
                    ? 'Complete setup for your staff account'
                    : 'Complete setup for your administrator account'
                }}
              </p>
            </div>

            <dl class="mb-6 space-y-2 rounded-lg bg-slate-50 px-4 py-3 text-sm">
              <div class="flex justify-between gap-2">
                <dt class="text-slate-500">Organization</dt>
                <dd class="font-medium text-slate-900">{{ invite()?.tenantName }}</dd>
              </div>
              <div class="flex justify-between gap-2">
                <dt class="text-slate-500">Name</dt>
                <dd class="font-medium text-slate-900">{{ invite()?.adminName }}</dd>
              </div>
              <div class="flex justify-between gap-2">
                <dt class="text-slate-500">Email</dt>
                <dd class="font-medium text-slate-900">{{ invite()?.adminEmail }}</dd>
              </div>
              @if (invite()?.role) {
                <div class="flex justify-between gap-2">
                  <dt class="text-slate-500">Role</dt>
                  <dd class="font-medium text-slate-900">{{ invite()?.role }}</dd>
                </div>
              }
            </dl>

            @if (error()) {
              <div class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {{ error() }}
              </div>
            }

            <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-4">
              <div>
                <label class="form-label" for="password">Password</label>
                <input id="password" type="password" class="form-input" formControlName="password" autocomplete="new-password" />
                <p class="mt-1 text-xs text-slate-500">Minimum 8 characters</p>
              </div>
              <div>
                <label class="form-label" for="confirmPassword">Confirm password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  class="form-input"
                  formControlName="confirmPassword"
                  autocomplete="new-password"
                />
              </div>
              <button type="submit" class="btn-primary w-full" [disabled]="form.invalid || submitting()">
                {{ submitting() ? 'Saving…' : 'Activate account' }}
              </button>
            </form>
          }
        </div>
      </main>

      <app-elva-footer variant="dark" />
    </div>
  `
})
export class SetupAccountComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(OnboardingApiService);
  readonly branding = inject(BrandingService);
  private readonly fb = inject(FormBuilder);

  readonly loadingInvite = signal(true);
  readonly invite = signal<InvitationValidation | null>(null);
  readonly error = signal('');
  readonly submitting = signal(false);
  readonly done = signal(false);
  private token = '';

  readonly form = this.fb.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(128)]],
    confirmPassword: ['', Validators.required]
  });

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') || '';
    if (!this.token || this.token.length < 16) {
      this.invite.set({ valid: false });
      this.loadingInvite.set(false);
      this.branding.applyPlatformDefaults();
      return;
    }

    this.api.validateInvitation(this.token).subscribe({
      next: (res) => {
        this.invite.set(res.data);
        this.loadingInvite.set(false);
        if (res.data?.valid && res.data.branding) {
          this.branding.applyInvitationBranding(res.data.branding);
        } else if (res.data?.valid) {
          this.branding.applyInvitationBranding({
            organizationName: res.data.tenantName,
            supportDisplayName: res.data.tenantName
              ? `${res.data.tenantName} Support`
              : undefined
          });
        } else {
          this.branding.applyPlatformDefaults();
        }
      },
      error: () => {
        this.invite.set({ valid: false });
        this.loadingInvite.set(false);
        this.branding.applyPlatformDefaults();
      }
    });
  }

  onSubmit(): void {
    const { password, confirmPassword } = this.form.getRawValue();
    if (password !== confirmPassword) {
      this.error.set('Passwords do not match');
      return;
    }
    this.submitting.set(true);
    this.error.set('');
    this.api.completeSetup({ token: this.token, password, confirmPassword }).subscribe({
      next: () => {
        this.done.set(true);
        this.submitting.set(false);
      },
      error: (err) => {
        this.error.set(formatApiError(err, 'Could not complete setup'));
        this.submitting.set(false);
      }
    });
  }
}
