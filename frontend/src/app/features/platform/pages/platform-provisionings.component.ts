import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PlatformApiService, PlatformProvisioning } from '../../../core/services/platform-api.service';
import { formatApiError } from '../../../shared/utils/api-error.util';

@Component({
  selector: 'app-platform-provisionings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Provisioning Status</h1>
        <p class="mt-1 text-sm text-slate-500">Track onboarding jobs and recover from email failures</p>
      </div>

      <div class="flex flex-wrap gap-3">
        <input class="form-input max-w-xs" placeholder="Search" [(ngModel)]="search" (keyup.enter)="load()" />
        <select class="form-input max-w-[10rem]" [(ngModel)]="statusFilter" (change)="load()">
          <option value="">All</option>
          <option value="READY">READY</option>
          <option value="FAILED">FAILED</option>
          <option value="IN_PROGRESS">IN_PROGRESS</option>
          <option value="PENDING">PENDING</option>
        </select>
        <button type="button" class="btn-secondary" (click)="load()">Refresh</button>
      </div>

      @if (error()) {
        <div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ error() }}</div>
      }

      <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table class="min-w-full text-left text-sm">
          <thead class="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th class="px-4 py-3">Tenant</th>
              <th class="px-4 py-3">Admin</th>
              <th class="px-4 py-3">Status</th>
              <th class="px-4 py-3">Email step</th>
              <th class="px-4 py-3">Created</th>
              <th class="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            @for (p of items(); track p.id) {
              <tr>
                <td class="px-4 py-3">
                  <p class="font-medium text-slate-900">{{ p.tenantName }}</p>
                  <p class="text-xs text-slate-500">{{ p.tenantSlug }}</p>
                </td>
                <td class="px-4 py-3 text-slate-600">
                  <p>{{ p.tenantAdminName }}</p>
                  <p class="text-xs">{{ p.tenantAdminEmail }}</p>
                </td>
                <td class="px-4 py-3">{{ p.status }}</td>
                <td class="px-4 py-3">{{ p.steps?.welcomeEmail?.status || '—' }}</td>
                <td class="px-4 py-3 text-slate-500">{{ p.createdAt | date: 'medium' }}</td>
                <td class="px-4 py-3">
                  <a [routerLink]="['/provisionings', p.id]" class="text-elva-brand hover:underline">Details</a>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="6" class="px-4 py-8 text-center text-slate-500">
                  {{ loading() ? 'Loading…' : 'No provisionings yet.' }}
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `
})
export class PlatformProvisioningsComponent implements OnInit {
  private readonly api = inject(PlatformApiService);

  search = '';
  statusFilter = '';
  readonly items = signal<PlatformProvisioning[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api
      .listProvisionings({
        search: this.search || undefined,
        status: this.statusFilter || undefined,
        limit: 100
      })
      .subscribe({
        next: (res) => {
          this.items.set(res.data.items);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(formatApiError(err));
          this.loading.set(false);
        }
      });
  }
}
