import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { environment } from '../../../../environments/environment';

/** Shown on admin.elvasupport.in if someone hits legacy /support routes. */
@Component({
  selector: 'app-platform-support-moved',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="mx-auto max-w-lg space-y-4 rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 class="text-xl font-bold text-slate-900">Central Support has moved</h1>
      <p class="text-sm text-slate-600">
        ELVA Central Support operations now run on a dedicated workspace:
      </p>
      <p>
        <a class="font-medium text-elva-brand hover:underline" [href]="supportUrl">{{ supportUrl }}</a>
      </p>
      <p class="text-sm text-slate-500">
        Platform Administration remains here for businesses, provisioning, admins, and integrity.
      </p>
      <a routerLink="/dashboard" class="btn-secondary inline-flex">Back to platform dashboard</a>
    </div>
  `
})
export class PlatformSupportMovedComponent {
  readonly supportUrl = `https://${environment.centralSupportHost || 'support.' + environment.tenantBaseDomain}`;
}
