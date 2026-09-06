import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CentralSupportApiService } from '../../../core/services/central-support-api.service';
import { CentralSupportAuthService } from '../../../core/services/central-support-auth.service';
import { formatApiError } from '../../../shared/utils/api-error.util';

@Component({
  selector: 'app-central-support-workload',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Workload</h1>
        <p class="mt-1 text-sm text-slate-500">Assignment distribution across central support agents.</p>
      </div>
      @if (error()) {
        <div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ error() }}</div>
      }
      <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table class="min-w-full text-left text-sm">
          <thead class="bg-slate-50 text-slate-500">
            <tr>
              <th class="px-4 py-3">Agent</th>
              <th class="px-4 py-3">Open assigned</th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.id) {
              <tr class="border-t border-slate-100" [class.bg-elva-50]="row.id === myId">
                <td class="px-4 py-3 font-medium">{{ row.name }}{{ row.id === myId ? ' (you)' : '' }}</td>
                <td class="px-4 py-3">{{ row.count }}</td>
              </tr>
            }
            <tr class="border-t border-slate-100">
              <td class="px-4 py-3 font-medium">Unassigned</td>
              <td class="px-4 py-3">{{ unassigned() }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <a [routerLink]="queueLink" class="text-sm text-elva-brand hover:underline">Go to Support Queue</a>
    </div>
  `
})
export class CentralSupportWorkloadComponent implements OnInit {
  private readonly api = inject(CentralSupportApiService);
  private readonly auth = inject(CentralSupportAuthService);

  readonly error = signal('');
  readonly rows = signal<Array<{ id: string; name: string; count: number }>>([]);
  readonly unassigned = signal(0);
  readonly myId = this.auth.currentUser()?.id || '';

  get queueLink(): string {
    return this.auth.hasRole('CENTRAL_SUPPORT_ADMIN') ? '/tickets' : '/team-queue';
  }

  ngOnInit(): void {
    const loadTickets = (agents: Array<{ id: string; name: string }>) => {
      this.api.listTickets({ limit: 200 }).subscribe({
        next: (ticketsRes) => {
          const items = ticketsRes.data?.items || [];
          const open = items.filter(
            (t) =>
              t.status === 'OPEN' || t.status === 'IN_PROGRESS' || t.status === 'WAITING_FOR_REQUESTER'
          );
          this.unassigned.set(open.filter((t) => !t.assignedUserId).length);
          this.rows.set(
            agents.map((a) => ({
              id: a.id,
              name: a.name,
              count: open.filter((t) => t.assignedUserId === a.id).length
            }))
          );
        },
        error: (err) => this.error.set(formatApiError(err))
      });
    };

    this.api.listAssignees().subscribe({
      next: (assigneesRes) => loadTickets(assigneesRes.data || []),
      error: () => {
        // Agents may not have assignees endpoint — fall back to ticket-derived names
        this.api.listTickets({ limit: 200 }).subscribe({
          next: (ticketsRes) => {
            const items = ticketsRes.data?.items || [];
            const open = items.filter(
              (t) =>
                t.status === 'OPEN' ||
                t.status === 'IN_PROGRESS' ||
                t.status === 'WAITING_FOR_REQUESTER'
            );
            this.unassigned.set(open.filter((t) => !t.assignedUserId).length);
            const byId = new Map<string, { id: string; name: string; count: number }>();
            for (const t of open) {
              if (!t.assignedUserId) continue;
              const existing = byId.get(t.assignedUserId);
              if (existing) {
                existing.count += 1;
              } else {
                byId.set(t.assignedUserId, {
                  id: t.assignedUserId,
                  name: t.assignedUserName || t.assignedUserId,
                  count: 1
                });
              }
            }
            this.rows.set([...byId.values()]);
          },
          error: (err) => this.error.set(formatApiError(err))
        });
      }
    });
  }
}
