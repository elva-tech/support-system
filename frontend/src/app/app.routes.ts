import { Routes } from '@angular/router';
import { roleGuard } from './core/guards/role.guard';
import {
  platformAuthGuard,
  platformGuestGuard,
  platformPortalCanMatch,
  centralSupportAuthGuard,
  centralSupportGuestGuard,
  centralSupportPortalCanMatch,
  centralSupportRoleGuard,
  apexPortalCanMatch,
  platformRoleGuard,
  tenantAuthGuard,
  tenantGuestGuard,
  tenantPortalCanMatch
} from './core/guards/portal.guard';
import { merchantAuthGuard, merchantGuestGuard } from './merchant-portal/guards/merchant-auth.guard';

export const routes: Routes = [
  // ---------- APEX / PUBLIC SaaS LANDING (elvasupport.in / www) ----------
  {
    path: '',
    pathMatch: 'full',
    canMatch: [apexPortalCanMatch],
    loadComponent: () =>
      import('./pages/platform-landing/platform-landing.component').then(
        (m) => m.PlatformLandingComponent
      )
  },
  {
    path: 'collaborate',
    canMatch: [apexPortalCanMatch],
    loadComponent: () =>
      import('./pages/collaborate/collaborate.component').then((m) => m.CollaborateComponent)
  },
  {
    path: 'get-started',
    canMatch: [apexPortalCanMatch],
    loadComponent: () =>
      import('./pages/collaborate/collaborate.component').then((m) => m.CollaborateComponent)
  },

  // ---------- CENTRAL SUPPORT (support.elvasupport.in or localhost portalMode=central-support) ----------
  {
    path: 'login',
    canMatch: [centralSupportPortalCanMatch],
    canActivate: [centralSupportGuestGuard],
    loadComponent: () =>
      import('./features/central-support/pages/central-support-login.component').then(
        (m) => m.CentralSupportLoginComponent
      )
  },
  {
    path: '',
    canMatch: [centralSupportPortalCanMatch],
    canActivate: [centralSupportAuthGuard],
    loadComponent: () =>
      import('./features/central-support/layout/central-support-shell.component').then(
        (m) => m.CentralSupportShellComponent
      ),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/central-support/pages/central-support-dashboard.component').then(
            (m) => m.CentralSupportDashboardComponent
          )
      },
      {
        path: 'tickets',
        canActivate: [centralSupportRoleGuard('CENTRAL_SUPPORT_ADMIN')],
        loadComponent: () =>
          import('./features/platform/pages/platform-support-queue.component').then(
            (m) => m.PlatformSupportQueueComponent
          )
      },
      {
        path: 'my-tickets',
        loadComponent: () =>
          import('./features/platform/pages/platform-support-queue.component').then(
            (m) => m.PlatformSupportQueueComponent
          ),
        data: { mine: true }
      },
      {
        path: 'team-queue',
        loadComponent: () =>
          import('./features/platform/pages/platform-support-queue.component').then(
            (m) => m.PlatformSupportQueueComponent
          ),
        data: { teamQueue: true }
      },
      {
        path: 'workload',
        loadComponent: () =>
          import('./features/central-support/pages/central-support-workload.component').then(
            (m) => m.CentralSupportWorkloadComponent
          )
      },
      {
        path: 'tickets/:id',
        loadComponent: () =>
          import('./features/platform/pages/platform-support-detail.component').then(
            (m) => m.PlatformSupportDetailComponent
          )
      },
      {
        path: 'teams',
        canActivate: [
          centralSupportRoleGuard('CENTRAL_SUPPORT_ADMIN', 'CENTRAL_SUPPORT_TEAM_LEAD')
        ],
        loadComponent: () =>
          import('./features/central-support/pages/central-support-teams.component').then(
            (m) => m.CentralSupportTeamsComponent
          )
      },
      {
        path: 'agents',
        canActivate: [centralSupportRoleGuard('CENTRAL_SUPPORT_ADMIN')],
        loadComponent: () =>
          import('./features/central-support/pages/central-support-agents.component').then(
            (m) => m.CentralSupportAgentsComponent
          )
      },
      {
        path: 'users',
        redirectTo: 'agents',
        pathMatch: 'full'
      },
      {
        path: 'settings',
        canActivate: [centralSupportRoleGuard('CENTRAL_SUPPORT_ADMIN')],
        loadComponent: () =>
          import('./features/central-support/pages/central-support-settings.component').then(
            (m) => m.CentralSupportSettingsComponent
          )
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./features/central-support/pages/central-support-profile.component').then(
            (m) => m.CentralSupportProfileComponent
          )
      }
    ]
  },

  // ---------- PLATFORM PORTAL (admin.elvasupport.in or localhost portalMode=platform) ----------
  {
    path: 'login',
    canMatch: [platformPortalCanMatch],
    canActivate: [platformGuestGuard],
    loadComponent: () =>
      import('./features/platform/pages/platform-login.component').then((m) => m.PlatformLoginComponent)
  },
  {
    path: '',
    canMatch: [platformPortalCanMatch],
    canActivate: [platformAuthGuard],
    loadComponent: () =>
      import('./features/platform/layout/platform-shell.component').then((m) => m.PlatformShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/platform/pages/platform-dashboard.component').then(
            (m) => m.PlatformDashboardComponent
          )
      },
      {
        path: 'tenants',
        loadComponent: () =>
          import('./features/platform/pages/platform-tenants.component').then(
            (m) => m.PlatformTenantsComponent
          )
      },
      {
        path: 'provision',
        canActivate: [platformRoleGuard('PLATFORM_SUPER_ADMIN', 'PLATFORM_ADMIN')],
        loadComponent: () =>
          import('./features/platform/pages/platform-provision.component').then(
            (m) => m.PlatformProvisionComponent
          )
      },
      {
        path: 'provisionings',
        loadComponent: () =>
          import('./features/platform/pages/platform-provisionings.component').then(
            (m) => m.PlatformProvisioningsComponent
          )
      },
      {
        path: 'provisionings/:id',
        loadComponent: () =>
          import('./features/platform/pages/platform-provisioning-detail.component').then(
            (m) => m.PlatformProvisioningDetailComponent
          )
      },
      {
        path: 'admins',
        canActivate: [platformRoleGuard('PLATFORM_SUPER_ADMIN', 'PLATFORM_ADMIN')],
        loadComponent: () =>
          import('./features/platform/pages/platform-admins.component').then(
            (m) => m.PlatformAdminsComponent
          )
      },
      {
        path: 'audit',
        canActivate: [platformRoleGuard('PLATFORM_SUPER_ADMIN', 'PLATFORM_ADMIN')],
        loadComponent: () =>
          import('./features/platform/pages/platform-audit.component').then(
            (m) => m.PlatformAuditComponent
          )
      },
      {
        path: 'integrity',
        canActivate: [platformRoleGuard('PLATFORM_SUPER_ADMIN', 'PLATFORM_ADMIN')],
        loadComponent: () =>
          import('./features/platform/pages/platform-integrity.component').then(
            (m) => m.PlatformIntegrityComponent
          )
      },
      {
        path: 'support',
        loadComponent: () =>
          import('./features/platform/pages/platform-support-moved.component').then(
            (m) => m.PlatformSupportMovedComponent
          )
      },
      {
        path: 'support/mine',
        loadComponent: () =>
          import('./features/platform/pages/platform-support-moved.component').then(
            (m) => m.PlatformSupportMovedComponent
          )
      },
      {
        path: 'support/:id',
        loadComponent: () =>
          import('./features/platform/pages/platform-support-moved.component').then(
            (m) => m.PlatformSupportMovedComponent
          )
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./features/platform/pages/platform-profile.component').then(
            (m) => m.PlatformProfileComponent
          )
      }
    ]
  },

  // ---------- TENANT WORKSPACE ({slug}.elvasupport.in / localhost) ----------
  {
    path: '',
    pathMatch: 'full',
    canMatch: [tenantPortalCanMatch],
    loadComponent: () => import('./pages/landing/landing.component').then((m) => m.LandingComponent)
  },
  {
    path: 'login',
    // Platform `/login` is matched first via platformPortalCanMatch.
    // Tenant/unknown fall through here — Angular 20 forbids redirectTo + canMatch together (NG04014).
    redirectTo: 'auth/login',
    pathMatch: 'full'
  },
  {
    path: 'setup-account',
    canMatch: [tenantPortalCanMatch],
    loadComponent: () =>
      import('./features/onboarding/setup-account.component').then((m) => m.SetupAccountComponent)
  },
  {
    path: 'merchant/login',
    canMatch: [tenantPortalCanMatch],
    canActivate: [merchantGuestGuard],
    loadComponent: () =>
      import('./merchant-portal/pages/login/merchant-login.component').then((m) => m.MerchantLoginComponent)
  },
  {
    path: 'merchant/verify-otp',
    canMatch: [tenantPortalCanMatch],
    canActivate: [merchantGuestGuard],
    loadComponent: () =>
      import('./merchant-portal/pages/verify-otp/merchant-verify-otp.component').then(
        (m) => m.MerchantVerifyOtpComponent
      )
  },
  {
    path: 'merchant',
    canMatch: [tenantPortalCanMatch],
    canActivate: [merchantAuthGuard],
    loadComponent: () =>
      import('./merchant-portal/layout/merchant-shell.component').then((m) => m.MerchantShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./merchant-portal/pages/dashboard/merchant-dashboard.component').then(
            (m) => m.MerchantDashboardComponent
          )
      },
      {
        path: 'tickets/new',
        loadComponent: () =>
          import('./merchant-portal/pages/tickets/merchant-create-ticket.component').then(
            (m) => m.MerchantCreateTicketComponent
          )
      },
      {
        path: 'tickets/:id',
        loadComponent: () =>
          import('./merchant-portal/pages/tickets/merchant-ticket-detail.component').then(
            (m) => m.MerchantTicketDetailComponent
          )
      },
      {
        path: 'tickets',
        loadComponent: () =>
          import('./merchant-portal/pages/tickets/merchant-my-tickets.component').then(
            (m) => m.MerchantMyTicketsComponent
          )
      }
    ]
  },
  {
    path: 'auth/login',
    canMatch: [tenantPortalCanMatch],
    canActivate: [tenantGuestGuard],
    loadComponent: () => import('./features/auth/login/login.component').then((m) => m.LoginComponent)
  },
  {
    path: '',
    canMatch: [tenantPortalCanMatch],
    canActivate: [tenantAuthGuard],
    loadComponent: () => import('./layout/shell/shell.component').then((m) => m.ShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'support',
        loadComponent: () =>
          import('./features/support/tenant-platform-support.component').then(
            (m) => m.TenantPlatformSupportComponent
          )
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent)
      },
      {
        path: 'tickets/:id',
        loadComponent: () =>
          import('./features/tickets/ticket-detail.component').then((m) => m.TicketDetailComponent)
      },
      {
        path: 'tickets',
        loadComponent: () =>
          import('./features/tickets/ticket-list.component').then((m) => m.TicketListComponent)
      },
      {
        path: 'my-tickets',
        loadComponent: () =>
          import('./features/tickets/my-tickets.component').then((m) => m.MyTicketsComponent)
      },
      {
        path: 'team-queue',
        loadComponent: () =>
          import('./features/tickets/team-queue.component').then((m) => m.TeamQueueComponent)
      },
      {
        path: 'workload',
        canActivate: [roleGuard('ADMIN', 'TEAM_LEAD')],
        loadComponent: () =>
          import('./features/operations/workload.component').then((m) => m.WorkloadComponent)
      },
      {
        path: 'applications',
        canActivate: [roleGuard('ADMIN')],
        loadComponent: () =>
          import('./features/applications/applications.component').then((m) => m.ApplicationsComponent)
      },
      {
        path: 'modules',
        canActivate: [roleGuard('ADMIN')],
        loadComponent: () =>
          import('./features/modules/modules.component').then((m) => m.ModulesComponent)
      },
      {
        path: 'teams',
        canActivate: [roleGuard('ADMIN')],
        loadComponent: () => import('./features/teams/teams.component').then((m) => m.TeamsComponent)
      },
      {
        path: 'merchants',
        canActivate: [roleGuard('ADMIN')],
        loadComponent: () =>
          import('./features/merchants/merchants.component').then((m) => m.MerchantsComponent)
      },
      {
        path: 'inbound-mail',
        canActivate: [roleGuard('ADMIN')],
        loadComponent: () =>
          import('./features/inbound-mail/inbound-mail-queue.component').then(
            (m) => m.InboundMailQueueComponent
          )
      },
      {
        path: 'users',
        canActivate: [roleGuard('ADMIN')],
        loadComponent: () => import('./features/users/users.component').then((m) => m.UsersComponent)
      },
      {
        path: 'audit',
        canActivate: [roleGuard('ADMIN')],
        loadComponent: () =>
          import('./features/audit/tenant-audit.component').then((m) => m.TenantAuditComponent)
      },
      {
        path: 'setup',
        canActivate: [roleGuard('ADMIN')],
        loadComponent: () =>
          import('./features/workspace/workspace-setup.component').then((m) => m.WorkspaceSetupComponent)
      },
      {
        path: 'settings',
        canActivate: [roleGuard('ADMIN')],
        loadComponent: () =>
          import('./features/workspace/workspace-settings.component').then(
            (m) => m.WorkspaceSettingsComponent
          )
      }
    ]
  },

  // ---------- UNKNOWN HOST ----------
  {
    path: '**',
    loadComponent: () =>
      import('./pages/invalid-portal/invalid-portal.component').then((m) => m.InvalidPortalComponent)
  }
];
