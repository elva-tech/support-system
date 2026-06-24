import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ApplicationService } from '../../core/services/application.service';
import { Application } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-applications',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, StatusBadgeComponent, ConfirmDialogComponent],
  template: `
    <div class="space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 class="text-2xl font-bold text-slate-900">Applications</h2>
          <p class="text-sm text-slate-500">Manage tenant applications (CMS, PMS, HMS, etc.)</p>
        </div>
        @if (isAdmin()) {
          <button type="button" class="btn-primary" (click)="openCreate()">Add Application</button>
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
              <th class="px-4 py-3 text-left font-medium text-slate-600">Status</th>
              <th class="px-4 py-3 text-left font-medium text-slate-600">Description</th>
              @if (isAdmin()) {
                <th class="px-4 py-3 text-right font-medium text-slate-600">Actions</th>
              }
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            @for (app of items(); track app._id) {
              <tr class="hover:bg-slate-50">
                <td class="px-4 py-3 font-medium">{{ app.name }}</td>
                <td class="px-4 py-3 font-mono text-xs">{{ app.code }}</td>
                <td class="px-4 py-3"><app-status-badge [active]="app.isActive" /></td>
                <td class="px-4 py-3 text-slate-600">{{ app.description || '—' }}</td>
                @if (isAdmin()) {
                  <td class="px-4 py-3 text-right space-x-2">
                    <button type="button" class="text-elva-600 hover:underline" (click)="openEdit(app)">Edit</button>
                    <button type="button" class="text-red-600 hover:underline" (click)="confirmDelete(app)">Delete</button>
                  </td>
                }
              </tr>
            } @empty {
              <tr>
                <td colspan="5" class="px-4 py-8 text-center text-slate-500">No applications found.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    @if (showForm()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
        <div class="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
          <h3 class="text-lg font-semibold">{{ editingId() ? 'Edit Application' : 'New Application' }}</h3>
          <form [formGroup]="form" (ngSubmit)="save()" class="mt-4 space-y-4">
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
      title="Delete application"
      [message]="'Delete ' + (deleteTarget()?.name || '') + '?'"
      (confirmed)="delete()"
      (cancelled)="deleteTarget.set(null)"
    />
  `
})
export class ApplicationsComponent implements OnInit {
  private readonly api = inject(ApplicationService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly isAdmin = this.auth.isAdmin;
  readonly items = signal<Application[]>([]);
  readonly error = signal('');
  readonly showForm = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly saving = signal(false);
  readonly deleteTarget = signal<Application | null>(null);

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    code: ['', Validators.required],
    description: [''],
    isActive: [true]
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.list().subscribe({
      next: (res) => this.items.set(res.data),
      error: (err: HttpErrorResponse) => this.error.set(err.error?.message || 'Failed to load applications')
    });
  }

  openCreate(): void {
    this.editingId.set(null);
    this.form.reset({ name: '', code: '', description: '', isActive: true });
    this.showForm.set(true);
  }

  openEdit(app: Application): void {
    this.editingId.set(app._id);
    this.form.patchValue(app);
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

  confirmDelete(app: Application): void {
    this.deleteTarget.set(app);
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
