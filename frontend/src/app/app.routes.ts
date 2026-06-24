import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { merchantAuthGuard, merchantGuestGuard } from './merchant-portal/guards/merchant-auth.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./pages/landing/landing.component').then((m) => m.LandingComponent)
  },
  {
    path: 'login',
    redirectTo: 'merchant/login',
    pathMatch: 'full'
  },
  {
    path: 'merchant/login',
    canActivate: [merchantGuestGuard],
    loadComponent: () =>
      import('./merchant-portal/pages/login/merchant-login.component').then((m) => m.MerchantLoginComponent)
  },
  {
    path: 'merchant/verify-otp',
    canActivate: [merchantGuestGuard],
    loadComponent: () =>
      import('./merchant-portal/pages/verify-otp/merchant-verify-otp.component').then(
        (m) => m.MerchantVerifyOtpComponent
      )
  },
  {
    path: 'merchant',
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
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login/login.component').then((m) => m.LoginComponent)
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell/shell.component').then((m) => m.ShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
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
        loadComponent: () =>
          import('./features/applications/applications.component').then((m) => m.ApplicationsComponent)
      },
      {
        path: 'modules',
        loadComponent: () =>
          import('./features/modules/modules.component').then((m) => m.ModulesComponent)
      },
      {
        path: 'teams',
        loadComponent: () => import('./features/teams/teams.component').then((m) => m.TeamsComponent)
      },
      {
        path: 'users',
        canActivate: [roleGuard('ADMIN')],
        loadComponent: () => import('./features/users/users.component').then((m) => m.UsersComponent)
      }
    ]
  },
  { path: '**', redirectTo: '' }
];
