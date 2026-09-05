import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PlatformApiService, PlatformProvisioning } from '../../../core/services/platform-api.service';
import { PlatformAuthService } from '../../../core/services/platform-auth.service';
import { formatApiError } from '../../../shared/utils/api-error.util';

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

          <h2 class="mt-8 text-sm font-semibold text-slate-900">Steps</h2>
          <ul class="mt-3 space-y-2 text-sm">
            @for (step of steps(p); track step.key) {
              <li class="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span>{{ step.label }}</span>
                <span class="font-medium">
                  {{ step.status }}
                  @if (step.error) {
                    <span class="ml-2 text-xs font-normal text-red-600">{{ step.error }}</span>
                  }
                </span>
              </li>
            }
          </ul>

          @if (p.failure?.message) {
            <div class="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Failure: {{ p.failure?.message }}
              @if (p.failure?.atStep) {
                <span> (at {{ p.failure?.atStep }})</span>
              }
            </div>
          }

          @if (canManage()) {
            <div class="mt-6 flex flex-wrap gap-3">
              <button type="button" class="btn-secondary" [disabled]="busy()" (click)="retry(p.id)">
                Retry
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

  steps(p: PlatformProvisioning): { key: string; label: string; status: string; error?: string | null }[] {
    const labels: Record<string, string> = {
      tenantCreated: 'Tenant created',
      workspaceInitialized: 'Workspace initialized',
      adminCreated: 'Admin created',
      invitationCreated: 'Invitation created',
      welcomeEmail: 'Welcome email'
    };
    return Object.entries(labels).map(([key, label]) => {
      const step = (p.steps as Record<string, { status?: string; error?: string | null }>)?.[key];
      return { key, label, status: step?.status || 'PENDING', error: step?.error };
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
