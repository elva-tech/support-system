import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
  CentralSupportAuthService,
  CentralSupportRole
} from '../../../core/services/central-support-auth.service';
import { BrandingService } from '../../../core/portal/branding.service';
import { ElvaFooterComponent } from '../../../shared/components/elva-footer/elva-footer.component';
import { ElvaHeaderComponent } from '../../../shared/components/elva-header/elva-header.component';

interface NavItem {
  label: string;
  path: string;
  roles?: CentralSupportRole[];
}

/**
 * Operational shell for support.elvasupport.in — not platform administration.
 */
@Component({
  selector: 'app-central-support-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, ElvaHeaderComponent, ElvaFooterComponent],
  template: `
    <div class="flex min-h-screen flex-col bg-slate-50">
      <app-elva-header
        [subtitle]="branding.branding().displayName"
        [tagline]="branding.branding().productName"
        [productName]="branding.branding().supportDisplayName"
        [logoUrl]="branding.branding().logoUrl || '/images/elva-logo.png'"
        [showActionsOnMobile]="true"
        [compactActions]="true"
      >
        <span class="hidden text-xs text-white/80 sm:inline">{{ roleLabel }}</span>
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
                routerLinkActive="nav-active"
                class="shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-[var(--tenant-primary-light)] hover:text-[var(--tenant-primary-color)] lg:block"
              >
                {{ item.label }}
              </a>
            }
          </nav>

          <div class="hidden border-t border-slate-200 p-4 lg:block">
            <p class="truncate text-sm font-medium text-slate-900">{{ user()?.name }}</p>
            <p class="truncate text-xs text-slate-500">{{ user()?.email }}</p>
            <p class="mt-1 text-[10px] uppercase tracking-wide text-slate-400">{{ roleLabel }}</p>
          </div>
        </aside>

        <div class="flex flex-1 flex-col">
          <main class="flex-1 p-4 sm:p-6 lg:p-8">
            <router-outlet />
          </main>
          <app-elva-footer variant="light" companyName="ELVA Central Support" />
        </div>
      </div>
    </div>
  `
})
export class CentralSupportShellComponent implements OnInit {
  readonly auth = inject(CentralSupportAuthService);
  readonly branding = inject(BrandingService);
  readonly user = this.auth.currentUser;

  ngOnInit(): void {
    this.branding.applyPlatformDefaults();
  }

  get roleLabel(): string {
    const role = this.user()?.role;
    if (role === 'CENTRAL_SUPPORT_ADMIN') return 'Admin';
    if (role === 'CENTRAL_SUPPORT_TEAM_LEAD') return 'Team Lead';
    if (role === 'CENTRAL_SUPPORT_AGENT') return 'Agent';
    return role || '';
  }

  readonly navItems: NavItem[] = [
    { label: 'Dashboard', path: '/dashboard' },
    {
      label: 'Support Queue',
      path: '/tickets',
      roles: ['CENTRAL_SUPPORT_ADMIN']
    },
    { label: 'My Tickets', path: '/my-tickets' },
    { label: 'Team Queue', path: '/team-queue' },
    { label: 'Workload', path: '/workload' },
    {
      label: 'Teams',
      path: '/teams',
      roles: ['CENTRAL_SUPPORT_ADMIN']
    },
    {
      label: 'Team',
      path: '/teams',
      roles: ['CENTRAL_SUPPORT_TEAM_LEAD']
    },
    {
      label: 'Agents',
      path: '/agents',
      roles: ['CENTRAL_SUPPORT_ADMIN']
    },
    {
      label: 'Settings',
      path: '/settings',
      roles: ['CENTRAL_SUPPORT_ADMIN']
    },
    { label: 'Profile', path: '/profile' }
  ];

  get visibleNav(): NavItem[] {
    return this.navItems.filter((item) => {
      if (!item.roles?.length) return true;
      return this.auth.hasRole(...item.roles);
    });
  }

  logout(): void {
    this.auth.logout();
    this.branding.applyPlatformDefaults();
    window.location.href = '/login';
  }
}
