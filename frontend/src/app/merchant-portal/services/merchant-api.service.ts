import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  MerchantApiResponse,
  MerchantProfile,
  MerchantSessionData,
  RequestOtpResponse
} from '../models/merchant.models';
import { MerchantAuthService } from './merchant-auth.service';

@Injectable({ providedIn: 'root' })
export class MerchantApiService {
  private readonly http = inject(HttpClient);
  private readonly merchantAuth = inject(MerchantAuthService);
  private readonly baseUrl = `${environment.apiUrl}/merchant`;

  requestOtp(email: string): Observable<RequestOtpResponse> {
    return this.http.post<RequestOtpResponse>(`${this.baseUrl}/request-otp`, { email });
  }

  verifyOtp(email: string, otpCode: string): Observable<MerchantApiResponse<MerchantSessionData>> {
    return this.http
      .post<MerchantApiResponse<MerchantSessionData>>(`${this.baseUrl}/verify-otp`, { email, otpCode })
      .pipe(
        tap((res) => this.merchantAuth.setSession(res.data.sessionToken, res.data.merchant))
      );
  }

  getMe(): Observable<MerchantApiResponse<MerchantProfile>> {
    return this.http.get<MerchantApiResponse<MerchantProfile>>(`${this.baseUrl}/me`).pipe(
      tap((res) => this.merchantAuth.updateMerchant(res.data))
    );
  }

  logout(): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/logout`, {}).pipe(
      tap(() => this.merchantAuth.logout())
    );
  }
}
