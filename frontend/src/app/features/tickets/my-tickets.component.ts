import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { TicketService, TicketListParams } from '../../core/services/ticket.service';
import { Ticket } from '../../core/models/ticket.model';
import { PaginationMeta } from '../../core/models';
import { TicketTableComponent } from '../../shared/components/ticket-table/ticket-table.component';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';
import {
  QueueFilters,
  TicketQueueFiltersComponent
} from '../../shared/components/ticket-queue-filters/ticket-queue-filters.component';

@Component({
  selector: 'app-my-tickets',
  standalone: true,
  imports: [CommonModule, TicketTableComponent, TicketQueueFiltersComponent, PaginationComponent],
  template: `
    <div class="space-y-6">
      <div>
        <h2 class="text-2xl font-bold text-slate-900">My Tickets</h2>
        <p class="text-sm text-slate-500">Tickets assigned to you</p>
      </div>

      <app-ticket-queue-filters (filtersChange)="onFiltersChange($event)" />

      @if (error()) {
        <div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ error() }}</div>
      }

      <app-ticket-table [tickets]="tickets()" />
      <app-pagination
        [pagination]="pagination()"
        (pageChange)="onPageChange($event)"
        (limitChange)="onLimitChange($event)"
      />
    </div>
  `
})
export class MyTicketsComponent implements OnInit {
  private readonly api = inject(TicketService);

  readonly tickets = signal<Ticket[]>([]);
  readonly error = signal('');
  readonly pagination = signal<PaginationMeta>({ page: 1, limit: 20, total: 0, totalPages: 0 });

  private currentFilters: QueueFilters = {};

  ngOnInit(): void {
    this.load();
  }

  onFiltersChange(filters: QueueFilters): void {
    this.currentFilters = filters;
    this.pagination.update((p) => ({ ...p, page: 1 }));
    this.load();
  }

  onPageChange(page: number): void {
    this.pagination.update((p) => ({ ...p, page }));
    this.load();
  }

  onLimitChange(limit: number): void {
    this.pagination.update((p) => ({ ...p, limit, page: 1 }));
    this.load();
  }

  private load(): void {
    const params: TicketListParams = {
      page: this.pagination().page,
      limit: this.pagination().limit,
      ...this.currentFilters
    };

    this.api.listMy(params).subscribe({
      next: (res) => {
        this.tickets.set(res.data);
        this.pagination.set(res.pagination);
      },
      error: (err: HttpErrorResponse) => this.error.set(err.error?.message || 'Failed to load tickets')
    });
  }
}
