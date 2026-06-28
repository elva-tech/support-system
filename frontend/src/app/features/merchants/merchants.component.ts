import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MerchantAdminService } from '../../core/services/merchant-admin.service';
import { ApplicationService } from '../../core/services/application.service';
import { Application, ApplicationRef, Merchant } from '../../core/models';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';

@Component({
  selector: 'app-merchants',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, StatusBadgeComponent],
  template: `
    <div class="space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 class="text-2xl font-bold text-slate-900">Merchants</h2>
          <p class="text-sm text-slate-500">
            Register merchant emails per application — they sign in with OTP at the merchant portal
          </p>
        </div>
        <button type="button" class="btn-primary" (click)="openCreate()">Add Merchant</button>
      </div>

      @if (error()) {
        <div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ error() }}</div>
      }

      @if (successMessage()) {
        <div class="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {{ successMessage() }}
        </div>
      }

      <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table class="min-w-full divide-y divide-slate-200 text-sm">
          <thead class="bg-slate-50">
            <tr>
              <th class="px-4 py-3 text-left font-medium text-slate-600">Email</th>
              <th class="px-4 py-3 text-left font-medium text-slate-600">Name</th>
              <th class="px-4 py-3 text-left font-medium text-slate-600">Application</th>
              <th class="px-4 py-3 text-left font-medium text-slate-600">Phone</th>
              <th class="px-4 py-3 text-left font-medium text-slate-600">Status</th>
              <th class="px-4 py-3 text-right font-medium text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            @for (merchant of items(); track merchant._id) {
              <tr class="hover:bg-slate-50">
                <td class="px-4 py-3">{{ merchant.email }}</td>
                <td class="px-4 py-3 font-medium">{{ merchant.merchantName }}</td>
                <td class="px-4 py-3">{{ appLabel(merchant.applicationId) }}</td>
                <td class="px-4 py-3 text-slate-600">{{ merchant.phone || '—' }}</td>
                <td class="px-4 py-3"><app-status-badge [active]="merchant.isActive" /></td>
                <td class="px-4 py-3 text-right">
                  <button type="button" class="text-elva-600 hover:underline" (click)="openEdit(merchant)">
                    Edit
                  </button>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="6" class="px-4 py-8 text-center text-slate-500">
                  No merchants registered yet. Add an email and application to enable OTP login.
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    @if (showForm()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
        <div class="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
          <h3 class="text-lg font-semibold">{{ editingId() ? 'Edit Merchant' : 'Register Merchant' }}</h3>
          <p class="mt-1 text-sm text-slate-500">
            A welcome email with portal access details will be sent to this address.
          </p>
          <form [formGroup]="form" (ngSubmit)="save()" class="mt-4 space-y-4">
            <div>
              <label class="form-label">Application</label>
              <select class="form-input" formControlName="applicationId">
                <option value="">Select application</option>
                @for (app of applications(); track app._id) {
                  <option [value]="app._id">{{ app.name }} ({{ app.code }})</option>
                }
              </select>
            </div>
            <div>
              <label class="form-label">Email</label>
              <input type="email" class="form-input" formControlName="email" autocomplete="off" />
            </div>
            <div>
              <label class="form-label">Display name</label>
              <input class="form-input" formControlName="merchantName" placeholder="Optional — defaults from email" />
            </div>
            <div>
              <label class="form-label">Phone</label>
              <input class="form-input" formControlName="phone" placeholder="Optional" />
            </div>
            <label class="flex items-center gap-2 text-sm">
              <input type="checkbox" formControlName="isActive" class="rounded border-slate-300" />
              Active (can request OTP)
            </label>
            <div class="flex justify-end gap-3 pt-2">
              <button type="button" class="btn-secondary" (click)="closeForm()">Cancel</button>
              <button type="submit" class="btn-primary" [disabled]="form.invalid || saving()">
                {{ saving() ? 'Saving...' : 'Save' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `
})
export class MerchantsComponent implements OnInit {
  private readonly api = inject(MerchantAdminService);
  private readonly appApi = inject(ApplicationService);
  private readonly fb = inject(FormBuilder);

  readonly items = signal<Merchant[]>([]);
  readonly applications = signal<Application[]>([]);
  readonly error = signal('');
  readonly successMessage = signal('');
  readonly showForm = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly saving = signal(false);

  readonly form = this.fb.nonNullable.group({
    applicationId: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    merchantName: [''],
    phone: [''],
    isActive: [true]
  });

  ngOnInit(): void {
    this.appApi.list().subscribe({
      next: (res) => this.applications.set(res.data.filter((a) => a.isActive)),
      error: (err: HttpErrorResponse) => this.error.set(err.error?.message || 'Failed to load applications')
    });
    this.load();
  }

  appLabel(ref: ApplicationRef | string): string {
    if (typeof ref === 'string') return ref;
    return `${ref.name} (${ref.code})`;
  }

  load(): void {
    this.api.list().subscribe({
      next: (res) => this.items.set(res.data),
      error: (err: HttpErrorResponse) => this.error.set(err.error?.message || 'Failed to load merchants')
    });
  }

  openCreate(): void {
    this.editingId.set(null);
    this.form.reset({
      applicationId: '',
      email: '',
      merchantName: '',
      phone: '',
      isActive: true
    });
    this.showForm.set(true);
  }

  openEdit(merchant: Merchant): void {
    this.editingId.set(merchant._id);
    this.form.reset({
      applicationId: typeof merchant.applicationId === 'string' ? merchant.applicationId : merchant.applicationId._id,
      email: merchant.email,
      merchantName: merchant.merchantName,
      phone: merchant.phone || '',
      isActive: merchant.isActive
    });
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
    this.editingId.set(null);
  }

  save(): void {
    if (this.form.invalid) return;

    this.saving.set(true);
    this.error.set('');

    const payload = this.form.getRawValue();
    const id = this.editingId();

    const request = id
      ? this.api.update(id, payload)
      : this.api.create({
          ...payload,
          merchantName: payload.merchantName || undefined
        });

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.closeForm();
        this.successMessage.set(id ? 'Merchant updated.' : 'Merchant registered — OTP login is now enabled for this email.');
        setTimeout(() => this.successMessage.set(''), 5000);
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(err.error?.message || 'Failed to save merchant');
        this.saving.set(false);
      }
    });
  }
}
