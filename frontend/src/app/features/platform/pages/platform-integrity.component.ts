import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IntegrityFinding,
  PlatformApiService,
  PlatformTenant
} from '../../../core/services/platform-api.service';
import { PlatformAuthService } from '../../../core/services/platform-auth.service';
import { formatApiError } from '../../../shared/utils/api-error.util';

@Component({
  selector: 'app-platform-integrity',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-6">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">Data Integrity</h1>
          <p class="mt-1 text-sm text-slate-500">
            Diagnostics for missing or mismatched tenant ownership. Repairs are explicit and audited.
          </p>
        </div>
        <button type="button" class="btn-primary" (click)="rescan()" [disabled]="loading()">
          {{ loading() ? 'Scanning…' : 'Run scan' }}
        </button>
      </div>

      @if (error()) {
        <div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ error() }}</div>
      }
      @if (message()) {
        <div class="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{{ message() }}</div>
      }

      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p class="text-xs uppercase tracking-wide text-slate-500">Total findings</p>
          <p class="mt-1 text-2xl font-semibold text-slate-900">{{ summary()['totalFindings'] || 0 }}</p>
        </div>
        <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p class="text-xs uppercase tracking-wide text-slate-500">Critical</p>
          <p class="mt-1 text-2xl font-semibold text-rose-700">{{ summary()['criticalFindings'] || 0 }}</p>
        </div>
        <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p class="text-xs uppercase tracking-wide text-slate-500">High</p>
          <p class="mt-1 text-2xl font-semibold text-amber-700">{{ summary()['highFindings'] || 0 }}</p>
        </div>
        <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p class="text-xs uppercase tracking-wide text-slate-500">Warnings</p>
          <p class="mt-1 text-2xl font-semibold text-sky-700">{{ summary()['warningFindings'] || 0 }}</p>
        </div>
      </div>

      @if (collections().length) {
        <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table class="min-w-full divide-y divide-slate-200 text-sm">
            <thead class="bg-slate-50">
              <tr>
                <th class="px-4 py-3 text-left font-medium text-slate-600">Collection</th>
                <th class="px-4 py-3 text-left font-medium text-slate-600">Status</th>
                <th class="px-4 py-3 text-left font-medium text-slate-600">Findings</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              @for (c of collections(); track c['collection']) {
                <tr>
                  <td class="px-4 py-3 font-medium">{{ c['label'] || c['collection'] }}</td>
                  <td class="px-4 py-3">
                    <span
                      class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium"
                      [class]="c['healthy'] ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'"
                    >
                      {{ c['healthy'] ? 'Healthy' : 'Needs attention' }}
                    </span>
                  </td>
                  <td class="px-4 py-3">{{ c['findings'] || 0 }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      <div class="flex flex-wrap gap-3">
        <select class="form-input max-w-[14rem]" [(ngModel)]="collectionFilter" (change)="loadFindings(1)">
          <option value="">All collections</option>
          @for (c of collectionOptions; track c) {
            <option [value]="c">{{ c }}</option>
          }
        </select>
        <select class="form-input max-w-[10rem]" [(ngModel)]="severityFilter" (change)="loadFindings(1)">
          <option value="">All severities</option>
          <option value="CRITICAL">Critical</option>
          <option value="HIGH">High</option>
          <option value="WARNING">Warning</option>
        </select>
        <label class="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" [(ngModel)]="repairableOnly" (change)="loadFindings(1)" />
          Repairable only
        </label>
      </div>

      <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table class="min-w-full divide-y divide-slate-200 text-sm">
          <thead class="bg-slate-50">
            <tr>
              <th class="px-4 py-3 text-left font-medium text-slate-600">Severity</th>
              <th class="px-4 py-3 text-left font-medium text-slate-600">Collection</th>
              <th class="px-4 py-3 text-left font-medium text-slate-600">Issue</th>
              <th class="px-4 py-3 text-left font-medium text-slate-600">Record</th>
              <th class="px-4 py-3 text-left font-medium text-slate-600">Tenants</th>
              <th class="px-4 py-3 text-right font-medium text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            @for (f of findings(); track f.id) {
              <tr>
                <td class="px-4 py-3">
                  <span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium" [ngClass]="severityClass(f.severity)">
                    {{ f.severity }}
                  </span>
                </td>
                <td class="px-4 py-3">{{ f.collection }}</td>
                <td class="px-4 py-3">
                  <div class="font-medium text-slate-900">{{ f.issueType }}</div>
                  <div class="text-xs text-slate-500">{{ f.reason }}</div>
                </td>
                <td class="px-4 py-3 font-mono text-xs">{{ f.recordId }}</td>
                <td class="px-4 py-3 text-xs">
                  <div>Current: {{ f.actualTenantId || 'null' }}</div>
                  <div>Expected: {{ f.expectedTenantId || f.suggestedTenantId || '—' }}</div>
                </td>
                <td class="px-4 py-3 text-right space-x-2">
                  @if (f.repairable && isSuperAdmin()) {
                    <button type="button" class="text-elva-600 hover:underline" (click)="autoRepair(f, true)">Dry-run</button>
                    <button type="button" class="text-emerald-700 hover:underline" (click)="autoRepair(f, false)">Auto repair</button>
                  }
                  @if (isSuperAdmin()) {
                    <button type="button" class="text-amber-800 hover:underline" (click)="openManual(f)">Manual</button>
                  }
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="6" class="px-4 py-8 text-center text-slate-500">
                  {{ loading() ? 'Scanning…' : 'No findings for current filters.' }}
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      @if (manualFinding()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div class="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 class="text-lg font-semibold">Manual repair</h3>
            <p class="mt-2 text-sm text-slate-600">
              You are manually assigning tenant ownership. This can affect tenant isolation.
            </p>
            <p class="mt-2 font-mono text-xs text-slate-500">{{ manualFinding()?.collection }} / {{ manualFinding()?.recordId }}</p>
            <label class="form-label mt-4">Tenant</label>
            <select class="form-input" [(ngModel)]="manualTenantId">
              <option value="">Select tenant</option>
              @for (t of tenants(); track t.id) {
                <option [value]="t.id">{{ t.name }} ({{ t.slug }})</option>
              }
            </select>
            <label class="mt-3 flex items-center gap-2 text-sm">
              <input type="checkbox" [(ngModel)]="manualConfirm" />
              I confirm this repair
            </label>
            <div class="mt-4 flex justify-end gap-2">
              <button type="button" class="btn-secondary" (click)="manualFinding.set(null)">Cancel</button>
              <button type="button" class="btn-primary" [disabled]="!manualConfirm || !manualTenantId" (click)="submitManual()">
                Repair
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class PlatformIntegrityComponent implements OnInit {
  private readonly api = inject(PlatformApiService);
  private readonly auth = inject(PlatformAuthService);

  readonly summary = signal<Record<string, unknown>>({});
  readonly collections = signal<Record<string, unknown>[]>([]);
  readonly findings = signal<IntegrityFinding[]>([]);
  readonly tenants = signal<PlatformTenant[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  readonly manualFinding = signal<IntegrityFinding | null>(null);

  collectionFilter = '';
  severityFilter = '';
  repairableOnly = false;
  manualTenantId = '';
  manualConfirm = false;

  readonly collectionOptions = [
    'users',
    'applications',
    'teams',
    'merchantprofiles',
    'merchantsessions',
    'tickets',
    'ticketsequences',
    'emailthreads',
    'inboundmailqueues',
    'classificationqueues',
    'notificationevents',
    'notificationdeliveries',
    'auditlogs'
  ];

  ngOnInit(): void {
    this.api.listTenants({ limit: 200 }).subscribe({
      next: (res) => this.tenants.set(res.data.items || []),
      error: () => undefined
    });
    this.refresh();
  }

  isSuperAdmin(): boolean {
    return this.auth.hasRole('PLATFORM_SUPER_ADMIN');
  }

  severityClass(severity: string): string {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-rose-50 text-rose-800';
      case 'HIGH':
        return 'bg-amber-50 text-amber-900';
      case 'WARNING':
        return 'bg-sky-50 text-sky-800';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  }

  refresh(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.getIntegritySummary().subscribe({
      next: (res) => {
        this.summary.set(res.data || {});
        this.collections.set((res.data?.['collections'] as Record<string, unknown>[]) || []);
        this.loading.set(false);
        this.loadFindings(1);
      },
      error: (err) => {
        this.error.set(formatApiError(err));
        this.loading.set(false);
      }
    });
  }

  rescan(): void {
    this.loading.set(true);
    this.api.runIntegrityScan().subscribe({
      next: (res) => {
        this.summary.set(res.data || {});
        this.collections.set((res.data?.['collections'] as Record<string, unknown>[]) || []);
        this.message.set(`Scan complete — ${res.findingsCount} findings`);
        this.loading.set(false);
        this.loadFindings(1);
      },
      error: (err) => {
        this.error.set(formatApiError(err));
        this.loading.set(false);
      }
    });
  }

  loadFindings(page: number): void {
    const query: Record<string, string | number | boolean | undefined> = {
      page,
      limit: 25
    };
    if (this.collectionFilter) query['collection'] = this.collectionFilter;
    if (this.severityFilter) query['severity'] = this.severityFilter;
    if (this.repairableOnly) query['repairable'] = 'true';

    this.api.listIntegrityFindings(query).subscribe({
      next: (res) => this.findings.set(res.data || []),
      error: (err) => this.error.set(formatApiError(err))
    });
  }

  autoRepair(finding: IntegrityFinding, dryRun: boolean): void {
    if (!finding.suggestedTenantId) {
      this.error.set('No suggested tenant for this finding');
      return;
    }
    if (!dryRun) {
      const ok = window.confirm(
        'This repair will assign tenant ownership based on a verified related record. Continue?'
      );
      if (!ok) return;
    }
    if (dryRun) {
      this.message.set(
        `Dry-run: would set ${finding.collection}/${finding.recordId} → tenant ${finding.suggestedTenantId}`
      );
      return;
    }
    this.api
      .repairIntegrity({
        collection: finding.collection,
        recordId: finding.recordId,
        tenantId: finding.suggestedTenantId,
        confirmation: true
      })
      .subscribe({
        next: (res) => {
          this.message.set(res.message);
          this.refresh();
        },
        error: (err) => this.error.set(formatApiError(err))
      });
  }

  openManual(finding: IntegrityFinding): void {
    this.manualFinding.set(finding);
    this.manualTenantId = finding.suggestedTenantId || finding.expectedTenantId || '';
    this.manualConfirm = false;
  }

  submitManual(): void {
    const finding = this.manualFinding();
    if (!finding || !this.manualConfirm || !this.manualTenantId) return;
    this.api
      .repairIntegrity({
        collection: finding.collection,
        recordId: finding.recordId,
        tenantId: this.manualTenantId,
        confirmation: true
      })
      .subscribe({
        next: (res) => {
          this.message.set(res.message);
          this.manualFinding.set(null);
          this.refresh();
        },
        error: (err) => this.error.set(formatApiError(err))
      });
  }
}
