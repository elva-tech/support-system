import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlatformAuthService } from '../../../core/services/platform-auth.service';

@Component({
  selector: 'app-platform-profile',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="mx-auto max-w-lg space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 class="text-2xl font-bold text-slate-900">Profile</h1>
      @if (admin(); as a) {
        <dl class="space-y-3 text-sm">
          <div>
            <dt class="text-xs uppercase text-slate-400">Name</dt>
            <dd class="font-medium">{{ a.name }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase text-slate-400">Email</dt>
            <dd class="font-medium">{{ a.email }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase text-slate-400">Role</dt>
            <dd class="font-medium">{{ a.role }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase text-slate-400">Status</dt>
            <dd class="font-medium">{{ a.status }}</dd>
          </div>
        </dl>
      }
    </div>
  `
})
export class PlatformProfileComponent {
  readonly admin = inject(PlatformAuthService).currentAdmin;
}
