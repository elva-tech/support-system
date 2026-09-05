import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import {
  WorkspaceApiService,
  WorkspaceSetup,
  WorkspaceSettings
} from '../../core/services/workspace-api.service';
import { BrandingService } from '../../core/portal/branding.service';
import { formatApiError } from '../../shared/utils/api-error.util';

type SetupStepId =
  | 'organization'
  | 'branding'
  | 'team'
  | 'application'
  | 'users'
  | 'client'
  | 'done';

interface ChecklistItem {
  id: Exclude<SetupStepId, 'done'>;
  label: string;
  optional?: boolean;
}

@Component({
  selector: 'app-workspace-setup',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Set up your support workspace</h1>
        <p class="mt-1 text-sm text-slate-500">
          Complete these steps to start receiving and handling support tickets. You can leave and
          resume anytime.
        </p>
      </div>

      @if (error()) {
        <div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {{ error() }}
        </div>
      }
      @if (success()) {
        <div class="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {{ success() }}
        </div>
      }

      @if (setup(); as s) {
        <div class="card">
          <p class="text-sm font-medium text-slate-700">
            Progress: {{ s.progress?.completed || 0 }} / {{ s.progress?.total || 6 }}
          </p>
          <div class="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              class="h-full bg-elva-brand transition-all"
              [style.width.%]="progressPercent(s)"
            ></div>
          </div>
          <ol class="mt-4 grid gap-2 sm:grid-cols-2">
            @for (item of checklist; track item.id) {
              <li class="flex items-center gap-2 text-sm">
                <span
                  class="inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold"
                  [class.bg-elva-100]="s.steps[item.id]"
                  [class.text-elva-800]="s.steps[item.id]"
                  [class.bg-slate-100]="!s.steps[item.id]"
                  [class.text-slate-500]="!s.steps[item.id]"
                >
                  {{ s.steps[item.id] ? '✓' : '○' }}
                </span>
                <button type="button" class="text-left hover:underline" (click)="goTo(item.id)">
                  {{ item.label }}
                  @if (item.optional) {
                    <span class="text-xs text-slate-400">(optional)</span>
                  }
                </button>
              </li>
            }
          </ol>
        </div>
      }

      @if (step() === 'organization') {
        <form class="card space-y-4" [formGroup]="orgForm" (ngSubmit)="saveOrganization()">
          <h2 class="text-lg font-semibold text-slate-900">1. Organization details</h2>
          <div>
            <label class="form-label">Organization display name</label>
            <input class="form-input" formControlName="displayName" />
          </div>
          <div>
            <label class="form-label">Support contact email</label>
            <input class="form-input" type="email" formControlName="supportEmail" />
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label class="form-label">Primary contact name</label>
              <input class="form-input" formControlName="primaryContactName" />
            </div>
            <div>
              <label class="form-label">Phone</label>
              <input class="form-input" formControlName="phone" />
            </div>
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label class="form-label">Website</label>
              <input class="form-input" formControlName="website" placeholder="https://" />
            </div>
            <div>
              <label class="form-label">Timezone</label>
              <input class="form-input" formControlName="timezone" placeholder="Asia/Kolkata" />
            </div>
          </div>
          <div class="flex flex-wrap gap-3">
            <button type="submit" class="btn-primary" [disabled]="orgForm.invalid || saving()">
              {{ saving() ? 'Saving...' : 'Save & continue' }}
            </button>
            <a routerLink="/dashboard" class="btn-secondary">Go to dashboard</a>
          </div>
        </form>
      }

      @if (step() === 'branding') {
        <form class="card space-y-4" [formGroup]="brandForm" (ngSubmit)="saveBranding()">
          <h2 class="text-lg font-semibold text-slate-900">2. Branding</h2>
          <p class="text-sm text-slate-500">
            Support display name appears in outbound emails as
            <em>Your Name &lt;support@elvatech.in&gt;</em>.
          </p>
          <div>
            <label class="form-label">Support display name</label>
            <input class="form-input" formControlName="supportDisplayName" placeholder="ABC Support" />
          </div>
          <div>
            <label class="form-label">Primary color (optional)</label>
            <input class="form-input" formControlName="primaryColor" placeholder="#1a73e8" />
          </div>
          <div>
            <label class="form-label">Logo (PNG, JPEG, or WebP, max 2MB)</label>
            <input type="file" class="form-input" accept=".png,.jpg,.jpeg,.webp" (change)="onLogoSelected($event)" />
          </div>
          <div class="flex flex-wrap gap-3">
            <button type="submit" class="btn-primary" [disabled]="saving()">
              {{ saving() ? 'Saving...' : 'Save & continue' }}
            </button>
            <button type="button" class="btn-secondary" (click)="skip('branding')" [disabled]="saving()">
              Skip for now
            </button>
          </div>
        </form>
      }

      @if (step() === 'team') {
        <div class="card space-y-4">
          <h2 class="text-lg font-semibold text-slate-900">3. Create a team</h2>
          <p class="text-sm text-slate-600">
            Support tickets are routed to teams. Create your first support team, then return here.
          </p>
          @if (setup()?.steps?.team) {
            <p class="text-sm text-elva-800">Team step complete.</p>
            <button type="button" class="btn-primary" (click)="goTo('application')">Continue</button>
          } @else {
            <a routerLink="/teams" class="btn-primary inline-flex">Open Teams</a>
            <button type="button" class="btn-secondary" (click)="reload()">I've created a team — refresh</button>
          }
        </div>
      }

      @if (step() === 'application') {
        <div class="card space-y-4">
          <h2 class="text-lg font-semibold text-slate-900">4. Create an application / product</h2>
          <p class="text-sm text-slate-600">
            Applications represent products your clients get support for (e.g. Website, Mobile App).
          </p>
          @if (setup()?.steps?.application) {
            <p class="text-sm text-elva-800">Application step complete.</p>
            <button type="button" class="btn-primary" (click)="goTo('users')">Continue</button>
          } @else {
            <a routerLink="/applications" class="btn-primary inline-flex">Open Applications</a>
            <button type="button" class="btn-secondary" (click)="reload()">I've created an application — refresh</button>
          }
        </div>
      }

      @if (step() === 'users') {
        <div class="card space-y-4">
          <h2 class="text-lg font-semibold text-slate-900">5. Add team members</h2>
          <p class="text-sm text-slate-600">
            Invite agents and team leads so they can work tickets. You can add them later.
          </p>
          @if (setup()?.steps?.users) {
            <p class="text-sm text-elva-800">Users step complete.</p>
            <button type="button" class="btn-primary" (click)="goTo('client')">Continue</button>
          } @else {
            <a routerLink="/users" class="btn-primary inline-flex">Open Users</a>
            <button type="button" class="btn-secondary" (click)="skip('users')" [disabled]="saving()">
              Skip for now
            </button>
            <button type="button" class="btn-secondary" (click)="reload()">Refresh status</button>
          }
        </div>
      }

      @if (step() === 'client') {
        <div class="card space-y-4">
          <h2 class="text-lg font-semibold text-slate-900">6. Add your first client (optional)</h2>
          <p class="text-sm text-slate-600">
            Register a client email so they can sign in with OTP and create tickets.
          </p>
          @if (setup()?.steps?.client) {
            <p class="text-sm text-elva-800">Client step complete.</p>
            <button type="button" class="btn-primary" (click)="goTo('done')">Finish</button>
          } @else {
            <a routerLink="/merchants" class="btn-primary inline-flex">Open Clients</a>
            <button type="button" class="btn-secondary" (click)="skip('client')" [disabled]="saving()">
              Skip for now
            </button>
          }
        </div>
      }

      @if (step() === 'done') {
        <div class="card space-y-4 text-center">
          <h2 class="text-lg font-semibold text-slate-900">Workspace ready</h2>
          <p class="text-sm text-slate-600">
            Required setup is complete. You can keep refining branding, teams, and clients anytime
            from Settings.
          </p>
          <a routerLink="/dashboard" class="btn-primary inline-flex">Go to dashboard</a>
        </div>
      }
    </div>
  `
})
export class WorkspaceSetupComponent implements OnInit {
  private readonly api = inject(WorkspaceApiService);
  private readonly branding = inject(BrandingService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  readonly setup = signal<WorkspaceSetup | null>(null);
  readonly settings = signal<WorkspaceSettings | null>(null);
  readonly step = signal<SetupStepId>('organization');
  readonly error = signal('');
  readonly success = signal('');
  readonly saving = signal(false);
  private logoFile: File | null = null;

  readonly checklist: ChecklistItem[] = [
    { id: 'organization', label: 'Organization details' },
    { id: 'branding', label: 'Branding', optional: true },
    { id: 'team', label: 'Create a team' },
    { id: 'application', label: 'Create an application' },
    { id: 'users', label: 'Add team members', optional: true },
    { id: 'client', label: 'Add first client', optional: true }
  ];

  readonly orgForm = this.fb.nonNullable.group({
    displayName: ['', [Validators.required, Validators.maxLength(200)]],
    supportEmail: ['', [Validators.required, Validators.email]],
    primaryContactName: [''],
    phone: [''],
    website: [''],
    timezone: [''],
    country: ['']
  });

  readonly brandForm = this.fb.nonNullable.group({
    supportDisplayName: ['', [Validators.maxLength(120)]],
    primaryColor: ['']
  });

  ngOnInit(): void {
    this.reload();
  }

  progressPercent(s: WorkspaceSetup): number {
    const total = s.progress?.total || 6;
    const completed = s.progress?.completed || 0;
    return Math.round((completed / total) * 100);
  }

  reload(): void {
    this.error.set('');
    this.api.getSettings().subscribe({
      next: (res) => {
        this.settings.set(res.data);
        this.setup.set(res.data.setup);
        const org = res.data.organization || {};
        this.orgForm.patchValue({
          displayName: org.displayName || org.name || res.data.tenant.name || '',
          supportEmail: org.supportEmail || '',
          primaryContactName: org.primaryContactName || '',
          phone: org.phone || '',
          website: org.website || '',
          timezone: org.timezone || '',
          country: org.country || ''
        });
        this.brandForm.patchValue({
          supportDisplayName: res.data.branding?.supportDisplayName || '',
          primaryColor: res.data.branding?.primaryColor || ''
        });
        this.step.set(this.nextIncompleteStep(res.data.setup));
      },
      error: (err: HttpErrorResponse) => this.error.set(formatApiError(err))
    });
  }

  goTo(id: SetupStepId): void {
    this.step.set(id);
    this.success.set('');
    this.error.set('');
  }

  nextIncompleteStep(setup: WorkspaceSetup): SetupStepId {
    if (setup.status === 'COMPLETED') {
      return 'done';
    }
    for (const item of this.checklist) {
      if (!setup.steps[item.id]) {
        return item.id;
      }
    }
    return 'done';
  }

  saveOrganization(): void {
    if (this.orgForm.invalid) return;
    this.saving.set(true);
    this.error.set('');
    this.api.updateOrganization(this.orgForm.getRawValue()).subscribe({
      next: (res) => {
        this.setup.set(res.data.setup);
        this.success.set('Organization saved');
        this.saving.set(false);
        this.goTo(this.nextIncompleteStep(res.data.setup));
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(formatApiError(err));
        this.saving.set(false);
      }
    });
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.logoFile = input.files?.[0] || null;
  }

  saveBranding(): void {
    this.saving.set(true);
    this.error.set('');
    const payload = this.brandForm.getRawValue();
    this.api
      .updateBranding({
        supportDisplayName: payload.supportDisplayName,
        primaryColor: payload.primaryColor || null
      })
      .subscribe({
        next: (res) => {
          const finish = (setup: WorkspaceSetup) => {
            this.setup.set(setup);
            this.branding.refreshTenantBranding();
            this.success.set('Branding saved');
            this.saving.set(false);
            this.goTo(this.nextIncompleteStep(setup));
          };

          if (this.logoFile) {
            this.api.uploadLogo(this.logoFile).subscribe({
              next: (logoRes) => finish(logoRes.data.setup),
              error: (err: HttpErrorResponse) => {
                this.error.set(formatApiError(err));
                this.saving.set(false);
                finish(res.data.setup);
              }
            });
          } else {
            finish(res.data.setup);
          }
        },
        error: (err: HttpErrorResponse) => {
          this.error.set(formatApiError(err));
          this.saving.set(false);
        }
      });
  }

  skip(step: 'branding' | 'users' | 'client'): void {
    this.saving.set(true);
    this.api.skipStep(step).subscribe({
      next: (res) => {
        this.setup.set(res.data);
        this.saving.set(false);
        this.goTo(this.nextIncompleteStep(res.data));
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(formatApiError(err));
        this.saving.set(false);
      }
    });
  }
}
