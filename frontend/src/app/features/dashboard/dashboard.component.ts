import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { RoleBadgeComponent } from '../../shared/components/role-badge/role-badge.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RoleBadgeComponent],
  template: `
    <div class="space-y-6">
      <div>
        <h2 class="text-2xl font-bold text-slate-900">Operations Dashboard</h2>
        <p class="mt-1 text-sm text-slate-500">Welcome back, {{ user()?.firstName }}.</p>
      </div>

      <div class="card flex items-center justify-between">
        <div>
          <p class="text-sm text-slate-500">Your role</p>
          @if (user(); as u) {
            <div class="mt-2"><app-role-badge [role]="u.role" /></div>
          }
        </div>
      </div>

      @if (error()) {
        <div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ error() }}</div>
      }

      <div>
        <h3 class="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">My Workload</h3>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div class="card">
            <p class="text-sm font-medium text-slate-500">Assigned To Me</p>
            <p class="mt-2 text-3xl font-bold text-elva-700">{{ metrics().assignedToMe }}</p>
          </div>
          <div class="card">
            <p class="text-sm font-medium text-slate-500">Open Tickets</p>
            <p class="mt-2 text-3xl font-bold text-blue-700">{{ metrics().openTickets }}</p>
          </div>
          <div class="card">
            <p class="text-sm font-medium text-slate-500">Waiting For Customer</p>
            <p class="mt-2 text-3xl font-bold text-amber-700">{{ metrics().waitingForCustomer }}</p>
          </div>
          <div class="card">
            <p class="text-sm font-medium text-slate-500">Resolved Today (Mine)</p>
            <p class="mt-2 text-3xl font-bold text-elva-800">{{ metrics().resolvedToday }}</p>
          </div>
        </div>
      </div>

      <div>
        <h3 class="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Platform Metrics</h3>
        <div class="grid gap-4 sm:grid-cols-3">
          <div class="card">
            <p class="text-sm font-medium text-slate-500">Tickets Created Today</p>
            <p class="mt-2 text-3xl font-bold text-indigo-700">{{ metrics().ticketsCreatedToday }}</p>
          </div>
          <div class="card">
            <p class="text-sm font-medium text-slate-500">Tickets Resolved Today</p>
            <p class="mt-2 text-3xl font-bold text-teal-700">{{ metrics().ticketsResolvedToday }}</p>
          </div>
          <div class="card">
            <p class="text-sm font-medium text-slate-500">Avg Resolution Time</p>
            <p class="mt-2 text-3xl font-bold text-violet-700">{{ metrics().averageResolutionTime }}h</p>
          </div>
        </div>
      </div>
    </div>
  `
})
export class DashboardComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly dashboard = inject(DashboardService);

  readonly user = this.auth.currentUser;
  readonly error = signal('');
  readonly metrics = signal({
    assignedToMe: 0,
    openTickets: 0,
    waitingForCustomer: 0,
    resolvedToday: 0,
    ticketsCreatedToday: 0,
    ticketsResolvedToday: 0,
    averageResolutionTime: 0
  });

  ngOnInit(): void {
    this.dashboard.getAgentMetrics().subscribe({
      next: (res) => this.metrics.set(res.data),
      error: (err: HttpErrorResponse) => this.error.set(err.error?.message || 'Failed to load metrics')
    });
  }
}
