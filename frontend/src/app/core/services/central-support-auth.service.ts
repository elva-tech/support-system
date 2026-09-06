import { Injectable, computed, signal } from '@angular/core';

export type CentralSupportRole =
  | 'CENTRAL_SUPPORT_ADMIN'
  | 'CENTRAL_SUPPORT_TEAM_LEAD'
  | 'CENTRAL_SUPPORT_AGENT';

export interface CentralSupportUser {
  id: string;
  name: string;
  email: string;
  role: CentralSupportRole;
  status: string;
  teamId?: string | null;
  lastLoginAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

const CS_TOKEN_KEY = 'central_support_access_token';
const CS_USER_KEY = 'central_support_user';

@Injectable({ providedIn: 'root' })
export class CentralSupportAuthService {
  private readonly tokenSignal = signal<string | null>(this.readToken());
  private readonly userSignal = signal<CentralSupportUser | null>(this.readUser());

  readonly token = this.tokenSignal.asReadonly();
  readonly currentUser = this.userSignal.asReadonly();
  readonly isAuthenticated = computed(() => !!this.tokenSignal());

  setSession(token: string, user: CentralSupportUser): void {
    localStorage.setItem(CS_TOKEN_KEY, token);
    localStorage.setItem(CS_USER_KEY, JSON.stringify(user));
    this.tokenSignal.set(token);
    this.userSignal.set(user);
  }

  updateUser(user: CentralSupportUser): void {
    localStorage.setItem(CS_USER_KEY, JSON.stringify(user));
    this.userSignal.set(user);
  }

  logout(): void {
    localStorage.removeItem(CS_TOKEN_KEY);
    localStorage.removeItem(CS_USER_KEY);
    this.tokenSignal.set(null);
    this.userSignal.set(null);
  }

  hasRole(...roles: CentralSupportRole[]): boolean {
    const user = this.userSignal();
    return !!user && roles.includes(user.role);
  }

  private readToken(): string | null {
    return localStorage.getItem(CS_TOKEN_KEY);
  }

  private readUser(): CentralSupportUser | null {
    const raw = localStorage.getItem(CS_USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as CentralSupportUser;
    } catch {
      return null;
    }
  }
}
