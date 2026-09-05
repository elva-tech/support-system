import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuditApiService, TenantAuditLog } from '../../core/services/audit-api.service';
import { formatApiError } from '../../shared/utils/api-error.util';

@Component({
  selector: 'app-tenant-audit',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-6">
      <div>
        <h2 class="text-2xl font-bold text-slate-900">Audit Log</h2>
        <p class="text-sm text-slate-500">Workspace activity for this tenant</p>
      </div>

      @if (error()) {
        <div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ error() }}</div>
      }

      <div class="flex flex-wrap gap-3">
        <input class="form-input max-w-xs" placeholder="Search action, actor, ticket…" [(ngModel)]="search" (keyup.enter)="load(1)" />
        <select class="form-input max-w-[12rem]" [(ngModel)]="action">
          <option value="">All actions</option>
          @for (a of actionOptions; track a) {
            <option [value]="a">{{ a }}</option>
          }
        </select>
        <select class="form-input max-w-[10rem]" [(ngModel)]="entityType">
          <option value="">All entities</option>
          <option value="TICKET">Ticket</option>
          <option value="USER">User</option>
          <option value="MERCHANT">Client</option>
          <option value="APPLICATION">Application</option>
          <option value="TEAM">Team</option>
          <option value="MODULE">Module</option>
          <option value="WORKSPACE">Workspace</option>
        </select>
        <input type="date" class="form-input max-w-[10rem]" [(ngModel)]="from" />
        <input type="date" class="form-input max-w-[10rem]" [(ngModel)]="to" />
        <button type="button" class="btn-primary" (click)="load(1)">Filter</button>
      </div>

      <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table class="min-w-full divide-y divide-slate-200 text-sm">
          <thead class="bg-slate-50">
            <tr>
              <th class="px-4 py-3 text-left font-medium text-slate-600">Timestamp</th>
              <th class="px-4 py-3 text-left font-medium text-slate-600">Action</th>
              <th class="px-4 py-3 text-left font-medium text-slate-600">Actor</th>
              <th class="px-4 py-3 text-left font-medium text-slate-600">Entity</th>
              <th class="px-4 py-3 text-left font-medium text-slate-600">Summary</th>
              <th class="px-4 py-3 text-right font-medium text-slate-600"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            @for (row of items(); track row._id) {
              <tr class="hover:bg-slate-50">
                <td class="px-4 py-3 whitespace-nowrap text-slate-500">{{ row.createdAt | date: 'medium' }}</td>
                <td class="px-4 py-3 font-medium text-slate-900">{{ humanAction(row.action) }}</td>
                <td class="px-4 py-3">{{ row.actorName || '—' }}</td>
                <td class="px-4 py-3">{{ row.entityType }}</td>
                <td class="px-4 py-3 text-slate-600">{{ summary(row) }}</td>
                <td class="px-4 py-3 text-right">
                  <button type="button" class="text-elva-600 hover:underline" (click)="toggle(row._id)">
                    {{ expandedId() === row._id ? 'Hide' : 'Details' }}
                  </button>
                </td>
              </tr>
              @if (expandedId() === row._id) {
                <tr class="bg-slate-50">
                  <td colspan="6" class="px-4 py-3">
                    <pre class="overflow-x-auto rounded-lg bg-white p-3 text-xs text-slate-700 ring-1 ring-slate-200">{{ row.metadata | json }}</pre>
                    <p class="mt-2 text-xs text-slate-500">Entity ID: {{ row.entityId }}</p>
                  </td>
                </tr>
              }
            } @empty {
              <tr>
                <td colspan="6" class="px-4 py-8 text-center text-slate-500">
                  {{ loading() ? 'Loading…' : 'No audit events found.' }}
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      @if (totalPages() > 1) {
        <div class="flex items-center justify-between text-sm text-slate-600">
          <span>Page {{ page() }} of {{ totalPages() }} ({{ total() }} total)</span>
          <div class="flex gap-2">
            <button type="button" class="btn-secondary" [disabled]="page() <= 1" (click)="load(page() - 1)">Previous</button>
            <button type="button" class="btn-secondary" [disabled]="page() >= totalPages()" (click)="load(page() + 1)">Next</button>
          </div>
        </div>
      }
    </div>
  `
})
export class TenantAuditComponent implements OnInit {
  private readonly api = inject(AuditApiService);

  readonly items = signal<TenantAuditLog[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly page = signal(1);
  readonly total = signal(0);
  readonly totalPages = signal(0);
  readonly expandedId = signal<string | null>(null);

  search = '';
  action = '';
  entityType = '';
  from = '';
  to = '';

  readonly actionOptions = [
    'AGENT_LOGIN',
    'USER_INVITED',
    'USER_SUSPENDED',
    'USER_REACTIVATED',
    'USER_DEACTIVATED',
    'TICKET_CREATED',
    'TICKET_ASSIGNED',
    'STATUS_CHANGED',
    'WORKSPACE_ORGANIZATION_UPDATED',
    'WORKSPACE_BRANDING_UPDATED',
    'APPLICATION_CREATED',
    'TEAM_CREATED',
    'MODULE_CREATED'
  ];

  ngOnInit(): void {
    this.load(1);
  }

  load(page: number): void {
    this.loading.set(true);
    this.error.set('');
    const params: Record<string, string> = {
      page: String(page),
      limit: '25'
    };
    if (this.search.trim()) params['search'] = this.search.trim();
    if (this.action) params['action'] = this.action;
    if (this.entityType) params['entityType'] = this.entityType;
    if (this.from) params['from'] = this.from;
    if (this.to) params['to'] = `${this.to}T23:59:59.999Z`;

    this.api.list(params).subscribe({
      next: (res) => {
        this.items.set(res.data || []);
        this.page.set(res.pagination?.page || page);
        this.total.set(res.pagination?.total || 0);
        this.totalPages.set(res.pagination?.totalPages || 0);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(formatApiError(err, 'Failed to load audit logs'));
        this.loading.set(false);
      }
    });
  }

  toggle(id: string): void {
    this.expandedId.set(this.expandedId() === id ? null : id);
  }

  humanAction(action: string): string {
    return action.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
  }

  summary(row: TenantAuditLog): string {
    const m = row.metadata || {};
    if (typeof m['ticketNumber'] === 'string') return String(m['ticketNumber']);
    if (typeof m['email'] === 'string') return String(m['email']);
    if (typeof m['name'] === 'string') return String(m['name']);
    if (typeof m['displayName'] === 'string') return String(m['displayName']);
    return '—';
  }
}
