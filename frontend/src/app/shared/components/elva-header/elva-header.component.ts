import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-elva-header',
  standalone: true,
  imports: [RouterLink],
  template: `
    <header class="w-full border-b border-white/10 bg-elva-brand px-4 py-3 sm:px-6">
      <div class="mx-auto flex w-full max-w-6xl items-center justify-between gap-2 sm:gap-4">
        <a routerLink="/" class="inline-flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
          <img
            src="/images/elva-logo.png"
            alt="ELVA — Elevating Value"
            class="h-12 w-12 shrink-0 rounded-md object-cover sm:h-14 sm:w-14"
          />
          @if (showTitle()) {
            <div class="min-w-0 text-left leading-tight">
              <p class="text-[10px] font-semibold uppercase tracking-wider text-white/70 sm:text-xs">
                ELVA Support
              </p>
              <p class="truncate text-sm font-bold text-white sm:text-base">{{ subtitle() }}</p>
              @if (tagline()) {
                <p
                  class="truncate text-[10px] italic text-white/60 sm:text-xs"
                  [class.hidden]="showActionsOnMobile()"
                  [class.sm:block]="showActionsOnMobile()"
                >
                  {{ tagline() }}
                </p>
              }
            </div>
          }
        </a>

        <div
          class="flex shrink-0 items-center justify-end gap-1.5 sm:gap-2"
          [class.hidden]="!showActionsOnMobile()"
          [class.sm:flex]="!showActionsOnMobile()"
          [class.max-w-[55%]]="compactActions()"
          [class.overflow-x-auto]="compactActions()"
        >
          <ng-content />
        </div>
      </div>
    </header>
  `
})
export class ElvaHeaderComponent {
  readonly align = input<'left' | 'center'>('left');
  readonly subtitle = input('Customer Help Center');
  readonly tagline = input('Elevating Value');
  readonly showTitle = input(true);
  readonly compactActions = input(false);
  readonly showActionsOnMobile = input(false);
}
