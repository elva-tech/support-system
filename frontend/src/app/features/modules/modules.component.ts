import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ModuleService } from '../../core/services/module.service';
import { ApplicationService } from '../../core/services/application.service';
import { AppModule, Application, ApplicationRef } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-modules',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, StatusBadgeComponent, ConfirmDialogComponent],
  template: `
    <div class="space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 class="text-2xl font-bold text-slate-900">Modules</h2>
          <p class="text-sm text-slate-500">Functional modules within each application</p>
        </div>
        @if (isAdmin()) {
          <button type="button" class="btn-primary" (click)="openCreate()">Add Module</button>
        }
      </div>

      @if (error()) {
        <div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ error() }}</div>
      }

      <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table class="min-w-full divide-y divide-slate-200 text-sm">
          <thead class="bg-slate-50">
            <tr>
              <th class="px-4 py-3 text-left font-medium text-slate-600">Name</th>
              <th class="px-4 py-3 text-left font-medium text-slate-600">Code</th>
              <th class="px-4 py-3 text-left font-medium text-slate-600">Application</th>
              <th class="px-4 py-3 text-left font-medium text-slate-600">Status</th>
              @if (isAdmin()) {
                <th class="px-4 py-3 text-right font-medium text-slate-600">Actions</th>
              }
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            @for (mod of items(); track mod._id) {
              <tr class="hover:bg-slate-50">
                <td class="px-4 py-3 font-medium">{{ mod.name }}</td>
                <td class="px-4 py-3 font-mono text-xs">{{ mod.code }}</td>
                <td class="px-4 py-3">{{ appLabel(mod.applicationId) }}</td>
                <td class="px-4 py-3"><app-status-badge [active]="mod.isActive" /></td>
                @if (isAdmin()) {
                  <td class="px-4 py-3 text-right space-x-2">
                    <button type="button" class="text-elva-600 hover:underline" (click)="openEdit(mod)">Edit</button>
                    <button type="button" class="text-red-600 hover:underline" (click)="confirmDelete(mod)">Delete</button>
                  </td>
                }
              </tr>
            } @empty {
              <tr>
                <td colspan="5" class="px-4 py-8 text-center text-slate-500">No modules found.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    @if (showForm()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
        <div class="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
          <h3 class="text-lg font-semibold">{{ editingId() ? 'Edit Module' : 'New Module' }}</h3>
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
              <label class="form-label">Name</label>
              <input class="form-input" formControlName="name" />
            </div>
            <div>
              <label class="form-label">Code</label>
              <input class="form-input font-mono uppercase" formControlName="code" />
            </div>
            <div>
              <label class="form-label">Description</label>
              <textarea class="form-input" rows="3" formControlName="description"></textarea>
            </div>
            <label class="flex items-center gap-2 text-sm">
              <input type="checkbox" formControlName="isActive" class="rounded border-slate-300" />
              Active
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

    <app-confirm-dialog
      [open]="!!deleteTarget()"
      title="Delete module"
      [message]="'Delete ' + (deleteTarget()?.name || '') + '?'"
      (confirmed)="delete()"
      (cancelled)="deleteTarget.set(null)"
    />
  `
})
export class ModulesComponent implements OnInit {
  private readonly api = inject(ModuleService);
  private readonly appApi = inject(ApplicationService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly isAdmin = this.auth.isAdmin;
  readonly items = signal<AppModule[]>([]);
  readonly applications = signal<Application[]>([]);
  readonly error = signal('');
  readonly showForm = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly saving = signal(false);
  readonly deleteTarget = signal<AppModule | null>(null);

  readonly form = this.fb.nonNullable.group({
    applicationId: ['', Validators.required],
    name: ['', Validators.required],
    code: ['', Validators.required],
    description: [''],
    isActive: [true]
  });

  ngOnInit(): void {
    this.appApi.list().subscribe((res) => this.applications.set(res.data));
    this.load();
  }

  appLabel(ref: ApplicationRef | string): string {
    if (typeof ref === 'string') return ref;
    return `${ref.name} (${ref.code})`;
  }

  load(): void {
    this.api.list().subscribe({
      next: (res) => this.items.set(res.data),
      error: (err: HttpErrorResponse) => this.error.set(err.error?.message || 'Failed to load modules')
    });
  }

  openCreate(): void {
    this.editingId.set(null);
    this.form.reset({ applicationId: '', name: '', code: '', description: '', isActive: true });
    this.showForm.set(true);
  }

  openEdit(mod: AppModule): void {
    this.editingId.set(mod._id);
    const appId = typeof mod.applicationId === 'string' ? mod.applicationId : mod.applicationId._id;
    this.form.patchValue({ ...mod, applicationId: appId });
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
  }

  save(): void {
    if (this.form.invalid) return;
    this.saving.set(true);
    const payload = this.form.getRawValue();
    const id = this.editingId();
    const request = id ? this.api.update(id, payload) : this.api.create(payload);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.closeForm();
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(err.error?.message || 'Save failed');
        this.saving.set(false);
      }
    });
  }

  confirmDelete(mod: AppModule): void {
    this.deleteTarget.set(mod);
  }

  delete(): void {
    const target = this.deleteTarget();
    if (!target) return;

    this.api.delete(target._id).subscribe({
      next: () => {
        this.deleteTarget.set(null);
        this.load();
      },
      error: (err: HttpErrorResponse) => this.error.set(err.error?.message || 'Delete failed')
    });
  }
}
