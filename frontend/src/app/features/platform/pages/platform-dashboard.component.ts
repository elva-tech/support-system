import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PlatformApiService, PlatformProvisioning } from '../../../core/services/platform-api.service';
import { PlatformAuthService } from '../../../core/services/platform-auth.service';
import { formatApiError } from '../../../shared/utils/api-error.util';

@Component({
  selector: 'app-platform-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Platform Dashboard</h1>
        <p class="mt-1 text-sm text-slate-500">
          Manage tenant workspaces across the ELVA Support platform.
        </p>
      </div>

      @if (error()) {
        <div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ error() }}</div>
      }

      <div class="grid gap-4 sm:grid-cols-3">
        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Businesses</p>
          <p class="mt-2 text-3xl font-bold text-slate-900">{{ tenantTotal() ?? '—' }}</p>
        </div>
        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Provisionings</p>
          <p class="mt-2 text-3xl font-bold text-slate-900">{{ provisioningTotal() ?? '—' }}</p>
        </div>
        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Signed in as</p>
          <p class="mt-2 text-sm font-semibold text-slate-900">{{ auth.currentAdmin()?.role }}</p>
        </div>
      </div>

      <div class="flex flex-wrap gap-3">
        <a routerLink="/tenants" class="btn-secondary">View businesses</a>
        @if (auth.hasRole('PLATFORM_SUPER_ADMIN', 'PLATFORM_ADMIN')) {
          <a routerLink="/provision" class="btn-primary">Provision business</a>
        }
        <a routerLink="/provisionings" class="btn-secondary">Provisioning status</a>
      </div>

      @if (recent().length) {
        <div class="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div class="border-b border-slate-100 px-5 py-3">
            <h2 class="text-sm font-semibold text-slate-900">Recent provisionings</h2>
          </div>
          <ul class="divide-y divide-slate-100">
            @for (item of recent(); track item.id) {
              <li class="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <div>
                  <p class="font-medium text-slate-900">{{ item.tenantName }}</p>
                  <p class="text-xs text-slate-500">{{ item.tenantSlug }} · {{ item.status }}</p>
                </div>
                <a [routerLink]="['/provisionings', item.id]" class="text-elva-brand hover:underline">Open</a>
              </li>
            }
          </ul>
        </div>
      }
    </div>
  `
})
export class PlatformDashboardComponent implements OnInit {
  readonly auth = inject(PlatformAuthService);
  private readonly api = inject(PlatformApiService);

  readonly tenantTotal = signal<number | null>(null);
  readonly provisioningTotal = signal<number | null>(null);
  readonly recent = signal<PlatformProvisioning[]>([]);
  readonly error = signal('');

  ngOnInit(): void {
    this.api.listTenants({ limit: 1 }).subscribe({
      next: (res) => this.tenantTotal.set(res.data.total),
      error: (err) => this.error.set(formatApiError(err))
    });
    this.api.listProvisionings({ limit: 5 }).subscribe({
      next: (res) => {
        this.provisioningTotal.set(res.data.total);
        this.recent.set(res.data.items);
      },
      error: (err) => this.error.set(formatApiError(err))
    });
  }
}
