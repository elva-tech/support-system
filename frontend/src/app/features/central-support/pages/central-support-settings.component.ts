import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DEFAULT_PLATFORM_SUPPORT_SLA_LABELS } from './central-support-sla.labels';

@Component({
  selector: 'app-central-support-settings',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Central Support settings</h1>
        <p class="mt-1 text-sm text-slate-500">
          Platform-controlled SLA defaults for tickets raised by business workspaces.
        </p>
      </div>
      <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 class="text-lg font-semibold">Default SLA policy</h2>
        <ul class="mt-4 space-y-2 text-sm text-slate-700">
          @for (row of policies; track row.priority) {
            <li class="flex justify-between border-b border-slate-100 py-2">
              <span class="font-medium">{{ row.priority }}</span>
              <span>Response {{ row.response }} · Resolution {{ row.resolution }}</span>
            </li>
          }
        </ul>
        <p class="mt-4 text-xs text-slate-500">
          These targets apply to PlatformSupportTicket records only — not tenant customer tickets.
        </p>
      </div>
    </div>
  `
})
export class CentralSupportSettingsComponent {
  readonly policies = DEFAULT_PLATFORM_SUPPORT_SLA_LABELS;
}
