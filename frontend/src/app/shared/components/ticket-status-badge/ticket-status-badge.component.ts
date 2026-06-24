import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TicketStatus } from '../../../core/models/ticket.model';

@Component({
  selector: 'app-ticket-status-badge',
  standalone: true,
  imports: [CommonModule],
  template: `<span class="badge" [ngClass]="statusClass">{{ label }}</span>`
})
export class TicketStatusBadgeComponent {
  @Input({ required: true }) status!: TicketStatus;

  get label(): string {
    return this.status.replace(/_/g, ' ');
  }

  get statusClass(): string {
    switch (this.status) {
      case 'OPEN':
        return 'bg-blue-100 text-blue-800';
      case 'IN_PROGRESS':
        return 'bg-amber-100 text-amber-800';
      case 'WAITING_FOR_CUSTOMER':
        return 'bg-orange-100 text-orange-800';
      case 'RESOLVED':
        return 'bg-elva-100 text-elva-800';
      case 'CLOSED':
        return 'bg-slate-100 text-slate-600';
      default:
        return 'bg-slate-100 text-slate-600';
    }
  }
}
