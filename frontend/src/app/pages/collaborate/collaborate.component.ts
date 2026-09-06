import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { PortalDocumentTitleService } from '../../core/portal/portal-document-title.service';
import { BrandingService } from '../../core/portal/branding.service';
import { formatApiError } from '../../shared/utils/api-error.util';

@Component({
  selector: 'app-collaborate',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  styles: [
    `
      :host {
        display: block;
        font-family: 'Source Sans 3', 'Segoe UI', sans-serif;
      }
      .display {
        font-family: 'Fraunces', Georgia, serif;
      }
      .hero-plane {
        background:
          radial-gradient(ellipse 90% 70% at 70% 10%, rgba(74, 103, 137, 0.45), transparent 55%),
          linear-gradient(155deg, #0a1628 0%, #13294b 42%, #1a3a5c 100%);
      }
    `
  ],
  template: `
    <div class="min-h-screen bg-[#0a1628] text-white">
      <header class="sticky top-0 z-40 border-b border-white/10 bg-[#0a1628]/80 backdrop-blur">
        <div class="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <a routerLink="/" class="inline-flex items-center gap-3">
            <img src="/images/elva-logo.png" alt="ELVA Support" class="h-10 w-10 rounded-md object-cover" />
            <span class="display text-lg font-semibold tracking-tight sm:text-xl">ELVA Support</span>
          </a>
          <div class="flex items-center gap-3">
            <a routerLink="/" class="hidden text-sm text-white/80 transition hover:text-white sm:inline">Home</a>
            <a
              [href]="platformLoginUrl"
              class="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#13294b] shadow-sm transition hover:bg-slate-100"
            >
              Sign In
            </a>
          </div>
        </div>
      </header>

      <section class="hero-plane px-4 py-16 sm:px-6 sm:py-24">
        <div class="mx-auto max-w-3xl text-center">
          <h1 class="display text-4xl font-semibold tracking-tight sm:text-5xl">Collaborate with ELVA</h1>
          <p class="mt-4 text-xl text-white/90">Build a better support experience for your customers.</p>
          <p class="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-white/70">
            ELVA Support gives your organization a dedicated, branded support workspace with ticket
            management, teams, SLA tracking, customer portals, and complete conversation history.
          </p>
        </div>
      </section>

      <section class="border-t border-white/10 bg-[#0d1b2e] px-4 py-16 sm:px-6">
        <div class="mx-auto max-w-6xl">
          <h2 class="display text-center text-3xl font-semibold">Why ELVA Support?</h2>
          <div class="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            @for (f of features; track f.title) {
              <div class="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h3 class="text-lg font-semibold">{{ f.title }}</h3>
                <p class="mt-2 text-sm leading-relaxed text-white/70">{{ f.body }}</p>
              </div>
            }
          </div>
        </div>
      </section>

      <section class="px-4 py-16 sm:px-6">
        <div class="mx-auto max-w-3xl">
          <h2 class="display text-center text-3xl font-semibold">How it works</h2>
          <ol class="mt-10 space-y-6">
            @for (s of steps; track s.n) {
              <li class="flex gap-4">
                <span
                  class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold text-[#13294b]"
                >
                  {{ s.n }}
                </span>
                <div>
                  <p class="font-semibold">{{ s.title }}</p>
                  <p class="mt-1 text-sm text-white/70">{{ s.body }}</p>
                </div>
              </li>
            }
          </ol>
        </div>
      </section>

      <section id="contact" class="border-t border-white/10 bg-[#0d1b2e] px-4 py-16 sm:px-6">
        <div class="mx-auto grid max-w-6xl gap-10 lg:grid-cols-2">
          <div>
            <h2 class="display text-3xl font-semibold">Let's build your support workspace</h2>
            <p class="mt-4 text-white/70">
              Interested in using ELVA Support for your organization? Share your details and our team
              will follow up.
            </p>
            <dl class="mt-8 space-y-3 text-sm">
              <div>
                <dt class="text-white/50">Email</dt>
                <dd>
                  <a href="mailto:support@elvatech.in" class="font-medium underline decoration-white/30"
                    >support&#64;elvatech.in</a
                  >
                </dd>
              </div>
              <div>
                <dt class="text-white/50">Website</dt>
                <dd>
                  <a
                    href="https://elvatech.in"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="font-medium underline decoration-white/30"
                    >elvatech.in</a
                  >
                </dd>
              </div>
            </dl>
          </div>

          <form class="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6" [formGroup]="form" (ngSubmit)="submit()">
            @if (error()) {
              <div class="rounded-lg border border-red-300/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
                {{ error() }}
              </div>
            }
            @if (success()) {
              <div class="rounded-lg border border-emerald-300/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
                {{ success() }}
              </div>
            }
            <div>
              <label class="mb-1 block text-sm text-white/80">Organization name</label>
              <input class="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm" formControlName="organizationName" />
            </div>
            <div>
              <label class="mb-1 block text-sm text-white/80">Contact person</label>
              <input class="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm" formControlName="contactPerson" />
            </div>
            <div>
              <label class="mb-1 block text-sm text-white/80">Business email</label>
              <input type="email" class="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm" formControlName="businessEmail" />
            </div>
            <div class="grid gap-4 sm:grid-cols-2">
              <div>
                <label class="mb-1 block text-sm text-white/80">Phone</label>
                <input class="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm" formControlName="phone" />
              </div>
              <div>
                <label class="mb-1 block text-sm text-white/80">Expected team size</label>
                <input class="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm" formControlName="expectedTeamSize" placeholder="e.g. 5–10" />
              </div>
            </div>
            <div>
              <label class="mb-1 block text-sm text-white/80">Organization website</label>
              <input class="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm" formControlName="organizationWebsite" placeholder="https://" />
            </div>
            <div>
              <label class="mb-1 block text-sm text-white/80">Message / requirements</label>
              <textarea rows="4" class="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm" formControlName="message"></textarea>
            </div>
            <button
              type="submit"
              class="w-full rounded-lg bg-white px-4 py-3 text-sm font-semibold text-[#13294b] transition hover:bg-slate-100 disabled:opacity-60"
              [disabled]="form.invalid || sending()"
            >
              {{ sending() ? 'Sending…' : 'Send Enquiry' }}
            </button>
          </form>
        </div>
      </section>

      <footer class="border-t border-white/10 px-4 py-10 sm:px-6">
        <div class="mx-auto max-w-6xl space-y-1 text-center text-sm text-white/55 md:text-left">
          <p>&copy; {{ year }} ELVA Support. All rights reserved.</p>
          <p>
            An ELVA Tech Product ·
            <a
              href="https://elvatech.in"
              target="_blank"
              rel="noopener noreferrer"
              class="underline decoration-white/40 hover:text-white"
              >elvatech.in</a
            >
          </p>
        </div>
      </footer>
    </div>
  `
})
export class CollaborateComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);
  private readonly titles = inject(PortalDocumentTitleService);
  private readonly branding = inject(BrandingService);

  readonly year = new Date().getFullYear();
  readonly platformLoginUrl = `https://${environment.platformAdminHost}/login`;
  readonly sending = signal(false);
  readonly error = signal('');
  readonly success = signal('');

  readonly form = this.fb.nonNullable.group({
    organizationName: ['', [Validators.required, Validators.maxLength(200)]],
    contactPerson: ['', [Validators.required, Validators.maxLength(200)]],
    businessEmail: ['', [Validators.required, Validators.email]],
    phone: [''],
    organizationWebsite: [''],
    expectedTeamSize: [''],
    message: ['', [Validators.required, Validators.maxLength(5000)]]
  });

  readonly features = [
    { title: 'Your Own Workspace', body: 'Your organization gets a dedicated support portal under your own workspace.' },
    { title: 'Your Own Branding', body: 'Use your organization name, logo, colors, and identity throughout the portal.' },
    { title: 'Centralized Ticket Management', body: 'Manage customer issues, conversations, assignments, teams, and priorities.' },
    { title: 'SLA & Performance Tracking', body: 'Configure support expectations and monitor resolution performance.' },
    { title: 'Teams and Agents', body: 'Organize your support staff and distribute work efficiently.' },
    { title: 'Customer Portal', body: 'Give your customers a dedicated portal to raise and track support tickets.' }
  ];

  readonly steps = [
    { n: 1, title: 'Talk to ELVA', body: 'Share your organization\'s support requirements with us.' },
    { n: 2, title: 'Workspace Setup', body: 'ELVA creates and provisions your dedicated support workspace.' },
    { n: 3, title: 'Configure Your Workspace', body: 'Set up branding, applications, teams, agents, clients, and preferences.' },
    { n: 4, title: 'Start Supporting', body: 'Your team and customers begin using your dedicated support portal.' }
  ];

  ngOnInit(): void {
    this.branding.applyPlatformDefaults();
    this.titles.setPageSuffix('Collaborate with ELVA');
  }

  submit(): void {
    if (this.form.invalid) return;
    this.sending.set(true);
    this.error.set('');
    this.success.set('');
    this.http.post(`${environment.apiUrl}/public/enquiries`, this.form.getRawValue()).subscribe({
      next: () => {
        this.success.set('Enquiry submitted successfully. ELVA will contact you soon.');
        this.form.reset();
        this.sending.set(false);
      },
      error: (err) => {
        this.error.set(formatApiError(err, 'Unable to submit enquiry'));
        this.sending.set(false);
      }
    });
  }
}
