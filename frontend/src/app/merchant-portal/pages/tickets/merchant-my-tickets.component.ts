import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { MerchantTicketService } from '../../services/merchant-ticket.service';
import { Ticket } from '../../../core/models/ticket.model';
import { TicketStatusBadgeComponent } from '../../../shared/components/ticket-status-badge/ticket-status-badge.component';

@Component({
  selector: 'app-merchant-my-tickets',
  standalone: true,
  imports: [CommonModule, RouterLink, TicketStatusBadgeComponent],
  template: `
    <div class="space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 class="text-2xl font-bold text-slate-900">My Tickets</h2>
          <p class="text-sm text-slate-500">Track your support requests</p>
        </div>
        <a routerLink="/merchant/tickets/new" class="btn-primary">Create Ticket</a>
      </div>

      @if (error()) {
        <div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ error() }}</div>
      }

      <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table class="min-w-full divide-y divide-slate-200 text-sm">
          <thead class="bg-slate-50">
            <tr>
              <th class="px-4 py-3 text-left font-medium text-slate-600">Ticket #</th>
              <th class="px-4 py-3 text-left font-medium text-slate-600">Subject</th>
              <th class="px-4 py-3 text-left font-medium text-slate-600">Module</th>
              <th class="px-4 py-3 text-left font-medium text-slate-600">Status</th>
              <th class="px-4 py-3 text-left font-medium text-slate-600">Created</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            @for (ticket of tickets(); track ticket._id) {
              <tr class="cursor-pointer hover:bg-slate-50" [routerLink]="['/merchant/tickets', ticket._id]">
                <td class="px-4 py-3 font-mono text-xs font-medium text-elva-800">{{ ticket.ticketNumber }}</td>
                <td class="px-4 py-3 font-medium text-slate-900">{{ ticket.subject }}</td>
                <td class="px-4 py-3">{{ moduleLabel(ticket) }}</td>
                <td class="px-4 py-3"><app-ticket-status-badge [status]="ticket.status" /></td>
                <td class="px-4 py-3 text-slate-600">{{ ticket.createdAt | date: 'medium' }}</td>
              </tr>
            } @empty {
              <tr>
                <td colspan="5" class="px-4 py-8 text-center text-slate-500">
                  No tickets yet.
                  <a routerLink="/merchant/tickets/new" class="text-elva-brand hover:underline">Create your first ticket</a>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `
})
export class MerchantMyTicketsComponent implements OnInit {
  private readonly api = inject(MerchantTicketService);

  readonly tickets = signal<Ticket[]>([]);
  readonly error = signal('');

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.list().subscribe({
      next: (res) => this.tickets.set(res.data),
      error: (err: HttpErrorResponse) => this.error.set(err.error?.message || 'Failed to load tickets')
    });
  }

  moduleLabel(ticket: Ticket): string {
    const mod = ticket.moduleId;
    if (typeof mod === 'string') return mod;
    return mod.name;
  }
}
