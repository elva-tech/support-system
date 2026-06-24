import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MerchantApiService } from '../../services/merchant-api.service';
import { MerchantTicketService } from '../../services/merchant-ticket.service';
import { MerchantAuthService } from '../../services/merchant-auth.service';
import { MerchantProfile, MerchantApplication } from '../../models/merchant.models';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';

@Component({
  selector: 'app-merchant-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, StatusBadgeComponent],
  template: `
    @if (merchant(); as m) {
      <div class="space-y-6">
        <div class="card">
          <h2 class="text-xl font-bold text-slate-900">{{ m.merchantName }}</h2>
          <p class="mt-1 text-sm text-slate-500">Welcome to your merchant support portal</p>
        </div>

        <div class="grid gap-4 sm:grid-cols-3">
          <div class="card">
            <p class="text-sm font-medium text-slate-500">Open</p>
            <p class="mt-2 text-3xl font-bold text-blue-700">{{ stats().open }}</p>
          </div>
          <div class="card">
            <p class="text-sm font-medium text-slate-500">Resolved</p>
            <p class="mt-2 text-3xl font-bold text-elva-800">{{ stats().resolved }}</p>
          </div>
          <div class="card">
            <p class="text-sm font-medium text-slate-500">Closed</p>
            <p class="mt-2 text-3xl font-bold text-slate-700">{{ stats().closed }}</p>
          </div>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <div class="card">
            <p class="text-sm font-medium text-slate-500">Application</p>
            <p class="mt-2 text-lg font-semibold text-slate-900">{{ applicationName(m) }}</p>
            <p class="text-xs font-mono text-slate-400">{{ m.applicationCode }}</p>
          </div>
          <div class="card">
            <p class="text-sm font-medium text-slate-500">Email</p>
            <p class="mt-2 text-lg font-semibold text-slate-900">{{ m.email }}</p>
            <div class="mt-2"><app-status-badge [active]="m.isActive" /></div>
          </div>
        </div>

        <div class="flex flex-wrap gap-3">
          <a routerLink="/merchant/tickets/new" class="btn-primary">Create Ticket</a>
          <a routerLink="/merchant/tickets" class="btn-secondary">View My Tickets</a>
        </div>
      </div>
    } @else {
      <div class="card text-center text-slate-500">Loading...</div>
    }
  `
})
export class MerchantDashboardComponent implements OnInit {
  private readonly api = inject(MerchantApiService);
  private readonly ticketApi = inject(MerchantTicketService);
  private readonly auth = inject(MerchantAuthService);

  readonly merchant = this.auth.currentMerchant;
  readonly stats = signal({ open: 0, resolved: 0, closed: 0 });

  ngOnInit(): void {
    this.api.getMe().subscribe();
    this.ticketApi.getStats().subscribe((res) => this.stats.set(res.data));
  }

  applicationName(m: MerchantProfile): string {
    const app = m.applicationId;
    if (typeof app === 'string') return m.applicationCode;
    return (app as MerchantApplication).name;
  }
}
