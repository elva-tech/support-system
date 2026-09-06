import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CentralSupportAuthApiService } from '../../../core/services/central-support-auth-api.service';
import {
  CentralSupportAuthService,
  CentralSupportUser
} from '../../../core/services/central-support-auth.service';
import { formatApiError } from '../../../shared/utils/api-error.util';

@Component({
  selector: 'app-central-support-profile',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="mx-auto max-w-lg space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 class="text-2xl font-bold text-slate-900">Profile</h1>
      @if (error()) {
        <div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ error() }}</div>
      }
      @if (user(); as u) {
        <dl class="space-y-3 text-sm">
          <div>
            <dt class="text-xs uppercase text-slate-400">Name</dt>
            <dd class="font-medium">{{ u.name }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase text-slate-400">Email</dt>
            <dd class="font-medium">{{ u.email }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase text-slate-400">Role</dt>
            <dd class="font-medium">{{ roleLabel(u.role) }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase text-slate-400">Status</dt>
            <dd class="font-medium">{{ u.status }}</dd>
          </div>
        </dl>
      } @else if (!error()) {
        <p class="text-sm text-slate-500">Loading…</p>
      }
    </div>
  `
})
export class CentralSupportProfileComponent implements OnInit {
  private readonly auth = inject(CentralSupportAuthService);
  private readonly api = inject(CentralSupportAuthApiService);

  readonly user = signal<CentralSupportUser | null>(this.auth.currentUser());
  readonly error = signal('');

  ngOnInit(): void {
    this.api.getMe().subscribe({
      next: (res) => this.user.set(res.data),
      error: (err) => {
        this.user.set(this.auth.currentUser());
        this.error.set(formatApiError(err, 'Could not refresh profile'));
      }
    });
  }

  roleLabel(role: string): string {
    if (role === 'CENTRAL_SUPPORT_ADMIN') return 'Admin';
    if (role === 'CENTRAL_SUPPORT_TEAM_LEAD') return 'Team Lead';
    if (role === 'CENTRAL_SUPPORT_AGENT') return 'Agent';
    return role;
  }
}
