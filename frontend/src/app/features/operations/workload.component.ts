import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { DashboardService } from '../../core/services/dashboard.service';
import { TeamWorkloadItem } from '../../core/models/operations.model';

@Component({
  selector: 'app-workload',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-6">
      <div>
        <h2 class="text-2xl font-bold text-slate-900">Team Workload</h2>
        <p class="text-sm text-slate-500">Active ticket distribution across agents</p>
      </div>

      @if (error()) {
        <div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ error() }}</div>
      }

      <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table class="min-w-full divide-y divide-slate-200 text-sm">
          <thead class="bg-slate-50">
            <tr>
              <th class="px-4 py-3 text-left font-medium text-slate-600">Agent</th>
              <th class="px-4 py-3 text-left font-medium text-slate-600">Team</th>
              <th class="px-4 py-3 text-left font-medium text-slate-600">Active Tickets</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            @for (item of workload(); track item.userId) {
              <tr>
                <td class="px-4 py-3 font-medium text-slate-900">{{ item.name }}</td>
                <td class="px-4 py-3 text-slate-600">{{ item.teamName || '—' }}</td>
                <td class="px-4 py-3">
                  <span class="badge" [class.bg-red-100]="item.ticketCount > 5" [class.text-red-800]="item.ticketCount > 5"
                    [class.bg-elva-100]="item.ticketCount <= 5" [class.text-elva-800]="item.ticketCount <= 5">
                    {{ item.ticketCount }}
                  </span>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="3" class="px-4 py-8 text-center text-slate-500">No workload data available.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `
})
export class WorkloadComponent implements OnInit {
  private readonly dashboard = inject(DashboardService);

  readonly workload = signal<TeamWorkloadItem[]>([]);
  readonly error = signal('');

  ngOnInit(): void {
    this.dashboard.getTeamWorkload().subscribe({
      next: (res) => this.workload.set(res.data),
      error: (err: HttpErrorResponse) => this.error.set(err.error?.message || 'Failed to load workload')
    });
  }
}
