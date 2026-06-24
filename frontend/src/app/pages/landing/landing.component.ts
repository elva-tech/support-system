import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ElvaFooterComponent } from '../../shared/components/elva-footer/elva-footer.component';
import { ElvaHeaderComponent } from '../../shared/components/elva-header/elva-header.component';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink, ElvaHeaderComponent, ElvaFooterComponent],
  template: `
    <div class="flex min-h-screen flex-col bg-gradient-to-br from-elva-950 via-elva-900 to-elva-brand text-white">
      <app-elva-header subtitle="Customer Help Center">
        <a routerLink="/auth/login" class="text-sm text-white/80 transition hover:text-white">
          Admin portal
        </a>
        <a
          routerLink="/merchant/login"
          class="rounded-lg bg-white px-4 py-2 text-sm font-medium text-elva-brand shadow-sm transition hover:bg-elva-50"
        >
          Sign in
        </a>
      </app-elva-header>

      <main class="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <section class="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-12">
          <div>
            <p class="mb-3 inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/90">
              Exclusively Built for ELVA Customers
            </p>
            <h2 class="text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
              Get help with orders, payouts, and account issues — fast.
            </h2>
            <p class="mt-5 text-base text-white/80 sm:text-lg">
              ELVA Support connects you to our dedicated team. Raise tickets, track progress,
              reply in one thread, and attach files — all from a secure customer portal.
            </p>
            <div class="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <a
                routerLink="/merchant/login"
                class="inline-flex items-center justify-center rounded-lg bg-white px-6 py-3 text-sm font-semibold text-elva-brand shadow-lg transition hover:bg-elva-50"
              >
                Sign in to your account
              </a>
              <a
                routerLink="/auth/login"
                class="inline-flex items-center justify-center rounded-lg border border-white/30 px-6 py-3 text-sm font-medium text-white transition hover:bg-white/10"
              >
                Agent or admin access
              </a>
            </div>
          </div>

          <div class="rounded-2xl border border-white/15 bg-white/5 p-5 shadow-xl backdrop-blur sm:p-6">
            <h3 class="text-lg font-semibold">How it works</h3>
            <ol class="mt-5 space-y-5">
              @for (step of steps; track step.title) {
                <li class="flex gap-4">
                  <span
                    class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold text-elva-brand"
                  >
                    {{ step.number }}
                  </span>
                  <div>
                    <p class="font-medium">{{ step.title }}</p>
                    <p class="mt-1 text-sm text-white/70">{{ step.description }}</p>
                  </div>
                </li>
              }
            </ol>
          </div>
        </section>

        <section class="mt-12 grid gap-4 sm:grid-cols-2 lg:mt-16 lg:grid-cols-3 lg:gap-6">
          @for (feature of features; track feature.title) {
            <div class="rounded-xl border border-white/10 bg-white/5 p-5">
              <p class="text-sm font-semibold text-white/90">{{ feature.title }}</p>
              <p class="mt-2 text-sm text-white/70">{{ feature.description }}</p>
            </div>
          }
        </section>
      </main>

      <app-elva-footer variant="dark" />
    </div>
  `
})
export class LandingComponent {
  readonly steps = [
    {
      number: 1,
      title: 'Sign in with your email',
      description: 'Use your registered email. We send a one-time OTP — no password needed.'
    },
    {
      number: 2,
      title: 'Create a support ticket',
      description: 'Pick a category, describe your issue, and attach screenshots if helpful.'
    },
    {
      number: 3,
      title: 'Track and reply',
      description: 'Follow status updates, chat with our team on the ticket thread, and get notified when resolved.'
    }
  ];

  readonly features = [
    {
      title: 'Secure access',
      description: 'OTP login and session-based access — only you can see your tickets.'
    },
    {
      title: 'Dedicated support team',
      description: 'Tickets route to the right ELVA support team based on your issue type.'
    },
    {
      title: 'Full conversation history',
      description: 'Every reply and attachment stays on the ticket timeline for easy reference.'
    }
  ];
}
