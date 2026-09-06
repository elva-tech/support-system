import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PortalContextService } from '../../core/portal/portal-context.service';
import { environment } from '../../../environments/environment';
import { ElvaFooterComponent } from '../../shared/components/elva-footer/elva-footer.component';

@Component({
  selector: 'app-invalid-portal',
  standalone: true,
  imports: [CommonModule, ElvaFooterComponent],
  template: `
    <div class="flex min-h-screen flex-col bg-slate-100">
      <main class="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-12">
        <div class="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          @if (isLikelyMissingTenant) {
            <h1 class="text-xl font-bold text-slate-900">Workspace not found</h1>
            <p class="mt-3 text-sm text-slate-600">
              This workspace may no longer exist or the address may be incorrect.
            </p>
          } @else {
            <h1 class="text-xl font-bold text-slate-900">This host is not a valid portal</h1>
            <p class="mt-3 text-sm text-slate-600">
              Hostname <strong>{{ portal.hostname }}</strong> could not be mapped to the public site,
              platform administration, or a tenant workspace.
            </p>
          }
          <a class="btn-primary mt-6 inline-flex" [href]="apexUrl">Back to ELVA Support</a>
          <p class="mt-4 text-xs text-slate-400">Reason: {{ portal.reason }}</p>
        </div>
      </main>
      <app-elva-footer variant="light" companyName="ELVA Support" />
    </div>
  `
})
export class InvalidPortalComponent {
  readonly portal = inject(PortalContextService);
  readonly baseDomain = environment.tenantBaseDomain;
  readonly apexUrl = `https://${environment.tenantBaseDomain}`;

  /** Reserved / malformed hosts are not "missing tenants" — keep generic copy. */
  get isLikelyMissingTenant(): boolean {
    return this.portal.reason.startsWith('reserved-slug:') === false && this.portal.isUnknownPortal;
  }
}
