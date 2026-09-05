import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlatformApiService, PlatformAuditItem } from '../../../core/services/platform-api.service';
import { formatApiError } from '../../../shared/utils/api-error.util';

@Component({
  selector: 'app-platform-audit',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Audit Logs</h1>
        <p class="mt-1 text-sm text-slate-500">Recent platform administration actions</p>
      </div>
      @if (error()) {
        <div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ error() }}</div>
      }
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
          </li>
        } @empty {
          <li class="px-4 py-8 text-center text-slate-500">
            {{ loading() ? 'Loading…' : 'No audit events.' }}
          </li>
        }
      </ul>
    </div>
  `
})
export class PlatformAuditComponent implements OnInit {
  private readonly api = inject(PlatformApiService);
  readonly items = signal<PlatformAuditItem[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');

  ngOnInit(): void {
    this.loading.set(true);
    this.api.listAudit({ limit: 50 }).subscribe({
      next: (res) => {
        this.items.set(res.data.items as PlatformAuditItem[]);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(formatApiError(err));
        this.loading.set(false);
      }
    });
  }
}
