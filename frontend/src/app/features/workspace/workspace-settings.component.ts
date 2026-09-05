import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { WorkspaceApiService } from '../../core/services/workspace-api.service';
import { BrandingService } from '../../core/portal/branding.service';
import { CustomerTerminologyService } from '../../core/portal/customer-terminology.service';
import { HEX_COLOR_PATTERN, CUSTOMER_LABEL_COPY, CustomerLabel } from '../../core/portal/default-branding';
import { formatApiError } from '../../shared/utils/api-error.util';

@Component({
  selector: 'app-workspace-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Workspace settings</h1>
        <p class="mt-1 text-sm text-slate-500">
          Organization identity, branding, and support preferences for this workspace.
          <a routerLink="/setup" class="hover:underline" [style.color]="'var(--tenant-primary-color)'"
            >Open setup checklist</a
          >
        </p>
      </div>

      @if (error()) {
        <div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ error() }}</div>
      }
      @if (success()) {
        <div class="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{{ success() }}</div>
      }

      <form class="card space-y-4" [formGroup]="orgForm" (ngSubmit)="saveOrg()">
        <h2 class="text-lg font-semibold">Organization</h2>
        <p class="text-xs text-slate-500">Workspace slug cannot be changed here (platform-managed).</p>
        <div>
          <label class="form-label">Organization name</label>
          <input class="form-input" formControlName="displayName" />
        </div>
        <div>
          <label class="form-label">Legal / business name</label>
          <input class="form-input" formControlName="legalName" />
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="form-label">Support email</label>
            <input class="form-input" type="email" formControlName="supportEmail" />
          </div>
          <div>
            <label class="form-label">Primary contact email</label>
            <input class="form-input" type="email" formControlName="primaryContactEmail" />
          </div>
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="form-label">Primary contact name</label>
            <input class="form-input" formControlName="primaryContactName" />
          </div>
          <div>
            <label class="form-label">Phone</label>
            <input class="form-input" formControlName="phone" />
          </div>
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="form-label">Website</label>
            <input class="form-input" formControlName="website" />
          </div>
          <div>
            <label class="form-label">Country</label>
            <input class="form-input" formControlName="country" />
          </div>
        </div>
        <div>
          <label class="form-label">Timezone</label>
          <input class="form-input" formControlName="timezone" />
        </div>
        <div>
          <label class="form-label">Address</label>
          <textarea class="form-input" rows="2" formControlName="address"></textarea>
        </div>
        <button type="submit" class="btn-primary" [disabled]="orgForm.invalid || saving()">Save organization</button>
      </form>

      <form class="card space-y-4" [formGroup]="brandForm" (ngSubmit)="saveBrand()">
        <h2 class="text-lg font-semibold">Branding</h2>
        <div>
          <label class="form-label">Support display name</label>
          <input class="form-input" formControlName="supportDisplayName" placeholder="ABC Support" />
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="form-label">Primary color</label>
            <div class="flex gap-2">
              <input type="color" class="h-10 w-12 cursor-pointer rounded border border-slate-300" [value]="colorPickerPrimary()" (input)="onPrimaryPicker($event)" />
              <input class="form-input" formControlName="primaryColor" placeholder="#13294b" />
            </div>
            @if (brandForm.controls.primaryColor.invalid && brandForm.controls.primaryColor.touched) {
              <p class="mt-1 text-xs text-red-600">Use #RGB or #RRGGBB</p>
            }
          </div>
          <div>
            <label class="form-label">Secondary color</label>
            <div class="flex gap-2">
              <input type="color" class="h-10 w-12 cursor-pointer rounded border border-slate-300" [value]="colorPickerSecondary()" (input)="onSecondaryPicker($event)" />
              <input class="form-input" formControlName="secondaryColor" placeholder="#4a6789" />
            </div>
          </div>
        </div>
        <div>
          <label class="form-label">Login page title</label>
          <input class="form-input" formControlName="loginTitle" placeholder="Welcome to ABC Support" />
        </div>
        <div>
          <label class="form-label">Login page subtitle</label>
          <input
            class="form-input"
            formControlName="loginSubtitle"
            placeholder="Manage and track your support requests in one place."
          />
        </div>
        <div>
          <label class="form-label">Logo</label>
          <input type="file" class="form-input" accept=".png,.jpg,.jpeg,.webp" (change)="onLogo($event)" />
          @if (logoPreview()) {
            <img [src]="logoPreview()!" alt="Logo" class="mt-3 h-16 w-16 rounded object-cover" />
          }
        </div>
        <div
          class="rounded-lg border border-slate-200 p-4"
          [style.border-left-color]="previewPrimary()"
          [style.border-left-width]="'4px'"
        >
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Preview</p>
          <p class="mt-1 text-sm font-medium" [style.color]="previewPrimary()">
            {{ brandForm.controls.supportDisplayName.value || 'Support display name' }}
          </p>
          <p class="text-xs text-slate-500">
            {{ brandForm.controls.loginTitle.value || 'Login title' }} —
            {{ brandForm.controls.loginSubtitle.value || 'Login subtitle' }}
          </p>
        </div>
        <div class="flex flex-wrap gap-3">
          <button type="submit" class="btn-primary" [disabled]="brandForm.invalid || saving()">Save branding</button>
          @if (hasLogo()) {
            <button type="button" class="btn-secondary" (click)="removeLogo()" [disabled]="saving()">Remove logo</button>
          }
        </div>
      </form>

      <form class="card space-y-4" [formGroup]="supportForm" (ngSubmit)="saveSupport()">
        <h2 class="text-lg font-semibold">Support preferences</h2>
        <p class="text-xs text-slate-500">
          Customer terminology is a UI label only. It does not rename database models or APIs.
        </p>
        <div>
          <label class="form-label">Customer terminology</label>
          <select class="form-input" formControlName="customerLabel">
            <option value="CLIENT">Client</option>
            <option value="CUSTOMER">Customer</option>
            <option value="MERCHANT">Merchant</option>
          </select>
        </div>
        <div class="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <p class="font-medium">{{ terminologyPreview().plural }}</p>
          <p class="text-xs text-slate-500">{{ terminologyPreview().add }} · {{ terminologyPreview().details }}</p>
        </div>
        <button type="submit" class="btn-primary" [disabled]="saving()">Save support preferences</button>
      </form>

      <div class="card">
        <h2 class="text-lg font-semibold">Configuration shortcuts</h2>
        <div class="mt-4 flex flex-wrap gap-3 text-sm">
          <a routerLink="/teams" class="hover:underline" [style.color]="'var(--tenant-primary-color)'">Teams</a>
          <a routerLink="/users" class="hover:underline" [style.color]="'var(--tenant-primary-color)'">Users</a>
          <a routerLink="/applications" class="hover:underline" [style.color]="'var(--tenant-primary-color)'"
            >Applications</a
          >
          <a routerLink="/modules" class="hover:underline" [style.color]="'var(--tenant-primary-color)'">Modules</a>
          <a routerLink="/merchants" class="hover:underline" [style.color]="'var(--tenant-primary-color)'">{{
            terms.plural()
          }}</a>
        </div>
      </div>
    </div>
  `
})
export class WorkspaceSettingsComponent implements OnInit {
  private readonly api = inject(WorkspaceApiService);
  private readonly brandingSvc = inject(BrandingService);
  readonly terms = inject(CustomerTerminologyService);
  private readonly fb = inject(FormBuilder);

  readonly error = signal('');
  readonly success = signal('');
  readonly saving = signal(false);
  readonly hasLogo = signal(false);
  readonly logoPreview = signal<string | null>(null);
  private logoFile: File | null = null;

  readonly orgForm = this.fb.nonNullable.group({
    displayName: ['', Validators.required],
    legalName: [''],
    supportEmail: ['', Validators.email],
    primaryContactEmail: ['', Validators.email],
    primaryContactName: [''],
    phone: [''],
    website: [''],
    timezone: [''],
    country: [''],
    address: ['']
  });

  readonly brandForm = this.fb.nonNullable.group({
    supportDisplayName: [''],
    primaryColor: ['', Validators.pattern(/^$|^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/)],
    secondaryColor: ['', Validators.pattern(/^$|^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/)],
    loginTitle: [''],
    loginSubtitle: ['']
  });

  readonly supportForm = this.fb.nonNullable.group({
    customerLabel: ['CLIENT' as CustomerLabel]
  });

  readonly terminologyPreview = computed(() => {
    const label = (this.supportForm.controls.customerLabel.value || 'CLIENT') as CustomerLabel;
    return CUSTOMER_LABEL_COPY[label] || CUSTOMER_LABEL_COPY.CLIENT;
  });

  colorPickerPrimary(): string {
    const v = this.brandForm.controls.primaryColor.value;
    return HEX_COLOR_PATTERN.test(v) && v.length === 7 ? v : '#13294b';
  }

  colorPickerSecondary(): string {
    const v = this.brandForm.controls.secondaryColor.value;
    return HEX_COLOR_PATTERN.test(v) && v.length === 7 ? v : '#4a6789';
  }

  previewPrimary(): string {
    const v = this.brandForm.controls.primaryColor.value;
    return HEX_COLOR_PATTERN.test(v) ? v : 'var(--tenant-primary-color)';
  }

  onPrimaryPicker(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.brandForm.controls.primaryColor.setValue(value);
  }

  onSecondaryPicker(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.brandForm.controls.secondaryColor.setValue(value);
  }

  ngOnInit(): void {
    this.api.getSettings().subscribe({
      next: (res) => {
        const org = res.data.organization || {};
        this.orgForm.patchValue({
          displayName: org.displayName || org.name || '',
          legalName: org.legalName || '',
          supportEmail: org.supportEmail || '',
          primaryContactEmail: org.primaryContactEmail || '',
          primaryContactName: org.primaryContactName || '',
          phone: org.phone || '',
          website: org.website || '',
          timezone: org.timezone || '',
          country: org.country || '',
          address: org.address || ''
        });
        this.brandForm.patchValue({
          supportDisplayName: res.data.branding?.supportDisplayName || '',
          primaryColor: res.data.branding?.primaryColor || '',
          secondaryColor: res.data.branding?.secondaryColor || '',
          loginTitle: res.data.branding?.loginTitle || '',
          loginSubtitle: res.data.branding?.loginSubtitle || ''
        });
        this.supportForm.patchValue({
          customerLabel: (res.data.support?.customerLabel || 'CLIENT') as CustomerLabel
        });
        this.hasLogo.set(Boolean(res.data.branding?.logoFileId));
        if (res.data.branding?.logoFileId) {
          this.api.fetchLogoBlob().subscribe({
            next: (blob) => this.logoPreview.set(URL.createObjectURL(blob))
          });
        }
      },
      error: (err: HttpErrorResponse) => this.error.set(formatApiError(err))
    });
  }

  onLogo(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.logoFile = input.files?.[0] || null;
  }

  saveOrg(): void {
    this.saving.set(true);
    this.error.set('');
    this.api.updateOrganization(this.orgForm.getRawValue()).subscribe({
      next: () => {
        this.success.set('Organization updated');
        this.saving.set(false);
        this.brandingSvc.refreshTenantBranding();
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(formatApiError(err));
        this.saving.set(false);
      }
    });
  }

  saveBrand(): void {
    this.saving.set(true);
    this.error.set('');
    const raw = this.brandForm.getRawValue();
    this.api
      .updateBranding({
        supportDisplayName: raw.supportDisplayName,
        primaryColor: raw.primaryColor || null,
        secondaryColor: raw.secondaryColor || null,
        loginTitle: raw.loginTitle,
        loginSubtitle: raw.loginSubtitle
      })
      .subscribe({
        next: () => {
          if (this.logoFile) {
            this.api.uploadLogo(this.logoFile).subscribe({
              next: () => {
                this.hasLogo.set(true);
                this.success.set('Branding updated');
                this.saving.set(false);
                this.brandingSvc.refreshTenantBranding();
              },
              error: (err: HttpErrorResponse) => {
                this.error.set(formatApiError(err));
                this.saving.set(false);
              }
            });
          } else {
            this.success.set('Branding updated');
            this.saving.set(false);
            this.brandingSvc.refreshTenantBranding();
          }
        },
        error: (err: HttpErrorResponse) => {
          this.error.set(formatApiError(err));
          this.saving.set(false);
        }
      });
  }

  saveSupport(): void {
    this.saving.set(true);
    this.error.set('');
    this.api.updateSupport(this.supportForm.getRawValue()).subscribe({
      next: () => {
        this.success.set('Support preferences updated');
        this.saving.set(false);
        this.brandingSvc.refreshTenantBranding();
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(formatApiError(err));
        this.saving.set(false);
      }
    });
  }

  removeLogo(): void {
    this.saving.set(true);
    this.api.deleteLogo().subscribe({
      next: () => {
        this.hasLogo.set(false);
        this.logoPreview.set(null);
        this.success.set('Logo removed');
        this.saving.set(false);
        this.brandingSvc.refreshTenantBranding();
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(formatApiError(err));
        this.saving.set(false);
      }
    });
  }
}
