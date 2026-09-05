import { Injectable, computed, signal } from '@angular/core';

export type PlatformRole = 'PLATFORM_SUPER_ADMIN' | 'PLATFORM_ADMIN' | 'PLATFORM_SUPPORT';

export interface PlatformAdmin {
  id: string;
  name: string;
  email: string;
  role: PlatformRole;
  status: string;
  lastLoginAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

const PLATFORM_TOKEN_KEY = 'platform_access_token';
const PLATFORM_USER_KEY = 'platform_admin_user';

@Injectable({ providedIn: 'root' })
export class PlatformAuthService {
  private readonly tokenSignal = signal<string | null>(this.readToken());
  private readonly adminSignal = signal<PlatformAdmin | null>(this.readAdmin());

  readonly token = this.tokenSignal.asReadonly();
  readonly currentAdmin = this.adminSignal.asReadonly();
  readonly isAuthenticated = computed(() => !!this.tokenSignal());

  setSession(token: string, admin: PlatformAdmin): void {
    localStorage.setItem(PLATFORM_TOKEN_KEY, token);
    localStorage.setItem(PLATFORM_USER_KEY, JSON.stringify(admin));
    this.tokenSignal.set(token);
    this.adminSignal.set(admin);
  }

  updateAdmin(admin: PlatformAdmin): void {
    localStorage.setItem(PLATFORM_USER_KEY, JSON.stringify(admin));
    this.adminSignal.set(admin);
  }

  logout(): void {
    localStorage.removeItem(PLATFORM_TOKEN_KEY);
    localStorage.removeItem(PLATFORM_USER_KEY);
    this.tokenSignal.set(null);
    this.adminSignal.set(null);
  }

  hasRole(...roles: PlatformRole[]): boolean {
    const admin = this.adminSignal();
    return !!admin && roles.includes(admin.role);
  }

  private readToken(): string | null {
    return localStorage.getItem(PLATFORM_TOKEN_KEY);
  }

  private readAdmin(): PlatformAdmin | null {
    const raw = localStorage.getItem(PLATFORM_USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as PlatformAdmin;
    } catch {
      return null;
    }
  }
}
