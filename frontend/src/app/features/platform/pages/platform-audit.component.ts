import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PlatformApiService, PlatformAuditItem } from '../../../core/services/platform-api.service';
import { formatApiError } from '../../../shared/utils/api-error.util';

@Component({
  selector: 'app-platform-audit',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Audit Logs</h1>
        <p class="mt-1 text-sm text-slate-500">Platform administration activity (separate from tenant audit)</p>
      </div>

      @if (error()) {
        <div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ error() }}</div>
      }

      <div class="flex flex-wrap gap-3">
        <input class="form-input max-w-xs" placeholder="Search action or actor…" [(ngModel)]="search" (keyup.enter)="load()" />
        <input class="form-input max-w-xs" placeholder="Action filter" [(ngModel)]="action" />
        <select class="form-input max-w-[12rem]" [(ngModel)]="targetType">
          <option value="">All targets</option>
          <option value="TENANT">Tenant</option>
          <option value="PLATFORM_ADMIN">Platform Admin</option>
          <option value="PROVISIONING">Provisioning</option>
          <option value="TENANT_USER">Tenant User</option>
          <option value="INTEGRITY">Integrity</option>
        </select>
        <input type="date" class="form-input max-w-[10rem]" [(ngModel)]="from" />
        <input type="date" class="form-input max-w-[10rem]" [(ngModel)]="to" />
        <button type="button" class="btn-primary" (click)="load()">Filter</button>
      </div>

      <ul class="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
        @for (row of items(); track row._id) {
          <li class="px-4 py-3 text-sm">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="font-medium text-slate-900">{{ row.action }}</span>
              <span class="text-xs text-slate-500">{{ row.createdAt | date: 'medium' }}</span>
            </div>
            <p class="mt-1 text-xs text-slate-500">
              {{ row.actorEmail || 'system' }}
              @if (row.targetType) {
                · {{ row.targetType }}
              }
            </p>
            @if (row.metadata && (row.metadata | json) !== '{}') {
              <pre class="mt-2 overflow-x-auto rounded bg-slate-50 p-2 text-[11px] text-slate-600">{{ row.metadata | json }}</pre>
            }
          </li>
        } @empty {
          <li class="px-4 py-8 text-center text-slate-500">
            {{ loading() ? 'Loading…' : 'No audit events.' }}
          </li>
        }
      </ul>

      <div class="flex justify-end gap-2">
        <button type="button" class="btn-secondary" [disabled]="skip() <= 0" (click)="prev()">Previous</button>
        <button type="button" class="btn-secondary" [disabled]="!hasMore()" (click)="next()">Next</button>
      </div>
    </div>
  `
})
export class PlatformAuditComponent implements OnInit {
  private readonly api = inject(PlatformApiService);
  readonly items = signal<PlatformAuditItem[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly skip = signal(0);
  readonly total = signal(0);
  readonly limit = 50;

  search = '';
  action = '';
  targetType = '';
  from = '';
  to = '';

  ngOnInit(): void {
    this.load();
  }

  hasMore(): boolean {
    return this.skip() + this.limit < this.total();
  }

  load(): void {
    this.loading.set(true);
    this.api
      .listAudit({
        limit: this.limit,
        skip: this.skip(),
        search: this.search || undefined,
        action: this.action || undefined,
        targetType: this.targetType || undefined,
        from: this.from || undefined,
        to: this.to ? `${this.to}T23:59:59.999Z` : undefined
      })
      .subscribe({
        next: (res) => {
          this.items.set((res.data.items || []) as PlatformAuditItem[]);
          this.total.set(res.data.total || 0);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(formatApiError(err));
          this.loading.set(false);
        }
      });
  }

  next(): void {
    this.skip.set(this.skip() + this.limit);
    this.load();
  }

  prev(): void {
    this.skip.set(Math.max(0, this.skip() - this.limit));
    this.load();
  }
}
