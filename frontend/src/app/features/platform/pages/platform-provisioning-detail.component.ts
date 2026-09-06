import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PlatformApiService, PlatformProvisioning } from '../../../core/services/platform-api.service';
import { PlatformAuthService } from '../../../core/services/platform-auth.service';
import { formatApiError } from '../../../shared/utils/api-error.util';
import {
  normalizeStepError,
  suggestedActionForCode
} from '../../../shared/utils/provisioning-error.util';

@Component({
  selector: 'app-platform-provisioning-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="mx-auto max-w-3xl space-y-6">
      <a routerLink="/provisionings" class="text-sm text-elva-brand hover:underline">← Back to list</a>

      @if (error()) {
        <div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ error() }}</div>
      }
      @if (message()) {
        <div class="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {{ message() }}
        </div>
      }

      @if (item(); as p) {
        <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 class="text-2xl font-bold text-slate-900">{{ p.tenantName }}</h1>
          <p class="mt-1 text-sm text-slate-500">{{ p.tenantSlug }} · {{ p.status }}</p>

          <dl class="mt-6 grid gap-4 sm:grid-cols-2 text-sm">
            <div>
              <dt class="text-xs uppercase text-slate-400">Admin</dt>
              <dd class="mt-1 font-medium">{{ p.tenantAdminName }} &lt;{{ p.tenantAdminEmail }}&gt;</dd>
            </div>
            <div>
              <dt class="text-xs uppercase text-slate-400">Workspace</dt>
              <dd class="mt-1">
                <a class="text-elva-brand hover:underline" [href]="p.workspaceUrl" target="_blank" rel="noopener">
                  {{ p.workspaceUrl }}
                </a>
              </dd>
            </div>
            <div>
              <dt class="text-xs uppercase text-slate-400">Created</dt>
              <dd class="mt-1">{{ p.createdAt | date: 'medium' }}</dd>
            </div>
            <div>
              <dt class="text-xs uppercase text-slate-400">Completed</dt>
              <dd class="mt-1">{{ p.completedAt ? (p.completedAt | date: 'medium') : '—' }}</dd>
            </div>
          </dl>

          @if (p.failure?.message) {
            <div class="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <p class="font-semibold">{{ failureTitle(p) }}</p>
              <p class="mt-2"><span class="font-medium">Reason:</span> {{ p.failure?.message }}</p>
              @if (p.failure?.code) {
                <p class="mt-1 text-xs">
                  <span class="font-medium">Technical details:</span> {{ p.failure?.code }}
                </p>
              }
              <p class="mt-2 text-slate-700">
                <span class="font-medium">Suggested action:</span>
                {{ suggestedActionForCode(p.failure?.code, p.failure?.message || '') }}
              </p>
            </div>
          }

          <h2 class="mt-8 text-sm font-semibold text-slate-900">Steps</h2>
          <ul class="mt-3 space-y-2 text-sm">
            @for (step of steps(p); track step.key) {
              <li class="rounded-lg bg-slate-50 px-3 py-2">
                <div class="flex justify-between gap-3">
                  <span>{{ step.label }}</span>
                  <span class="font-medium">{{ step.status }}</span>
                </div>
                @if (step.errorView; as ev) {
                  <details class="mt-2 text-xs text-red-700">
                    <summary class="cursor-pointer font-medium">Error details</summary>
                    <p class="mt-1">{{ ev.message }}</p>
                    @if (ev.code) {
                      <p class="mt-1">Code: {{ ev.code }}</p>
                    }
                    @if (ev.technicalDetails) {
                      <p class="mt-1">{{ ev.technicalDetails }}</p>
                    }
                    @if (ev.failedAt) {
                      <p class="mt-1 text-slate-500">Failed at: {{ ev.failedAt }}</p>
                    }
                  </details>
                }
              </li>
            }
          </ul>

          @if (canManage()) {
            <div class="mt-6 flex flex-wrap gap-3">
              <button type="button" class="btn-secondary" [disabled]="busy()" (click)="retry(p.id)">
                Retry failed step
              </button>
              <button type="button" class="btn-primary" [disabled]="busy()" (click)="resend(p.id)">
                Resend invitation
              </button>
            </div>
          }
        </div>
      } @else if (!error()) {
        <p class="text-sm text-slate-500">Loading…</p>
      }
    </div>
  `
})
export class PlatformProvisioningDetailComponent implements OnInit {
  private readonly api = inject(PlatformApiService);
  private readonly auth = inject(PlatformAuthService);
  private readonly route = inject(ActivatedRoute);

  readonly item = signal<PlatformProvisioning | null>(null);
  readonly error = signal('');
  readonly message = signal('');
  readonly busy = signal(false);
  readonly suggestedActionForCode = suggestedActionForCode;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('Missing provisioning id');
      return;
    }
    this.load(id);
  }

  canManage(): boolean {
    return this.auth.hasRole('PLATFORM_SUPER_ADMIN', 'PLATFORM_ADMIN');
  }

  failureTitle(p: PlatformProvisioning): string {
    const map: Record<string, string> = {
      tenantCreated: 'Tenant creation failed',
      workspaceInitialized: 'Workspace initialization failed',
      adminCreated: 'Admin creation failed',
      invitationCreated: 'Invitation creation failed',
      welcomeEmail: 'Welcome email failed'
    };
    return map[p.failure?.atStep || ''] || 'Provisioning failed';
  }

  steps(p: PlatformProvisioning): {
    key: string;
    label: string;
    status: string;
    errorView: ReturnType<typeof normalizeStepError>;
  }[] {
    const labels: Record<string, string> = {
      tenantCreated: 'Tenant created',
      workspaceInitialized: 'Workspace initialized',
      adminCreated: 'Admin created',
      invitationCreated: 'Invitation created',
      welcomeEmail: 'Welcome email'
    };
    return Object.entries(labels).map(([key, label]) => {
      const step = (p.steps as Record<string, { status?: string; error?: unknown }>)?.[key];
      return {
        key,
        label,
        status: step?.status || 'PENDING',
        errorView: normalizeStepError(step?.error)
      };
    });
  }

  load(id: string): void {
    this.api.getProvisioning(id).subscribe({
      next: (res) => this.item.set(res.data),
      error: (err) => this.error.set(formatApiError(err))
    });
  }

  retry(id: string): void {
    this.busy.set(true);
    this.message.set('');
    this.error.set('');
    this.api.retryProvisioning(id).subscribe({
      next: (res) => {
        this.item.set(res.data);
        this.message.set('Retry completed');
        this.busy.set(false);
      },
      error: (err) => {
        this.error.set(formatApiError(err));
        this.busy.set(false);
      }
    });
  }

  resend(id: string): void {
    this.busy.set(true);
    this.message.set('');
    this.error.set('');
    this.api.resendInvitation(id).subscribe({
      next: (res) => {
        this.item.set(res.data);
        this.message.set('Invitation resent');
        this.busy.set(false);
      },
      error: (err) => {
        this.error.set(formatApiError(err));
        this.busy.set(false);
      }
    });
  }
}
