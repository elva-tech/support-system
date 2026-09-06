import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CentralSupportApiService } from '../../../core/services/central-support-api.service';
import { PlatformSupportTicket } from '../../../core/services/platform-support-api.service';
import { formatApiError } from '../../../shared/utils/api-error.util';

@Component({
  selector: 'app-platform-support-queue',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">
          {{ pageTitle }}
        </h1>
        <p class="mt-1 text-sm text-slate-500">
          Tickets raised by business admins and agents to ELVA Support.
        </p>
      </div>

      @if (error()) {
        <div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ error() }}</div>
      }

      <div class="flex flex-wrap gap-3">
        <input class="form-input max-w-xs" placeholder="Search…" [(ngModel)]="search" (keyup.enter)="load()" />
        <select class="form-input max-w-[10rem]" [(ngModel)]="status" (change)="load()">
          <option value="">All statuses</option>
          <option value="OPEN">OPEN</option>
          <option value="IN_PROGRESS">IN_PROGRESS</option>
          <option value="WAITING_FOR_REQUESTER">WAITING_FOR_REQUESTER</option>
          <option value="RESOLVED">RESOLVED</option>
          <option value="CLOSED">CLOSED</option>
        </select>
        <select class="form-input max-w-[10rem]" [(ngModel)]="priority" (change)="load()">
          <option value="">All priorities</option>
          <option value="CRITICAL">Urgent</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Normal</option>
          <option value="LOW">Low</option>
        </select>
        <button type="button" class="btn-secondary" (click)="load()">Filter</button>
      </div>

      <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table class="min-w-full text-left text-sm">
          <thead class="bg-slate-50 text-slate-500">
            <tr>
              <th class="px-4 py-3">Ticket</th>
              <th class="px-4 py-3">Business</th>
              <th class="px-4 py-3">Raised by</th>
              <th class="px-4 py-3">Category</th>
              <th class="px-4 py-3">Subject</th>
              <th class="px-4 py-3">Priority</th>
              <th class="px-4 py-3">Status</th>
              <th class="px-4 py-3">Assigned</th>
              <th class="px-4 py-3">SLA</th>
              <th class="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody>
            @for (t of items(); track t.id) {
              <tr class="border-t border-slate-100 hover:bg-slate-50">
                <td class="px-4 py-3">
                  <a class="font-medium text-elva-brand hover:underline" [routerLink]="['/tickets', t.id]">
                    {{ t.ticketNumber }}
                  </a>
                </td>
                <td class="px-4 py-3">{{ t.sourceOrganizationName }}</td>
                <td class="px-4 py-3">
                  <div>{{ t.raisedByName }}</div>
                  <div class="text-xs text-slate-500">{{ t.raisedByRole }}</div>
                </td>
                <td class="px-4 py-3">{{ t.categoryLabel || t.category }}</td>
                <td class="px-4 py-3 max-w-[14rem] truncate">{{ t.subject }}</td>
                <td class="px-4 py-3">{{ t.priority }}</td>
                <td class="px-4 py-3">{{ t.status }}</td>
                <td class="px-4 py-3">
                  {{ t.assignedUserName || t.assignedPlatformAdminName || 'Unassigned' }}
                  @if (t.assignedTeamName) {
                    <div class="text-xs text-slate-500">{{ t.assignedTeamName }}</div>
                  }
                </td>
                <td class="px-4 py-3 text-xs">
                  {{ t.sla?.currentCycle?.resolutionState || '—' }}
                </td>
                <td class="px-4 py-3 whitespace-nowrap">{{ t.createdAt | date: 'short' }}</td>
              </tr>
            } @empty {
              <tr>
                <td colspan="10" class="px-4 py-8 text-center text-slate-500">No support tickets found.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <p class="text-xs text-slate-500">{{ total() }} total</p>
    </div>
  `
})
export class PlatformSupportQueueComponent implements OnInit {
  private readonly api = inject(CentralSupportApiService);
  private readonly route = inject(ActivatedRoute);

  readonly items = signal<PlatformSupportTicket[]>([]);
  readonly total = signal(0);
  readonly error = signal('');
  search = '';
  status = '';
  priority = '';
  mineOnly = false;
  teamQueue = false;

  get pageTitle(): string {
    if (this.mineOnly) return 'My Tickets';
    if (this.teamQueue) return 'Team Queue';
    return 'Support Queue';
  }

  ngOnInit(): void {
    this.mineOnly = Boolean(this.route.snapshot.data['mine']);
    this.teamQueue = Boolean(this.route.snapshot.data['teamQueue']);
    this.load();
  }

  load(): void {
    this.error.set('');
    this.api
      .listTickets({
        search: this.search || undefined,
        status: this.status || undefined,
        priority: this.priority || undefined,
        mine: this.mineOnly || undefined,
        teamQueue: this.teamQueue || undefined
      })
      .subscribe({
        next: (res) => {
          this.items.set(res.data?.items || []);
          this.total.set(res.data?.total || 0);
        },
        error: (err) => this.error.set(formatApiError(err))
      });
  }
}
