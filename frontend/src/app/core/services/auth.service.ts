import { Injectable, signal, computed } from '@angular/core';
import { User, UserRole } from '../models';

const TOKEN_KEY = 'elva_token';
const USER_KEY = 'elva_user';

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
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    this.tokenSignal.set(token);
    this.userSignal.set(user);
  }

  updateUser(user: User): void {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    this.userSignal.set(user);
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.tokenSignal.set(null);
    this.userSignal.set(null);
  }

  hasRole(...roles: UserRole[]): boolean {
    const user = this.userSignal();
    return !!user && roles.includes(user.role);
  }

  private readToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  private readUser(): User | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  }
}
