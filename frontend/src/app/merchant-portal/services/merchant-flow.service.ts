import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class MerchantFlowService {
  private readonly emailSignal = signal('');

  readonly pendingEmail = this.emailSignal.asReadonly();

  setPendingEmail(email: string): void {
    this.emailSignal.set(email);
  }

  clearPendingEmail(): void {
    this.emailSignal.set('');
  }
}
