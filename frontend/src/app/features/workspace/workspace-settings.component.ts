import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { WorkspaceApiService } from '../../core/services/workspace-api.service';
import { BrandingService } from '../../core/portal/branding.service';
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
          Organization identity and branding for this support workspace.
          <a routerLink="/setup" class="text-elva-600 hover:underline">Open setup checklist</a>
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
          <label class="form-label">Display name</label>
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
          <input class="form-input" formControlName="supportDisplayName" />
        </div>
        <div>
          <label class="form-label">Primary color</label>
          <input class="form-input" formControlName="primaryColor" placeholder="#1a73e8" />
        </div>
        <div>
          <label class="form-label">Logo</label>
          <input type="file" class="form-input" accept=".png,.jpg,.jpeg,.webp" (change)="onLogo($event)" />
          @if (logoPreview()) {
            <img [src]="logoPreview()!" alt="Logo" class="mt-3 h-16 w-16 rounded object-cover" />
          }
        </div>
        <div class="flex flex-wrap gap-3">
          <button type="submit" class="btn-primary" [disabled]="saving()">Save branding</button>
          @if (hasLogo()) {
            <button type="button" class="btn-secondary" (click)="removeLogo()" [disabled]="saving()">Remove logo</button>
          }
        </div>
      </form>

      <div class="card">
        <h2 class="text-lg font-semibold">Configuration shortcuts</h2>
        <div class="mt-4 flex flex-wrap gap-3 text-sm">
          <a routerLink="/teams" class="text-elva-600 hover:underline">Teams</a>
          <a routerLink="/users" class="text-elva-600 hover:underline">Users</a>
          <a routerLink="/applications" class="text-elva-600 hover:underline">Applications</a>
          <a routerLink="/modules" class="text-elva-600 hover:underline">Modules</a>
          <a routerLink="/merchants" class="text-elva-600 hover:underline">Clients</a>
        </div>
      </div>
    </div>
  `
})
export class WorkspaceSettingsComponent implements OnInit {
  private readonly api = inject(WorkspaceApiService);
  private readonly brandingSvc = inject(BrandingService);
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
    primaryColor: ['']
  });

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
          primaryColor: res.data.branding?.primaryColor || ''
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
        primaryColor: raw.primaryColor || null
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
