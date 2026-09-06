import { Injectable, effect, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { BrandingService, ELVA_FAVICON_PATH, NEUTRAL_WORKSPACE_ICON } from './branding.service';
import { PortalContextService } from './portal-context.service';

/**
 * Centralized document title + favicon for apex / admin / tenant hosts.
 */
@Injectable({ providedIn: 'root' })
export class PortalDocumentTitleService {
  private readonly title = inject(Title);
  private readonly portal = inject(PortalContextService);
  private readonly branding = inject(BrandingService);
  private readonly router = inject(Router);
  private pageSuffix = '';

  constructor() {
    effect(() => {
      this.branding.branding();
      this.branding.workspaceUnavailable();
      this.branding.bootstrapState();
      this.apply();
    });

    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        this.pageSuffix = this.suffixFromUrl(e.urlAfterRedirects);
        this.apply();
      });
  }

  /** Optional page-level suffix, e.g. "Ticket Queue" */
  setPageSuffix(suffix: string): void {
    this.pageSuffix = String(suffix || '').trim();
    this.apply();
  }

  apply(): void {
    this.applyTitle();
    this.applyFavicon();
  }

  private applyTitle(): void {
    if (this.portal.isApexPortal) {
      this.title.setTitle('ELVA Support — Customer Support Platform');
      return;
    }

    if (this.portal.isPlatformPortal) {
      const suffix = this.pageSuffix || 'Platform Administration';
      this.title.setTitle(`ELVA Support — ${suffix}`);
      return;
    }

    if (this.portal.isTenantPortal) {
      if (this.branding.bootstrapState() === 'not-found' || this.branding.workspaceUnavailable()) {
        this.title.setTitle('Workspace not found');
        return;
      }
      if (this.branding.bootstrapState() === 'loading') {
        this.title.setTitle('Loading workspace…');
        return;
      }
      const b = this.branding.branding();
      const org = b.organizationName || b.supportDisplayName || b.productName || 'Support';
      const suffix = this.pageSuffix || this.defaultTenantSuffix();
      this.title.setTitle(suffix ? `${org} — ${suffix}` : org);
      return;
    }

    this.title.setTitle('Portal unavailable');
  }

  private applyFavicon(): void {
    if (typeof document === 'undefined') {
      return;
    }

    let href = ELVA_FAVICON_PATH;
    if (this.portal.isTenantPortal) {
      if (this.branding.bootstrapState() === 'not-found' || this.branding.workspaceUnavailable()) {
        href = NEUTRAL_WORKSPACE_ICON;
      } else {
        const b = this.branding.branding();
        href = b.faviconUrl || b.logoUrl || NEUTRAL_WORKSPACE_ICON;
      }
    } else if (this.portal.isUnknownPortal) {
      href = NEUTRAL_WORKSPACE_ICON;
    }

    let link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    if (link.href !== href && !link.href.endsWith(href)) {
      link.href = href;
    }
  }

  private defaultTenantSuffix(): string {
    const url = this.router.url.split('?')[0];
    if (url.startsWith('/merchant')) return 'Customer Support';
    if (url.startsWith('/auth/login')) return 'Sign In';
    if (url.startsWith('/settings') || url.startsWith('/setup')) return 'Workspace Settings';
    if (url.startsWith('/tickets') || url.startsWith('/my-tickets') || url.startsWith('/team-queue')) {
      return 'Ticket Queue';
    }
    if (url === '/' || url === '') return 'Customer Support';
    return 'Staff Portal';
  }

  private suffixFromUrl(url: string): string {
    const path = url.split('?')[0];
    if (this.portal.isPlatformPortal) {
      if (path.includes('/provision')) return 'Provision Business';
      if (path.includes('/tenants')) return 'Businesses';
      if (path.includes('/audit')) return 'Audit';
      if (path.includes('/dashboard') || path === '/' || path === '') return 'Platform Administration';
      return 'Platform Administration';
    }
    return this.defaultTenantSuffix();
  }
}
