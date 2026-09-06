import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { BrandingService } from './core/portal/branding.service';
import { PortalContextService } from './core/portal/portal-context.service';
import { PortalDocumentTitleService } from './core/portal/portal-document-title.service';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  template: `
    @if (branding.showTenantBootstrapOverlay()) {
      <div class="flex min-h-screen flex-col items-center justify-center bg-slate-100 px-4">
        @if (branding.bootstrapState() === 'not-found' || branding.workspaceUnavailable()) {
          <div class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <h1 class="text-xl font-bold text-slate-900">This host is not a valid portal</h1>
            <p class="mt-3 text-sm text-slate-600">
              {{
                branding.bootstrapError() ||
                  'This workspace may no longer exist or the address may be incorrect.'
              }}
            </p>
            <p class="mt-2 text-xs text-slate-400">Hostname: {{ portal.hostname }}</p>
            <a class="btn-primary mt-6 inline-flex" [href]="apexUrl">Back to ELVA Support</a>
          </div>
        } @else if (branding.bootstrapState() === 'error') {
          <div class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <h1 class="text-xl font-bold text-slate-900">Unable to load workspace</h1>
            <p class="mt-3 text-sm text-slate-600">
              {{ branding.bootstrapError() || 'Please try again in a moment.' }}
            </p>
            <button type="button" class="btn-primary mt-6" (click)="retryBootstrap()">Retry</button>
          </div>
        } @else {
          <div class="flex flex-col items-center gap-4 text-slate-600">
            <div
              class="h-10 w-10 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600"
              aria-hidden="true"
            ></div>
            <p class="text-sm font-medium">Loading workspace…</p>
          </div>
        }
      </div>
    } @else {
      <router-outlet />
    }
  `
})
export class AppComponent implements OnInit {
  readonly branding = inject(BrandingService);
  readonly portal = inject(PortalContextService);
  /** Eager init — titles/favicon */
  private readonly documentTitle = inject(PortalDocumentTitleService);
  readonly apexUrl = `https://${environment.tenantBaseDomain}`;

  ngOnInit(): void {
    this.branding.bootstrapPortal();
  }

  retryBootstrap(): void {
    this.branding.loadTenantBranding({ force: true });
  }
}
