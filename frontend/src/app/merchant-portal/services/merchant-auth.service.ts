import { Injectable, signal, computed } from '@angular/core';
import { MerchantProfile } from '../models/merchant.models';

const SESSION_KEY = 'elva_merchant_session';
const MERCHANT_KEY = 'elva_merchant_profile';

@Injectable({ providedIn: 'root' })
export class MerchantAuthService {
  private readonly sessionSignal = signal<string | null>(this.readSession());
  private readonly merchantSignal = signal<MerchantProfile | null>(this.readMerchant());

  readonly sessionToken = this.sessionSignal.asReadonly();
  readonly currentMerchant = this.merchantSignal.asReadonly();
  readonly isAuthenticated = computed(() => !!this.sessionSignal());

  setSession(sessionToken: string, merchant: MerchantProfile): void {
    localStorage.setItem(SESSION_KEY, sessionToken);
    localStorage.setItem(MERCHANT_KEY, JSON.stringify(merchant));
    this.sessionSignal.set(sessionToken);
    this.merchantSignal.set(merchant);
  }

  updateMerchant(merchant: MerchantProfile): void {
    localStorage.setItem(MERCHANT_KEY, JSON.stringify(merchant));
    this.merchantSignal.set(merchant);
  }

  logout(): void {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(MERCHANT_KEY);
    this.sessionSignal.set(null);
    this.merchantSignal.set(null);
  }

  private readSession(): string | null {
    return localStorage.getItem(SESSION_KEY);
  }

  private readMerchant(): MerchantProfile | null {
    const raw = localStorage.getItem(MERCHANT_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as MerchantProfile;
    } catch {
      return null;
    }
  }
}
