import { Component, input } from '@angular/core';

@Component({
  selector: 'app-elva-footer',
  standalone: true,
  template: `
    <footer
      class="mt-auto w-full border-t px-4 py-6 sm:px-6"
      [class.border-white/10]="variant() === 'dark'"
      [style.background-color]="variant() === 'dark' ? 'var(--tenant-primary-color)' : undefined"
      [class.bg-elva-brand]="variant() === 'dark'"
      [class.text-white/80]="variant() === 'dark'"
      [class.border-slate-200]="variant() === 'light'"
      [class.bg-white]="variant() === 'light'"
      [class.text-slate-600]="variant() === 'light'"
    >
      <div
        class="mx-auto flex max-w-6xl flex-col gap-4 text-center text-xs sm:text-sm md:flex-row md:items-start md:justify-between md:text-left"
      >
        <div class="space-y-1">
          <p>&copy; {{ year }} {{ companyName() }}. All rights reserved.</p>
          @if (websiteUrl() && websiteLabel()) {
            <p>
              <a
                [href]="websiteUrl()"
                target="_blank"
                rel="noopener noreferrer"
                class="font-medium underline decoration-white/40 underline-offset-2 transition hover:text-white"
                [class.hover:text-elva-800]="variant() === 'light'"
                [class.decoration-elva-300]="variant() === 'light'"
              >
                {{ websiteLabel() }}
              </a>
            </p>
          }
        </div>

        @if (supportEmail()) {
          <div class="max-w-md space-y-1 md:text-right">
            <p>
              Email
              <a
                [href]="'mailto:' + supportEmail()"
                class="font-medium underline decoration-white/40 underline-offset-2 transition hover:text-white"
                [class.hover:text-elva-800]="variant() === 'light'"
                [class.decoration-elva-300]="variant() === 'light'"
              >
                {{ supportEmail() }}
              </a>
            </p>
            @if (showTicketEmailHint()) {
              <p class="text-white/60" [class.text-slate-500]="variant() === 'light'">
                You can also create a support ticket by sending an email to this address.
              </p>
            }
          </div>
        }
      </div>
    </footer>
  `
})
export class ElvaFooterComponent {
  readonly variant = input<'dark' | 'light'>('dark');
  /** Organization / product name shown in copyright */
  readonly companyName = input('ELVA Support');
  readonly websiteLabel = input('elvatech.in');
  readonly websiteUrl = input('https://elvatech.in');
  readonly supportEmail = input('support@elvatech.in');
  readonly showTicketEmailHint = input(true);
  readonly year = new Date().getFullYear();
}
