import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { PlatformAuthService } from '../../../core/services/platform-auth.service';
import { BrandingService } from '../../../core/portal/branding.service';
import { ElvaFooterComponent } from '../../../shared/components/elva-footer/elva-footer.component';
import { ElvaHeaderComponent } from '../../../shared/components/elva-header/elva-header.component';

@Component({
  selector: 'app-platform-shell',
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
            <p class="truncate text-sm font-medium text-slate-900">{{ admin()?.name }}</p>
            <p class="truncate text-xs text-slate-500">{{ admin()?.email }}</p>
            <p class="mt-1 text-[10px] uppercase tracking-wide text-slate-400">{{ admin()?.role }}</p>
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
export class PlatformShellComponent implements OnInit {
  readonly auth = inject(PlatformAuthService);
  readonly branding = inject(BrandingService);
  readonly admin = this.auth.currentAdmin;

  ngOnInit(): void {
    this.branding.applyPlatformDefaults();
  }

  readonly navItems: {
    label: string;
    path: string;
    roles?: Array<'PLATFORM_SUPER_ADMIN' | 'PLATFORM_ADMIN' | 'PLATFORM_SUPPORT'>;
  }[] = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Businesses', path: '/tenants' },
    {
      label: 'Provision Business',
      path: '/provision',
      roles: ['PLATFORM_SUPER_ADMIN', 'PLATFORM_ADMIN']
    },
    { label: 'Provisioning Status', path: '/provisionings' },
    {
      label: 'Platform Admins',
      path: '/admins',
      roles: ['PLATFORM_SUPER_ADMIN', 'PLATFORM_ADMIN']
    },
    {
      label: 'Audit Logs',
      path: '/audit',
      roles: ['PLATFORM_SUPER_ADMIN', 'PLATFORM_ADMIN']
    },
    {
      label: 'Data Integrity',
      path: '/integrity',
      roles: ['PLATFORM_SUPER_ADMIN', 'PLATFORM_ADMIN']
    },
    { label: 'Profile', path: '/profile' }
  ];

  get visibleNav() {
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
