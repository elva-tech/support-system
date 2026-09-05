import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PortalContextService } from '../../core/portal/portal-context.service';
import { ElvaFooterComponent } from '../../shared/components/elva-footer/elva-footer.component';
import { ElvaHeaderComponent } from '../../shared/components/elva-header/elva-header.component';

@Component({
  selector: 'app-invalid-portal',
  standalone: true,
  imports: [CommonModule, ElvaHeaderComponent, ElvaFooterComponent],
  template: `
    <div class="flex min-h-screen flex-col bg-slate-100">
      <app-elva-header subtitle="Unavailable" tagline="Portal context" />
      <main class="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-12">
        <div class="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 class="text-xl font-bold text-slate-900">This host is not a valid portal</h1>
          <p class="mt-3 text-sm text-slate-600">
            Hostname <strong>{{ portal.hostname }}</strong> could not be mapped to the Platform portal or a
            Tenant workspace.
          </p>
          <p class="mt-2 text-sm text-slate-500">
            Use <code class="rounded bg-slate-100 px-1">admin.elvasupport.in</code> for platform administration, or
            <code class="rounded bg-slate-100 px-1">{{ '{' }}slug{{ '}' }}.elvasupport.in</code> for a provisioned
            workspace.
          </p>
          <p class="mt-2 text-xs text-slate-400">Reason: {{ portal.reason }}</p>
        </div>
      </main>
      <app-elva-footer variant="light" />
    </div>
  `
})
export class InvalidPortalComponent {
  readonly portal = inject(PortalContextService);
}
