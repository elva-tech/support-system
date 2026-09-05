import { Injectable, signal, computed } from '@angular/core';
import { User, UserRole } from '../models';

/** Phase 7 tenant staff token — separate from platform_access_token */
const TENANT_TOKEN_KEY = 'tenant_access_token';
const TENANT_USER_KEY = 'tenant_user';
/** Legacy keys from pre-Phase-7 staff portal */
const LEGACY_TOKEN_KEY = 'elva_token';
const LEGACY_USER_KEY = 'elva_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly tokenSignal = signal<string | null>(this.readToken());
  private readonly userSignal = signal<User | null>(this.readUser());

  readonly token = this.tokenSignal.asReadonly();
  readonly currentUser = this.userSignal.asReadonly();
  readonly isAuthenticated = computed(() => !!this.tokenSignal());
  readonly isAdmin = computed(() => this.userSignal()?.role === 'ADMIN');
  readonly isTeamLead = computed(() => this.userSignal()?.role === 'TEAM_LEAD');
  readonly canAssign = computed(() => {
    const role = this.userSignal()?.role;
    return role === 'ADMIN' || role === 'TEAM_LEAD';
  });

  setSession(token: string, user: User): void {
    localStorage.setItem(TENANT_TOKEN_KEY, token);
    localStorage.setItem(TENANT_USER_KEY, JSON.stringify(user));
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    localStorage.removeItem(LEGACY_USER_KEY);
    this.tokenSignal.set(token);
    this.userSignal.set(user);
  }

  updateUser(user: User): void {
    localStorage.setItem(TENANT_USER_KEY, JSON.stringify(user));
    this.userSignal.set(user);
  }

  logout(): void {
    localStorage.removeItem(TENANT_TOKEN_KEY);
    localStorage.removeItem(TENANT_USER_KEY);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    localStorage.removeItem(LEGACY_USER_KEY);
    this.tokenSignal.set(null);
    this.userSignal.set(null);
  }

  hasRole(...roles: UserRole[]): boolean {
    const user = this.userSignal();
    return !!user && roles.includes(user.role);
  }

  private readToken(): string | null {
    return localStorage.getItem(TENANT_TOKEN_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY);
  }

  private readUser(): User | null {
    const raw = localStorage.getItem(TENANT_USER_KEY) || localStorage.getItem(LEGACY_USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  }
}
