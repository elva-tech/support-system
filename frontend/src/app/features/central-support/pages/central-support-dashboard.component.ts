import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CentralSupportApiService } from '../../../core/services/central-support-api.service';
import { CentralSupportAuthService } from '../../../core/services/central-support-auth.service';
import { PlatformSupportTicket } from '../../../core/services/platform-support-api.service';
import { formatApiError } from '../../../shared/utils/api-error.util';

@Component({
  selector: 'app-central-support-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Central Support Dashboard</h1>
        <p class="mt-1 text-sm text-slate-500">
          Operational overview of tickets raised by business workspaces to ELVA.
        </p>
      </div>

      @if (error()) {
        <div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ error() }}</div>
      }

      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        @for (card of cards(); track card.label) {
          <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">{{ card.label }}</p>
            <p class="mt-2 text-2xl font-bold text-slate-900">{{ card.value }}</p>
          </div>
        }
      </div>

      <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-lg font-semibold text-slate-900">Recent tickets</h2>
          <a [routerLink]="queueLink" class="text-sm text-elva-brand hover:underline">Open queue</a>
        </div>
        <ul class="mt-4 divide-y divide-slate-100">
          @for (t of recent(); track t.id) {
            <li class="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
              <div>
                <a class="font-medium text-elva-brand hover:underline" [routerLink]="['/tickets', t.id]">
                  {{ t.ticketNumber }}
                </a>
                <span class="text-slate-600"> — {{ t.subject }}</span>
                <p class="text-xs text-slate-500">
                  {{ t.sourceOrganizationName }} · {{ t.raisedByName }} · {{ t.status }}
                </p>
              </div>
              <span class="text-xs text-slate-500">{{ t.createdAt | date: 'short' }}</span>
            </li>
          } @empty {
            <li class="py-6 text-center text-slate-500">No tickets yet.</li>
          }
        </ul>
      </div>
    </div>
  `
})
export class CentralSupportDashboardComponent implements OnInit {
  private readonly api = inject(CentralSupportApiService);
  private readonly auth = inject(CentralSupportAuthService);

  readonly error = signal('');
  readonly recent = signal<PlatformSupportTicket[]>([]);
  readonly cards = signal<{ label: string; value: number }[]>([]);

  get queueLink(): string {
    return this.auth.hasRole('CENTRAL_SUPPORT_ADMIN') ? '/tickets' : '/team-queue';
  }

  ngOnInit(): void {
    this.api.listTickets({ limit: 100 }).subscribe({
      next: (res) => {
        const items = res.data?.items || [];
        this.recent.set(items.slice(0, 8));
        const mineId = this.auth.currentUser()?.id;
        const open = items.filter((t) => t.status === 'OPEN' || t.status === 'IN_PROGRESS').length;
        const waiting = items.filter((t) => t.status === 'WAITING_FOR_REQUESTER').length;
        const unassigned = items.filter((t) => !t.assignedUserId).length;
        const mine = items.filter((t) => t.assignedUserId === mineId).length;
        const atRisk = items.filter(
          (t) =>
            t.sla?.currentCycle?.resolutionState === 'AT_RISK' ||
            t.sla?.currentCycle?.resolutionState === 'WARNING' ||
            t.sla?.currentCycle?.resolutionState === 'BREACHED'
        ).length;
        this.cards.set([
          { label: 'Assigned to me', value: mine },
          { label: 'Open / in progress', value: open },
          { label: 'Waiting for business', value: waiting },
          { label: 'Unassigned', value: unassigned },
          { label: 'SLA at risk / breached', value: atRisk },
          { label: 'Total loaded', value: items.length }
        ]);
      },
      error: (err) => this.error.set(formatApiError(err))
    });
  }
}
