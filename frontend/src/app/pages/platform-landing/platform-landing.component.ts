import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { environment } from '../../../environments/environment';
import { PortalDocumentTitleService } from '../../core/portal/portal-document-title.service';
import { BrandingService } from '../../core/portal/branding.service';

/**
 * Public SaaS marketing page for the apex domain (elvasupport.in).
 * Not a tenant portal — platform product landing only.
 */
@Component({
  selector: 'app-platform-landing',
  standalone: true,
  imports: [CommonModule],
  styles: [
    `
      :host {
        display: block;
        font-family: 'Source Sans 3', 'Segoe UI', sans-serif;
      }

      .display {
        font-family: 'Fraunces', Georgia, serif;
        font-optical-sizing: auto;
      }

      .hero-plane {
        background:
          radial-gradient(ellipse 90% 70% at 70% 10%, rgba(74, 103, 137, 0.45), transparent 55%),
          radial-gradient(ellipse 60% 50% at 10% 80%, rgba(19, 41, 75, 0.9), transparent 50%),
          linear-gradient(155deg, #0a1628 0%, #13294b 42%, #1a3a5c 78%, #243f5e 100%);
      }

      .fade-up {
        animation: fadeUp 0.7s ease-out both;
      }

      .fade-up-delay {
        animation: fadeUp 0.7s ease-out 0.15s both;
      }

      .fade-up-delay-2 {
        animation: fadeUp 0.7s ease-out 0.3s both;
      }

      @keyframes fadeUp {
        from {
          opacity: 0;
          transform: translateY(14px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .nav-scrim {
        backdrop-filter: blur(10px);
        background: rgba(10, 22, 40, 0.55);
      }

      @media (prefers-reduced-motion: reduce) {
        .fade-up,
        .fade-up-delay,
        .fade-up-delay-2 {
          animation: none;
        }
      }
    `
  ],
  template: `
    <div class="min-h-screen bg-[#0a1628] text-white">
      <header class="nav-scrim sticky top-0 z-40 border-b border-white/10">
        <div class="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <a [href]="apexUrl" class="inline-flex items-center gap-3">
            <img src="/images/elva-logo.png" alt="ELVA Support" class="h-10 w-10 rounded-md object-cover" />
            <span class="display text-lg font-semibold tracking-tight sm:text-xl">ELVA Support</span>
          </a>
          <nav class="hidden items-center gap-6 text-sm text-white/80 md:flex">
            <a href="#features" class="transition hover:text-white">Features</a>
            <a href="#how-it-works" class="transition hover:text-white">How it works</a>
            <a href="#workspaces" class="transition hover:text-white">Workspaces</a>
          </nav>
          <a
            [href]="platformLoginUrl"
            class="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#13294b] shadow-sm transition hover:bg-slate-100"
          >
            Sign In
          </a>
        </div>
      </header>

      <section class="hero-plane relative overflow-hidden">
        <div
          class="pointer-events-none absolute inset-0 opacity-30"
          style="background-image: url('data:image/svg+xml,%3Csvg width=\\'60\\' height=\\'60\\' viewBox=\\'0 0 60 60\\' xmlns=\\'http://www.w3.org/2000/svg\\'%3E%3Cg fill=\\'none\\' fill-rule=\\'evenodd\\'%3E%3Cg fill=\\'%23ffffff\\' fill-opacity=\\'0.06\\'%3E%3Cpath d=\\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E');"
        ></div>
        <div class="relative mx-auto grid max-w-6xl gap-10 px-4 pb-20 pt-16 sm:px-6 sm:pb-28 sm:pt-24 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div>
            <p class="fade-up display text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
              ELVA Support
            </p>
            <h1 class="fade-up-delay mt-4 text-2xl font-semibold leading-snug text-white/95 sm:text-3xl">
              Customer support, simplified.
            </h1>
            <p class="fade-up-delay-2 mt-5 max-w-xl text-base leading-relaxed text-white/75 sm:text-lg">
              Give your customers a seamless support experience with dedicated portals, ticket
              management, real-time conversation threads, and complete history — under your brand.
            </p>
            <div class="fade-up-delay-2 mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                [href]="platformLoginUrl"
                class="inline-flex items-center justify-center rounded-lg bg-white px-6 py-3 text-sm font-semibold text-[#13294b] shadow-lg transition hover:bg-slate-100"
              >
                Get Started
              </a>
              <a
                href="#how-it-works"
                class="inline-flex items-center justify-center rounded-lg border border-white/30 px-6 py-3 text-sm font-medium text-white transition hover:bg-white/10"
              >
                Learn More
              </a>
            </div>
          </div>
          <div class="fade-up-delay-2 hidden lg:block">
            <div
              class="aspect-[4/3] w-full rounded-tl-3xl border border-white/15 bg-gradient-to-br from-white/10 to-transparent p-6 shadow-2xl"
              role="img"
              aria-label="Support workspace illustration"
            >
              <div class="flex h-full flex-col justify-between">
                <div>
                  <p class="text-xs uppercase tracking-[0.2em] text-white/50">Workspace</p>
                  <p class="display mt-2 text-2xl font-semibold">yourcompany.{{ baseDomain }}</p>
                </div>
                <div class="space-y-2 text-sm text-white/70">
                  <p class="rounded-lg border border-white/10 bg-white/5 px-3 py-2">Ticket queue · Team inbox</p>
                  <p class="rounded-lg border border-white/10 bg-white/5 px-3 py-2">Customer portal · Branding</p>
                  <p class="rounded-lg border border-white/10 bg-white/5 px-3 py-2">Conversation history</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" class="border-t border-white/10 bg-[#0d1b2e] px-4 py-16 sm:px-6 sm:py-20">
        <div class="mx-auto max-w-6xl">
          <h2 class="display text-3xl font-semibold tracking-tight sm:text-4xl">How it works</h2>
          <p class="mt-3 max-w-2xl text-white/65">
            From workspace creation to resolved tickets — one clear path for your support operation.
          </p>
          <ol class="mt-10 grid gap-8 sm:grid-cols-3">
            @for (step of steps; track step.n) {
              <li>
                <p class="text-sm font-semibold text-[#8fa4c0]">Step {{ step.n }}</p>
                <p class="mt-2 text-lg font-semibold text-white">{{ step.title }}</p>
                <p class="mt-2 text-sm leading-relaxed text-white/65">{{ step.body }}</p>
              </li>
            }
          </ol>
        </div>
      </section>

      <section id="features" class="border-t border-white/10 px-4 py-16 sm:px-6 sm:py-20">
        <div class="mx-auto max-w-6xl">
          <h2 class="display text-3xl font-semibold tracking-tight sm:text-4xl">Built for support teams</h2>
          <p class="mt-3 max-w-2xl text-white/65">
            Capabilities available in the ELVA Support platform today.
          </p>
          <div class="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            @for (feature of features; track feature.title) {
              <article class="border-t border-white/20 pt-4">
                <h3 class="text-base font-semibold text-white">{{ feature.title }}</h3>
                <p class="mt-2 text-sm leading-relaxed text-white/65">{{ feature.body }}</p>
              </article>
            }
          </div>
        </div>
      </section>

      <section id="workspaces" class="border-t border-white/10 bg-[#0d1b2e] px-4 py-16 sm:px-6 sm:py-20">
        <div class="mx-auto max-w-6xl">
          <h2 class="display text-3xl font-semibold tracking-tight sm:text-4xl">
            Your brand. Your workspace.
          </h2>
          <p class="mt-3 max-w-2xl text-white/65">
            Every business gets a dedicated support portal on its own subdomain — with isolated data,
            independent users, and custom branding.
          </p>
          <p class="mt-6 font-mono text-sm text-[#8fa4c0] sm:text-base">
            yourcompany.{{ baseDomain }}
          </p>
          <ul class="mt-8 grid gap-3 text-sm text-white/80 sm:grid-cols-2">
            @for (item of workspacePoints; track item) {
              <li class="flex gap-2">
                <span class="text-[#8fa4c0]" aria-hidden="true">—</span>
                <span>{{ item }}</span>
              </li>
            }
          </ul>
        </div>
      </section>

      <section class="border-t border-white/10 px-4 py-16 sm:px-6 sm:py-20">
        <div class="mx-auto max-w-3xl text-center">
          <h2 class="display text-3xl font-semibold tracking-tight sm:text-4xl">
            Ready to simplify customer support?
          </h2>
          <p class="mt-4 text-white/65">
            Sign in to the platform administration portal to provision and manage workspaces.
          </p>
          <a
            [href]="platformLoginUrl"
            class="mt-8 inline-flex items-center justify-center rounded-lg bg-white px-6 py-3 text-sm font-semibold text-[#13294b] shadow-lg transition hover:bg-slate-100"
          >
            Get Started
          </a>
        </div>
      </section>

      <footer class="border-t border-white/10 px-4 py-10 sm:px-6">
        <div
          class="mx-auto flex max-w-6xl flex-col gap-4 text-center text-sm text-white/55 md:flex-row md:items-center md:justify-between md:text-left"
        >
          <div>
            <p class="font-medium text-white/80">ELVA Support</p>
            <p class="mt-1">&copy; {{ year }} ELVA Tech. All rights reserved.</p>
          </div>
          <div class="space-y-1 md:text-right">
            <p>
              <a [href]="apexUrl" class="underline decoration-white/30 underline-offset-2 hover:text-white">
                {{ baseDomain }}
              </a>
            </p>
            <p>
              <a
                href="mailto:support@elvatech.in"
                class="underline decoration-white/30 underline-offset-2 hover:text-white"
              >
                support@elvatech.in
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  `
})
export class PlatformLandingComponent implements OnInit {
  private readonly titles = inject(PortalDocumentTitleService);
  private readonly branding = inject(BrandingService);

  readonly year = new Date().getFullYear();
  readonly baseDomain = environment.tenantBaseDomain;
  readonly apexUrl = `https://${environment.tenantBaseDomain}`;
  /** Always absolute — apex and tenant hosts must not share auth cookies with admin. */
  readonly platformLoginUrl = `https://${environment.platformAdminHost}/login`;

  readonly steps = [
    {
      n: 1,
      title: 'Create your workspace',
      body: 'Provision a tenant workspace with its own subdomain and administrator invitation.'
    },
    {
      n: 2,
      title: 'Invite your team and customers',
      body: 'Onboard support agents and give customers secure access to their dedicated portal.'
    },
    {
      n: 3,
      title: 'Manage and resolve requests',
      body: 'Track tickets, reply in-thread, attach files, and close the loop with full history.'
    }
  ];

  readonly features = [
    {
      title: 'Dedicated support portal',
      body: 'Each organization gets a branded customer portal on its own subdomain.'
    },
    {
      title: 'Ticket management',
      body: 'Create, assign, transfer, and resolve support tickets with clear status workflows.'
    },
    {
      title: 'Secure customer access',
      body: 'Customers sign in with email OTP — no shared passwords across workspaces.'
    },
    {
      title: 'Real-time conversations',
      body: 'Keep every reply on a single ticket timeline for staff and customers.'
    },
    {
      title: 'File attachments',
      body: 'Share screenshots and documents safely on the ticket thread.'
    },
    {
      title: 'Complete ticket history',
      body: 'Audit-friendly system events and conversation history stay with the ticket.'
    },
    {
      title: 'Team management',
      body: 'Organize agents into teams and route work with workload-aware assignment.'
    },
    {
      title: 'Multi-tenant architecture',
      body: 'Isolated workspaces for every business — data stays scoped to the hostname tenant.'
    },
    {
      title: 'Custom branding',
      body: 'Logo, colors, portal titles, and customer terminology per workspace.'
    }
  ];

  readonly workspacePoints = [
    'Dedicated workspace hostname',
    'Separate customer and ticket data',
    'Independent users and roles',
    'Custom logo, colors, and portal copy',
    'Their own support environment'
  ];

  ngOnInit(): void {
    this.branding.applyPlatformDefaults();
    this.titles.apply();
  }
}
