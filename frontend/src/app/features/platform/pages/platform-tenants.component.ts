import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PlatformApiService, PlatformTenant } from '../../../core/services/platform-api.service';
import { PlatformAuthService } from '../../../core/services/platform-auth.service';
import { environment } from '../../../../environments/environment';
import { formatApiError } from '../../../shared/utils/api-error.util';

@Component({
  selector: 'app-platform-tenants',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="space-y-6">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">Businesses</h1>
          <p class="mt-1 text-sm text-slate-500">Tenant workspaces on the platform</p>
        </div>
        @if (canManage()) {
          <a routerLink="/provision" class="btn-primary">Provision business</a>
        }
      </div>

      <div class="flex flex-wrap gap-3">
        <input
          class="form-input max-w-xs"
          placeholder="Search name or slug"
          [(ngModel)]="search"
          (keyup.enter)="load()"
        />
        <select class="form-input max-w-[10rem]" [(ngModel)]="statusFilter" (change)="load()">
          <option value="">All statuses</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="TRIAL">TRIAL</option>
          <option value="SUSPENDED">SUSPENDED</option>
          <option value="CANCELLED">CANCELLED</option>
          <option value="ARCHIVED">ARCHIVED</option>
        </select>
        <button type="button" class="btn-secondary" (click)="load()" [disabled]="loading()">Refresh</button>
      </div>

      @if (error()) {
        <div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ error() }}</div>
      }
      @if (message()) {
        <div class="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {{ message() }}
        </div>
      }

      <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table class="min-w-full text-left text-sm">
          <thead class="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th class="px-4 py-3">Name</th>
              <th class="px-4 py-3">Slug</th>
              <th class="px-4 py-3">Status</th>
              <th class="px-4 py-3">Workspace setup</th>
              <th class="px-4 py-3">Workspace</th>
              <th class="px-4 py-3">Created</th>
              @if (canManage()) {
                <th class="px-4 py-3">Actions</th>
              }
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            @for (t of tenants(); track t.id) {
              <tr>
                <td class="px-4 py-3 font-medium text-slate-900">{{ t.name }}</td>
                <td class="px-4 py-3 text-slate-600">{{ t.slug }}</td>
                <td class="px-4 py-3">
                  <span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium">{{ t.status }}</span>
                </td>
                <td class="px-4 py-3 text-xs text-slate-600">
                  @if (t.setup; as s) {
                    {{ s.status }}
                    @if (s.progress) {
                      ({{ s.progress.completed }}/{{ s.progress.total }})
                    }
                  } @else {
                    —
                  }
                </td>
                <td class="px-4 py-3">
                  <a class="text-elva-brand hover:underline" [href]="workspaceUrl(t.slug)" target="_blank" rel="noopener">
                    {{ workspaceUrl(t.slug) }}
                  </a>
                </td>
                <td class="px-4 py-3 text-slate-500">{{ t.createdAt | date: 'mediumDate' }}</td>
                @if (canManage()) {
                  <td class="px-4 py-3">
                    <div class="flex flex-wrap gap-1">
                      @if (t.status === 'SUSPENDED' || t.status === 'TRIAL') {
                        <button type="button" class="text-xs text-elva-brand hover:underline" (click)="lifecycle(t, 'activate')">
                          Activate
                        </button>
                      }
                      @if (t.status === 'ACTIVE' || t.status === 'TRIAL') {
                        <button type="button" class="text-xs text-amber-700 hover:underline" (click)="lifecycle(t, 'suspend')">
                          Suspend
                        </button>
                      }
                      @if (t.status === 'ACTIVE' || t.status === 'SUSPENDED') {
                        <button type="button" class="text-xs text-slate-600 hover:underline" (click)="lifecycle(t, 'cancel')">
                          Cancel
                        </button>
                      }
                      @if (t.status === 'CANCELLED') {
                        <button type="button" class="text-xs text-slate-600 hover:underline" (click)="lifecycle(t, 'archive')">
                          Archive
                        </button>
                      }
                    </div>
                  </td>
                }
              </tr>
            } @empty {
              <tr>
                <td class="px-4 py-8 text-center text-slate-500" [attr.colspan]="canManage() ? 7 : 6">
                  {{ loading() ? 'Loading…' : 'No businesses found.' }}
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `
})
export class PlatformTenantsComponent implements OnInit {
  private readonly api = inject(PlatformApiService);
  private readonly auth = inject(PlatformAuthService);

  search = '';
  statusFilter = '';
  readonly tenants = signal<PlatformTenant[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly message = signal('');

  ngOnInit(): void {
    this.load();
  }

  canManage(): boolean {
    return this.auth.hasRole('PLATFORM_SUPER_ADMIN', 'PLATFORM_ADMIN');
  }

  workspaceUrl(slug: string): string {
    return `https://${slug}.${environment.tenantBaseDomain}`;
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api
      .listTenants({
        search: this.search || undefined,
        status: this.statusFilter || undefined,
        limit: 100
      })
      .subscribe({
        next: (res) => {
          this.tenants.set(res.data.items);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(formatApiError(err));
          this.loading.set(false);
        }
      });
  }

  lifecycle(tenant: PlatformTenant, action: 'activate' | 'suspend' | 'cancel' | 'archive'): void {
    this.message.set('');
    this.error.set('');
    const call =
      action === 'activate'
        ? this.api.activateTenant(tenant.id)
        : action === 'suspend'
          ? this.api.suspendTenant(tenant.id)
          : action === 'cancel'
            ? this.api.cancelTenant(tenant.id)
            : this.api.archiveTenant(tenant.id);

    call.subscribe({
      next: (res) => {
        this.message.set(`${res.data.name} is now ${res.data.status}`);
        this.load();
      },
      error: (err) => this.error.set(formatApiError(err))
    });
  }
}
