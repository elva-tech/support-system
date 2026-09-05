import { Injectable, effect, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { BrandingService } from './branding.service';
import { PortalContextService } from './portal-context.service';

/**
 * Sets meaningful browser titles for apex / admin / tenant / unknown hosts.
 */
@Injectable({ providedIn: 'root' })
export class PortalDocumentTitleService {
  private readonly title = inject(Title);
  private readonly portal = inject(PortalContextService);
  private readonly branding = inject(BrandingService);

  constructor() {
    effect(() => {
      // Re-run when branding signal changes
      this.branding.branding();
      this.branding.workspaceUnavailable();
      this.apply();
    });
  }

  apply(): void {
    if (this.portal.isApexPortal) {
      this.title.setTitle('ELVA Support — Customer Support Platform');
      return;
    }

    if (this.portal.isPlatformPortal) {
      this.title.setTitle('ELVA Support — Platform Administration');
      return;
    }

    if (this.portal.isTenantPortal) {
      if (this.branding.workspaceUnavailable()) {
        this.title.setTitle('Workspace not found — ELVA Support');
        return;
      }
      const b = this.branding.branding();
      const name = b.supportDisplayName || b.productName || 'Support Portal';
      this.title.setTitle(`${name}`);
      return;
    }

    this.title.setTitle('Portal unavailable — ELVA Support');
  }
}
