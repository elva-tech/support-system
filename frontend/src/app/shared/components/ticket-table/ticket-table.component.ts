import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Ticket } from '../../../core/models/ticket.model';
import { TicketStatusBadgeComponent } from '../ticket-status-badge/ticket-status-badge.component';

@Component({
  selector: 'app-ticket-table',
  standalone: true,
  imports: [CommonModule, RouterLink, TicketStatusBadgeComponent],
  template: `
    <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <table class="min-w-full divide-y divide-slate-200 text-sm">
        <thead class="bg-slate-50">
          <tr>
            <th class="px-4 py-3 text-left font-medium text-slate-600">Ticket #</th>
            <th class="px-4 py-3 text-left font-medium text-slate-600">Subject</th>
            <th class="px-4 py-3 text-left font-medium text-slate-600">Merchant</th>
            <th class="px-4 py-3 text-left font-medium text-slate-600">Module</th>
            <th class="px-4 py-3 text-left font-medium text-slate-600">Team</th>
            <th class="px-4 py-3 text-left font-medium text-slate-600">Assigned</th>
            <th class="px-4 py-3 text-left font-medium text-slate-600">Status</th>
            <th class="px-4 py-3 text-left font-medium text-slate-600">Created</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          @for (ticket of tickets; track ticket._id) {
            <tr class="cursor-pointer hover:bg-slate-50" [routerLink]="['/tickets', ticket._id]">
              <td class="px-4 py-3 font-mono text-xs font-medium text-elva-700">{{ ticket.ticketNumber }}</td>
              <td class="px-4 py-3 font-medium text-slate-900">{{ ticket.subject }}</td>
              <td class="px-4 py-3">{{ merchantLabel(ticket) }}</td>
              <td class="px-4 py-3">{{ refName(ticket.moduleId) }}</td>
              <td class="px-4 py-3">{{ refName(ticket.teamId) }}</td>
              <td class="px-4 py-3">{{ assigneeLabel(ticket) }}</td>
              <td class="px-4 py-3"><app-ticket-status-badge [status]="ticket.status" /></td>
              <td class="px-4 py-3 text-slate-600">{{ ticket.createdAt | date: 'medium' }}</td>
            </tr>
          } @empty {
            <tr>
              <td colspan="8" class="px-4 py-8 text-center text-slate-500">No tickets found.</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `
})
export class TicketTableComponent {
  @Input({ required: true }) tickets: Ticket[] = [];

  refName(ref: Ticket['moduleId']): string {
    return typeof ref === 'string' ? ref : ref.name;
  }

  merchantLabel(ticket: Ticket): string {
    const m = ticket.merchantId;
    return typeof m === 'string' ? m : m.merchantName;
  }

  assigneeLabel(ticket: Ticket): string {
    if (!ticket.assignedTo) return 'Unassigned';
    const a = ticket.assignedTo;
    return typeof a === 'string' ? a : `${a.firstName} ${a.lastName}`;
  }
}
