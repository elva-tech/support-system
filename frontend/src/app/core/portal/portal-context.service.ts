import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import {
  PortalHostConfig,
  PortalHostResult,
  PortalType,
  resolvePortalFromHost
} from './portal-host.util';

@Injectable({ providedIn: 'root' })
export class PortalContextService {
  private readonly resolved: PortalHostResult;

  constructor() {
    const config: PortalHostConfig = {
      tenantBaseDomain: environment.tenantBaseDomain,
      platformAdminHost: environment.platformAdminHost,
      developmentTenantSlug: environment.developmentTenantSlug,
      portalMode: environment.portalMode,
      production: environment.production
    };
    const host =
      typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    this.resolved = resolvePortalFromHost(host, config);
  }

  get portalType(): PortalType {
    return this.resolved.portalType;
  }

  get tenantSlug(): string | null {
    return this.resolved.tenantSlug;
  }

  get hostname(): string {
    return this.resolved.hostname;
  }

  get isLocalhost(): boolean {
    return this.resolved.isLocalhost;
  }

  get reason(): string {
    return this.resolved.reason;
  }

  get isApexPortal(): boolean {
    return this.resolved.portalType === 'APEX';
  }

  get isPlatformPortal(): boolean {
    return this.resolved.portalType === 'PLATFORM';
  }

  get isTenantPortal(): boolean {
    return this.resolved.portalType === 'TENANT';
  }

  get isUnknownPortal(): boolean {
    return this.resolved.portalType === 'UNKNOWN';
  }

  /** Dev-only: send X-Tenant-Slug when backend expects header override. */
  get shouldSendTenantSlugHeader(): boolean {
    return (
      this.isTenantPortal &&
      !!this.tenantSlug &&
      !!environment.sendTenantSlugHeader &&
      !environment.production
    );
  }

  get snapshot(): PortalHostResult {
    return { ...this.resolved };
  }

  get platformLoginUrl(): string {
    if (this.isLocalhost && !environment.production) {
      return '/login';
    }
    return `https://${environment.platformAdminHost}/login`;
  }

  get apexUrl(): string {
    if (this.isLocalhost && !environment.production) {
      return '/';
    }
    return `https://${environment.tenantBaseDomain}`;
  }
}
