import { Component, DestroyRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MerchantAuthService } from '../services/merchant-auth.service';
import { MerchantApiService } from '../services/merchant-api.service';
import { ElvaFooterComponent } from '../../shared/components/elva-footer/elva-footer.component';
import { ElvaHeaderComponent } from '../../shared/components/elva-header/elva-header.component';

type MerchantTab = {
  label: string;
  path: string;
  match: 'exact' | 'tickets';
};

@Component({
  selector: 'app-merchant-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, ElvaHeaderComponent, ElvaFooterComponent],
  template: `
    <div class="flex min-h-screen flex-col bg-slate-50">
      <app-elva-header subtitle="Customer Portal" [showActionsOnMobile]="true">
        <button
          type="button"
          class="shrink-0 rounded-lg border border-white/20 px-3 py-1.5 text-xs text-white transition hover:bg-white/10 sm:text-sm"
          (click)="logout()"
          [disabled]="loggingOut"
        >
          {{ loggingOut ? 'Signing out...' : 'Sign out' }}
        </button>
      </app-elva-header>

      <nav class="border-b border-slate-200 bg-slate-200/90">
        <div class="mx-auto flex w-full max-w-5xl gap-0.5 px-3 pt-2 sm:px-6">
          @for (tab of tabs; track tab.path) {
            <a
              [routerLink]="tab.path"
              class="merchant-tab"
              [class.merchant-tab-active]="isTabActive(tab)"
              [attr.aria-current]="isTabActive(tab) ? 'page' : null"
            >
              {{ tab.label }}
            </a>
          }
        </div>
      </nav>

      <main class="mx-auto w-full max-w-5xl flex-1 bg-white p-4 sm:p-6">
        <router-outlet />
      </main>

      <app-elva-footer variant="light" />
    </div>
  `,
  styles: [
    `
      .merchant-tab {
        @apply relative -mb-px rounded-t-lg border border-transparent px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-white/50;
      }

      .merchant-tab-active {
        @apply z-10 border-slate-200 border-b-white bg-white font-semibold text-elva-brand shadow-[0_-1px_2px_rgba(0,0,0,0.04)];
      }
    `
  ]
})
export class MerchantShellComponent {
  private readonly auth = inject(MerchantAuthService);
  private readonly api = inject(MerchantApiService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  loggingOut = false;
  readonly currentUrl = signal(this.router.url);

  readonly tabs: MerchantTab[] = [
    { label: 'Dashboard', path: '/merchant/dashboard', match: 'exact' },
    { label: 'New Ticket', path: '/merchant/tickets/new', match: 'exact' },
    { label: 'My Tickets', path: '/merchant/tickets', match: 'tickets' }
  ];

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((event) => this.currentUrl.set(event.urlAfterRedirects));
  }

  isTabActive(tab: MerchantTab): boolean {
    const url = this.currentUrl().split('?')[0];

    if (tab.match === 'exact') {
      return url === tab.path;
    }

    return url === '/merchant/tickets' || (url.startsWith('/merchant/tickets/') && url !== '/merchant/tickets/new');
  }

  logout(): void {
    this.loggingOut = true;
    this.api.logout().subscribe({
      complete: () => {
        this.loggingOut = false;
        this.router.navigate(['/']);
      },
      error: () => {
        this.auth.logout();
        this.loggingOut = false;
        this.router.navigate(['/']);
      }
    });
  }
}
