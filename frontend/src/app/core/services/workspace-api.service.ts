import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models';

export type WorkspaceSetupStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

export interface WorkspaceSetupSteps {
  organization: boolean;
  branding: boolean;
  team: boolean;
  application: boolean;
  users: boolean;
  client: boolean;
}

export interface WorkspaceSetup {
  status: WorkspaceSetupStatus;
  steps: WorkspaceSetupSteps;
  skipped?: {
    branding?: boolean;
    users?: boolean;
    client?: boolean;
  };
  completedAt?: string | null;
  progress?: {
    completed: number;
    total: number;
    requiredCompleted: number;
    requiredTotal: number;
  };
}

export interface WorkspaceOrganization {
  displayName?: string;
  name?: string;
  legalName?: string;
  supportDisplayName?: string;
  primaryContactName?: string;
  primaryContactEmail?: string;
  supportEmail?: string;
  phone?: string;
  website?: string;
  timezone?: string;
  country?: string;
  address?: string;
}

export interface WorkspaceBrandingSettings {
  supportDisplayName?: string;
  primaryColor?: string | null;
  logoFileId?: string | null;
  logoFileName?: string | null;
  logoMimeType?: string | null;
  logoUrl?: string | null;
}

export interface WorkspaceSettings {
  tenant: { id: string; name: string; slug: string; status: string };
  organization: WorkspaceOrganization;
  branding: WorkspaceBrandingSettings;
  notifications: Record<string, unknown>;
  setup: WorkspaceSetup;
  emailBranding?: { supportDisplayName: string; tenantName: string };
}

export interface PublicWorkspaceBranding {
  tenantName: string;
  tenantSlug: string;
  displayName: string;
  supportDisplayName: string;
  primaryColor: string | null;
  logoUrl: string | null;
  hasLogo: boolean;
}

@Injectable({ providedIn: 'root' })
export class WorkspaceApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/workspace`;

  getSettings(): Observable<ApiResponse<WorkspaceSettings>> {
    return this.http.get<ApiResponse<WorkspaceSettings>>(`${this.base}/settings`);
  }

  getSetupStatus(): Observable<ApiResponse<WorkspaceSetup>> {
    return this.http.get<ApiResponse<WorkspaceSetup>>(`${this.base}/setup-status`);
  }

  getPublicBranding(): Observable<ApiResponse<PublicWorkspaceBranding>> {
    return this.http.get<ApiResponse<PublicWorkspaceBranding>>(`${this.base}/branding/public`);
  }

  updateOrganization(payload: WorkspaceOrganization): Observable<ApiResponse<{ organization: WorkspaceOrganization; setup: WorkspaceSetup }>> {
    return this.http.patch<ApiResponse<{ organization: WorkspaceOrganization; setup: WorkspaceSetup }>>(
      `${this.base}/organization`,
      payload
    );
  }

  updateBranding(payload: {
    supportDisplayName?: string;
    primaryColor?: string | null;
  }): Observable<ApiResponse<{ branding: WorkspaceBrandingSettings; setup: WorkspaceSetup }>> {
    return this.http.patch<ApiResponse<{ branding: WorkspaceBrandingSettings; setup: WorkspaceSetup }>>(
      `${this.base}/branding`,
      payload
    );
  }

  uploadLogo(file: File): Observable<ApiResponse<{ branding: WorkspaceBrandingSettings; setup: WorkspaceSetup }>> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<ApiResponse<{ branding: WorkspaceBrandingSettings; setup: WorkspaceSetup }>>(
      `${this.base}/branding/logo`,
      form
    );
  }

  deleteLogo(): Observable<ApiResponse<{ branding: WorkspaceBrandingSettings; setup: WorkspaceSetup }>> {
    return this.http.delete<ApiResponse<{ branding: WorkspaceBrandingSettings; setup: WorkspaceSetup }>>(
      `${this.base}/branding/logo`
    );
  }

  skipStep(step: 'branding' | 'users' | 'client'): Observable<ApiResponse<WorkspaceSetup>> {
    return this.http.post<ApiResponse<WorkspaceSetup>>(`${this.base}/setup/skip/${step}`, {});
  }

  /** Fetch logo bytes (tenant-scoped via interceptor headers). */
  fetchLogoBlob(): Observable<Blob> {
    return this.http.get(`${this.base}/branding/logo`, { responseType: 'blob' });
  }
}
