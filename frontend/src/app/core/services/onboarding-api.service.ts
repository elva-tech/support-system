import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models';

export interface InvitationValidation {
  valid: boolean;
  invitationType?: 'TENANT_ADMIN' | 'STAFF';
  tenantName?: string;
  tenantSlug?: string;
  adminName?: string;
  adminEmail?: string;
  role?: string;
  expiresAt?: string;
}

export interface CompleteSetupRequest {
  token: string;
  password: string;
  confirmPassword?: string;
}

export interface CompleteSetupResult {
  success: boolean;
  tenantSlug?: string | null;
  email?: string;
}

@Injectable({ providedIn: 'root' })
export class OnboardingApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/onboarding`;

  validateInvitation(token: string): Observable<ApiResponse<InvitationValidation>> {
    return this.http.get<ApiResponse<InvitationValidation>>(
      `${this.baseUrl}/invitation/${encodeURIComponent(token)}`
    );
  }

  completeSetup(
    body: CompleteSetupRequest
  ): Observable<{ message: string; data: CompleteSetupResult }> {
    return this.http.post<{ message: string; data: CompleteSetupResult }>(
      `${this.baseUrl}/complete-setup`,
      body
    );
  }
}
