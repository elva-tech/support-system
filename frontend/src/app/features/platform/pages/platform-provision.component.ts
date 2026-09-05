import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  PlatformApiService,
  PlatformProvisioning,
  WorkspaceAvailabilityResult
} from '../../../core/services/platform-api.service';
import {
  isReservedTenantSlug,
  isValidTenantSlugFormat,
  suggestTenantSlug
} from '../../../core/portal/portal-host.util';
import { environment } from '../../../../environments/environment';
import { formatApiError } from '../../../shared/utils/api-error.util';

@Component({
  selector: 'app-platform-provision',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Provision Business</h1>
        <p class="mt-1 text-sm text-slate-500">
          Create a tenant workspace, administrator invitation, and welcome email in one step.
        </p>
      </div>

      @if (error()) {
        <div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ error() }}</div>
      }

      @if (result(); as r) {
        <div
          class="rounded-xl border p-5"
          [class.border-emerald-200]="r.status === 'READY'"
          [class.bg-emerald-50]="r.status === 'READY'"
          [class.border-amber-200]="r.status === 'READY' && emailFailed(r)"
          [class.bg-amber-50]="r.status === 'READY' && emailFailed(r)"
          [class.border-red-200]="r.status === 'FAILED'"
          [class.bg-red-50]="r.status === 'FAILED'"
        >
          <h2 class="text-lg font-semibold text-slate-900">
            {{ r.status === 'FAILED' ? 'Provisioning failed' : 'Provisioning completed' }}
          </h2>
          <p class="mt-1 text-sm text-slate-600">Overall status: <strong>{{ r.status }}</strong></p>
          @if (emailFailed(r)) {
            <p class="mt-2 text-sm text-amber-800">
              Core onboarding succeeded, but the welcome email did not send. You can resend from provisioning status.
            </p>
          }
          <ul class="mt-4 space-y-2 text-sm">
            @for (step of stepEntries(r); track step.key) {
              <li class="flex justify-between gap-3">
                <span>{{ step.label }}</span>
                <span class="font-medium">{{ step.status }}</span>
              </li>
            }
          </ul>
          <p class="mt-4 text-sm">
            Workspace:
            <a class="font-medium text-elva-brand hover:underline" [href]="r.workspaceUrl" target="_blank" rel="noopener">
              {{ r.workspaceUrl }}
            </a>
          </p>
          <div class="mt-4 flex flex-wrap gap-3">
            <a [routerLink]="['/provisionings', r.id]" class="btn-primary">View provisioning</a>
            <a routerLink="/tenants" class="btn-secondary">Businesses</a>
            <button type="button" class="btn-secondary" (click)="resetForm()">Provision another</button>
          </div>
        </div>
      } @else {
        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <label class="form-label" for="name">Business name</label>
            <input id="name" class="form-input" formControlName="name" (blur)="onNameBlur()" />
          </div>
          <div>
            <label class="form-label" for="slug">Tenant slug</label>
            <input id="slug" class="form-input" formControlName="slug" (input)="onSlugChange()" />
            <p class="mt-1 text-xs text-slate-500">
              Workspace URL:
              <span class="font-medium text-slate-700">{{ previewWorkspaceUrl() }}</span>
            </p>
            @if (slugError()) {
              <p class="mt-1 text-xs text-red-600">{{ slugError() }}</p>
            }
            <div class="mt-3">
              <button
                type="button"
                class="btn-secondary"
                [disabled]="!!slugError() || !form.controls.slug.value || checkingAvailability()"
                (click)="checkAvailability()"
              >
                {{ checkingAvailability() ? 'Checking…' : 'Check Availability & Prepare Workspace' }}
              </button>
            </div>
            @if (availability(); as a) {
              <ul class="mt-3 space-y-1 text-sm" [class.text-emerald-700]="a.available" [class.text-red-700]="!a.available">
                @for (c of a.checks; track c.key) {
                  <li>{{ c.ok ? '✓' : '❌' }} {{ c.message }}</li>
                }
              </ul>
              @if (a.available && a.workspaceUrl) {
                <p class="mt-2 text-sm font-medium text-emerald-800">
                  Workspace ready: {{ a.workspaceUrl }}
                </p>
              }
            }
          </div>
          <div>
            <label class="form-label" for="status">Initial status</label>
            <select id="status" class="form-input" formControlName="status">
              <option value="ACTIVE">ACTIVE</option>
              <option value="TRIAL">TRIAL</option>
            </select>
          </div>
          <div>
            <label class="form-label" for="adminName">Tenant admin name</label>
            <input id="adminName" class="form-input" formControlName="adminName" />
          </div>
          <div>
            <label class="form-label" for="adminEmail">Tenant admin email</label>
            <input id="adminEmail" type="email" class="form-input" formControlName="adminEmail" />
          </div>
          <button
            type="submit"
            class="btn-primary"
            [disabled]="form.invalid || !!slugError() || !availabilityReady() || loading()"
          >
            {{ loading() ? 'Provisioning…' : 'Provision business' }}
          </button>
          @if (!availabilityReady() && form.controls.slug.value && !slugError()) {
            <p class="text-xs text-amber-700">Run availability check before provisioning.</p>
          }
        </form>
      }
    </div>
  `
})
export class PlatformProvisionComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(PlatformApiService);

  readonly loading = signal(false);
  readonly checkingAvailability = signal(false);
  readonly error = signal('');
  readonly result = signal<PlatformProvisioning | null>(null);
  readonly availability = signal<WorkspaceAvailabilityResult | null>(null);
  private slugTouched = false;
  private validatedSlug: string | null = null;

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    slug: ['', Validators.required],
    status: ['ACTIVE' as 'ACTIVE' | 'TRIAL'],
    adminName: ['', [Validators.required, Validators.maxLength(200)]],
    adminEmail: ['', [Validators.required, Validators.email]]
  });

  constructor() {
    this.form.controls.slug.valueChanges.subscribe(() => {
      this.slugTouched = true;
    });
  }

  previewWorkspaceUrl(): string {
    const slug = (this.form.controls.slug.value || 'slug').trim().toLowerCase() || 'slug';
    const protocol = environment.production ? 'https' : 'https';
    return `${protocol}://${slug}.${environment.tenantBaseDomain}`;
  }

  slugError(): string {
    const slug = this.form.controls.slug.value.trim().toLowerCase();
    if (!slug) return '';
    if (isReservedTenantSlug(slug)) return `Slug "${slug}" is reserved`;
    if (!isValidTenantSlugFormat(slug)) {
      return 'Use lowercase letters, numbers, and hyphens only';
    }
    return '';
  }

  onSlugChange(): void {
    this.availability.set(null);
    this.validatedSlug = null;
  }

  availabilityReady(): boolean {
    const slug = this.form.controls.slug.value.trim().toLowerCase();
    const a = this.availability();
    return Boolean(a?.available && this.validatedSlug === slug);
  }

  checkAvailability(): void {
    const slug = this.form.controls.slug.value.trim().toLowerCase();
    this.form.controls.slug.setValue(slug);
    if (!slug || this.slugError()) return;

    this.checkingAvailability.set(true);
    this.error.set('');
    this.api.checkSlugAvailability(slug).subscribe({
      next: (res) => {
        this.availability.set(res.data);
        this.validatedSlug = res.data.available ? res.data.slug : null;
        this.checkingAvailability.set(false);
      },
      error: (err) => {
        if (err?.error?.data) {
          this.availability.set(err.error.data);
          this.validatedSlug = null;
        } else {
          this.error.set(formatApiError(err, 'Availability check failed'));
        }
        this.checkingAvailability.set(false);
      }
    });
  }

  onNameBlur(): void {
    if (this.slugTouched && this.form.controls.slug.value) return;
    const suggested = suggestTenantSlug(this.form.controls.name.value);
    if (suggested) {
      this.form.patchValue({ slug: suggested });
      this.onSlugChange();
    }
  }

  emailFailed(r: PlatformProvisioning): boolean {
    return r.steps?.welcomeEmail?.status === 'FAILED';
  }

  stepEntries(r: PlatformProvisioning): { key: string; label: string; status: string }[] {
    const map: Record<string, string> = {
      tenantCreated: 'Tenant created',
      workspaceInitialized: 'Workspace initialized',
      adminCreated: 'Admin created',
      invitationCreated: 'Invitation created',
      welcomeEmail: 'Welcome email'
    };
    return Object.entries(map).map(([key, label]) => ({
      key,
      label,
      status: (r.steps as Record<string, { status?: string }>)?.[key]?.status || 'PENDING'
    }));
  }

  resetForm(): void {
    this.result.set(null);
    this.error.set('');
    this.availability.set(null);
    this.validatedSlug = null;
    this.form.reset({ status: 'ACTIVE', name: '', slug: '', adminName: '', adminEmail: '' });
    this.slugTouched = false;
  }

  onSubmit(): void {
    this.form.controls.slug.setValue(this.form.controls.slug.value.trim().toLowerCase());
    this.slugTouched = true;
    if (this.form.invalid || this.slugError() || !this.availabilityReady()) return;

    this.loading.set(true);
    this.error.set('');
    const v = this.form.getRawValue();

    this.api
      .provisionTenant({
        tenant: { name: v.name.trim(), slug: v.slug.trim().toLowerCase(), status: v.status },
        admin: { name: v.adminName.trim(), email: v.adminEmail.trim() }
      })
      .subscribe({
        next: (res) => {
          this.result.set(res.data);
          this.loading.set(false);
        },
        error: (err) => {
          if (err?.error?.data?.id) {
            this.result.set(err.error.data);
          } else {
            this.error.set(formatApiError(err, 'Provisioning failed'));
          }
          this.loading.set(false);
        }
      });
  }
}
