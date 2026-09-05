import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlatformApiService } from '../../../core/services/platform-api.service';
import { formatApiError } from '../../../shared/utils/api-error.util';

@Component({
  selector: 'app-platform-admins',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Platform Administrators</h1>
        <p class="mt-1 text-sm text-slate-500">Identities that manage the PaaS (not tenant staff)</p>
      </div>
      @if (error()) {
        <div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ error() }}</div>
      }
      <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table class="min-w-full text-left text-sm">
          <thead class="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th class="px-4 py-3">Name</th>
              <th class="px-4 py-3">Email</th>
              <th class="px-4 py-3">Role</th>
              <th class="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            @for (a of admins(); track $index) {
              <tr>
                <td class="px-4 py-3 font-medium">{{ a['name'] }}</td>
                <td class="px-4 py-3">{{ a['email'] }}</td>
                <td class="px-4 py-3">{{ a['role'] }}</td>
                <td class="px-4 py-3">{{ a['status'] }}</td>
              </tr>
            } @empty {
              <tr>
                <td colspan="4" class="px-4 py-8 text-center text-slate-500">
                  {{ loading() ? 'Loading…' : 'No platform admins found.' }}
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `
})
export class PlatformAdminsComponent implements OnInit {
  private readonly api = inject(PlatformApiService);
  readonly admins = signal<Record<string, unknown>[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');

  ngOnInit(): void {
    this.loading.set(true);
    this.api.listAdmins({ limit: 100 }).subscribe({
      next: (res) => {
        this.admins.set(res.data.items);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(formatApiError(err));
        this.loading.set(false);
      }
    });
  }
}
