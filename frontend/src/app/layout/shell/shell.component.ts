import { Component, OnInit, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { BrandingService } from '../../core/portal/branding.service';
import { UserRole } from '../../core/models';
import { ElvaFooterComponent } from '../../shared/components/elva-footer/elva-footer.component';
import { ElvaHeaderComponent } from '../../shared/components/elva-header/elva-header.component';

interface NavItem {
  label: string;
  path: string;
  roles?: UserRole[];
  adminOnly?: boolean;
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, ElvaHeaderComponent, ElvaFooterComponent],
  template: `
    <div class="flex min-h-screen flex-col bg-slate-50">
      <app-elva-header
        [subtitle]="headerSubtitle"
        [productName]="branding.branding().productName"
        [tagline]="branding.branding().supportDisplayName"
        [logoUrl]="branding.branding().logoUrl || '/images/elva-logo.png'"
        [showActionsOnMobile]="true"
        [compactActions]="true"
      >
        <button
          type="button"
          class="shrink-0 rounded-lg border border-white/20 px-3 py-1.5 text-xs text-white transition hover:bg-white/10 sm:text-sm"
          (click)="logout()"
        >
          Sign out
        </button>
      </app-elva-header>

      <div class="flex flex-1 flex-col lg:flex-row">
        <aside class="border-b border-slate-200 bg-white lg:w-64 lg:border-b-0 lg:border-r">
          <nav class="flex gap-1 overflow-x-auto px-3 py-3 lg:flex-col lg:px-3 lg:py-4">
            @for (item of visibleNav; track item.path) {
              <a
                [routerLink]="item.path"
                routerLinkActive="bg-elva-brand text-white"
                class="shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-elva-50 hover:text-elva-brand lg:block"
              >
                {{ item.label }}
              </a>
            }
          </nav>

          <div class="hidden border-t border-slate-200 p-4 lg:block">
            <p class="truncate text-sm font-medium text-slate-900">{{ user()?.firstName }} {{ user()?.lastName }}</p>
            <p class="truncate text-xs text-slate-500">{{ user()?.email }}</p>
          </div>
        </aside>

        <div class="flex flex-1 flex-col">
          <main class="flex-1 p-4 sm:p-6 lg:p-8">
            <router-outlet />
          </main>
          <app-elva-footer variant="light" />
        </div>
      </div>
    </div>
  `
})
export class ShellComponent implements OnInit {
  private readonly auth = inject(AuthService);
  readonly branding = inject(BrandingService);

  readonly user = this.auth.currentUser;

  ngOnInit(): void {
    this.branding.loadTenantBranding();
  }

  get headerSubtitle(): string {
    return this.branding.branding().displayName || 'Staff Portal';
  }

  private readonly navItems: NavItem[] = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Ticket Queue', path: '/tickets' },
    { label: 'My Tickets', path: '/my-tickets' },
    { label: 'Team Queue', path: '/team-queue' },
    { label: 'Workload', path: '/workload', roles: ['ADMIN', 'TEAM_LEAD'] },
    { label: 'Applications', path: '/applications', adminOnly: true },
    { label: 'Modules', path: '/modules', adminOnly: true },
    { label: 'Teams', path: '/teams', adminOnly: true },
    { label: 'Clients', path: '/merchants', adminOnly: true },
    { label: 'Inbound Mail', path: '/inbound-mail', adminOnly: true },
    { label: 'Users', path: '/users', adminOnly: true },
    { label: 'Settings', path: '/settings', adminOnly: true }
  ];

  get visibleNav(): NavItem[] {
    return this.navItems.filter((item) => {
      if (item.adminOnly && !this.auth.isAdmin()) return false;
      if (item.roles && !this.auth.hasRole(...item.roles)) return false;
      return true;
    });
  }

  logout(): void {
    this.auth.logout();
    this.branding.clearOverride();
    window.location.href = '/';
  }
}
