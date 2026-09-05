import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models';

export type TenantStatus = 'ACTIVE' | 'TRIAL' | 'SUSPENDED' | 'CANCELLED' | 'ARCHIVED';
export type ProvisioningStatus = 'PENDING' | 'IN_PROGRESS' | 'READY' | 'FAILED';

export interface PlatformTenant {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  settings?: {
    organization?: Record<string, unknown>;
    branding?: Record<string, unknown>;
    notifications?: Record<string, unknown>;
  };
  setup?: {
    status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
    progress?: { completed: number; total: number };
    completedAt?: string | null;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface ProvisioningStep {
  status: string;
  completedAt?: string | null;
  error?: string | null;
}

export interface PlatformProvisioning {
  id: string;
  tenantId: string | null;
  tenantSlug: string;
  tenantName: string;
  tenantAdminUserId?: string | null;
  tenantAdminName: string;
  tenantAdminEmail: string;
  workspaceUrl: string;
  status: ProvisioningStatus;
  steps: {
    tenantCreated?: ProvisioningStep;
    workspaceInitialized?: ProvisioningStep;
    adminCreated?: ProvisioningStep;
    invitationCreated?: ProvisioningStep;
    welcomeEmail?: ProvisioningStep;
  };
  failure?: {
    code?: string | null;
    message?: string | null;
    atStep?: string | null;
    at?: string | null;
  } | null;
  completedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface PaginatedList<T> {
  items: T[];
  total: number;
  limit: number;
  skip: number;
}

export interface ProvisionTenantRequest {
  tenant: {
    name: string;
    slug: string;
    status?: TenantStatus;
    settings?: Record<string, unknown>;
  };
  admin: {
    name: string;
    email: string;
  };
}

export interface PlatformAuditItem {
  _id: string;
  action: string;
  actorEmail?: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface IntegrityFinding {
  id: string;
  collection: string;
  issueType: string;
  severity: string;
  recordId: string;
  actualTenantId?: string | null;
  expectedTenantId?: string | null;
  suggestedTenantId?: string | null;
  relatedRecord?: { type: string; id: string } | null;
  repairable: boolean;
  reason?: string;
}

@Injectable({ providedIn: 'root' })
export class PlatformApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/platform`;

  listTenants(query: {
    status?: string;
    search?: string;
    limit?: number;
    skip?: number;
  } = {}): Observable<ApiResponse<PaginatedList<PlatformTenant>>> {
    let params = new HttpParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    });
    return this.http.get<ApiResponse<PaginatedList<PlatformTenant>>>(`${this.baseUrl}/tenants`, {
      params
    });
  }

  getTenant(tenantId: string): Observable<ApiResponse<PlatformTenant>> {
    return this.http.get<ApiResponse<PlatformTenant>>(`${this.baseUrl}/tenants/${tenantId}`);
  }

  activateTenant(tenantId: string): Observable<ApiResponse<PlatformTenant>> {
    return this.http.post<ApiResponse<PlatformTenant>>(
      `${this.baseUrl}/tenants/${tenantId}/activate`,
      {}
    );
  }

  suspendTenant(tenantId: string): Observable<ApiResponse<PlatformTenant>> {
    return this.http.post<ApiResponse<PlatformTenant>>(
      `${this.baseUrl}/tenants/${tenantId}/suspend`,
      {}
    );
  }

  cancelTenant(tenantId: string): Observable<ApiResponse<PlatformTenant>> {
    return this.http.post<ApiResponse<PlatformTenant>>(
      `${this.baseUrl}/tenants/${tenantId}/cancel`,
      {}
    );
  }

  archiveTenant(tenantId: string): Observable<ApiResponse<PlatformTenant>> {
    return this.http.post<ApiResponse<PlatformTenant>>(
      `${this.baseUrl}/tenants/${tenantId}/archive`,
      {}
    );
  }

  provisionTenant(
    body: ProvisionTenantRequest
  ): Observable<{ message: string; data: PlatformProvisioning }> {
    return this.http.post<{ message: string; data: PlatformProvisioning }>(
      `${this.baseUrl}/tenants/provision`,
      body
    );
  }

  listProvisionings(query: {
    status?: string;
    search?: string;
    tenantId?: string;
    limit?: number;
    skip?: number;
  } = {}): Observable<ApiResponse<PaginatedList<PlatformProvisioning>>> {
    let params = new HttpParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    });
    return this.http.get<ApiResponse<PaginatedList<PlatformProvisioning>>>(
      `${this.baseUrl}/provisionings`,
      { params }
    );
  }

  getProvisioning(id: string): Observable<ApiResponse<PlatformProvisioning>> {
    return this.http.get<ApiResponse<PlatformProvisioning>>(
      `${this.baseUrl}/provisionings/${id}`
    );
  }

  retryProvisioning(id: string): Observable<{ message: string; data: PlatformProvisioning }> {
    return this.http.post<{ message: string; data: PlatformProvisioning }>(
      `${this.baseUrl}/provisionings/${id}/retry`,
      {}
    );
  }

  resendInvitation(id: string): Observable<{ message: string; data: PlatformProvisioning }> {
    return this.http.post<{ message: string; data: PlatformProvisioning }>(
      `${this.baseUrl}/provisionings/${id}/resend-invitation`,
      {}
    );
  }

  listAudit(
    query: {
      action?: string;
      targetType?: string;
      search?: string;
      from?: string;
      to?: string;
      tenantId?: string;
      page?: number;
      limit?: number;
      skip?: number;
    } = {}
  ): Observable<ApiResponse<PaginatedList<PlatformAuditItem> & { page?: number; totalPages?: number }>> {
    let params = new HttpParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    });
    return this.http.get<
      ApiResponse<PaginatedList<PlatformAuditItem> & { page?: number; totalPages?: number }>
    >(`${this.baseUrl}/audit`, { params });
  }

  getIntegritySummary(): Observable<ApiResponse<Record<string, unknown>>> {
    return this.http.get<ApiResponse<Record<string, unknown>>>(`${this.baseUrl}/integrity/summary`);
  }

  listIntegrityFindings(
    query: Record<string, string | number | boolean | undefined> = {}
  ): Observable<{
    data: IntegrityFinding[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
    summary?: Record<string, number>;
  }> {
    let params = new HttpParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    });
    return this.http.get<{
      data: IntegrityFinding[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
      summary?: Record<string, number>;
    }>(`${this.baseUrl}/integrity/findings`, { params });
  }

  runIntegrityScan(collections?: string[]): Observable<{ data: Record<string, unknown>; findingsCount: number }> {
    return this.http.post<{ data: Record<string, unknown>; findingsCount: number }>(
      `${this.baseUrl}/integrity/scan`,
      { collections }
    );
  }

  repairIntegrity(payload: {
    collection: string;
    recordId: string;
    tenantId: string;
    confirmation: boolean;
  }): Observable<{ message: string; data: Record<string, unknown> }> {
    return this.http.post<{ message: string; data: Record<string, unknown> }>(
      `${this.baseUrl}/integrity/repair`,
      payload
    );
  }

  repairIntegrityAuto(payload: {
    collection: string;
    dryRun?: boolean;
    confirmation?: boolean;
    limit?: number;
  }): Observable<{ message: string; data: Record<string, unknown> }> {
    return this.http.post<{ message: string; data: Record<string, unknown> }>(
      `${this.baseUrl}/integrity/repair-auto`,
      payload
    );
  }

  listAdmins(query: { search?: string; limit?: number; skip?: number } = {}): Observable<
    ApiResponse<PaginatedList<Record<string, unknown>>>
  > {
    let params = new HttpParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    });
    return this.http.get<ApiResponse<PaginatedList<Record<string, unknown>>>>(
      `${this.baseUrl}/admins`,
      { params }
    );
  }
}
