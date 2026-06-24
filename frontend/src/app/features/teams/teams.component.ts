import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { TeamService } from '../../core/services/team.service';
import { ApplicationService } from '../../core/services/application.service';
import { ModuleService } from '../../core/services/module.service';
import { UserService } from '../../core/services/user.service';
import { Application, ApplicationRef, AppModule, Team, User } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-teams',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, StatusBadgeComponent, ConfirmDialogComponent],
  template: `
    <div class="space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 class="text-2xl font-bold text-slate-900">Teams</h2>
          <p class="text-sm text-slate-500">Support teams mapped to applications and modules</p>
        </div>
        @if (isAdmin()) {
          <button type="button" class="btn-primary" (click)="openCreate()">Add Team</button>
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
              <th class="px-4 py-3 text-left font-medium text-slate-600">Application</th>
              <th class="px-4 py-3 text-left font-medium text-slate-600">Team Lead</th>
              <th class="px-4 py-3 text-left font-medium text-slate-600">Members</th>
              <th class="px-4 py-3 text-left font-medium text-slate-600">Status</th>
              @if (isAdmin()) {
                <th class="px-4 py-3 text-right font-medium text-slate-600">Actions</th>
              }
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            @for (team of items(); track team._id) {
              <tr class="hover:bg-slate-50">
                <td class="px-4 py-3 font-medium">{{ team.name }}</td>
                <td class="px-4 py-3">{{ appLabel(team.applicationId) }}</td>
                <td class="px-4 py-3">{{ userLabel(team.teamLeadId) }}</td>
                <td class="px-4 py-3">{{ team.memberIds.length || 0 }}</td>
                <td class="px-4 py-3"><app-status-badge [active]="team.isActive" /></td>
                @if (isAdmin()) {
                  <td class="px-4 py-3 text-right space-x-2">
                    <button type="button" class="text-elva-600 hover:underline" (click)="openEdit(team)">Edit</button>
                    <button type="button" class="text-red-600 hover:underline" (click)="confirmDelete(team)">Delete</button>
                  </td>
                }
              </tr>
            } @empty {
              <tr>
                <td colspan="6" class="px-4 py-8 text-center text-slate-500">No teams found.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    @if (showForm()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/50 p-4">
        <div class="my-8 w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl">
          <h3 class="text-lg font-semibold">{{ editingId() ? 'Edit Team' : 'New Team' }}</h3>
          <form [formGroup]="form" (ngSubmit)="save()" class="mt-4 space-y-4">
            <div class="grid gap-4 sm:grid-cols-2">
              <div class="sm:col-span-2">
                <label class="form-label">Name</label>
                <input class="form-input" formControlName="name" />
              </div>
              <div class="sm:col-span-2">
                <label class="form-label">Application</label>
                <select class="form-input" formControlName="applicationId" (change)="onAppChange()">
                  <option value="">Select application</option>
                  @for (app of applications(); track app._id) {
                    <option [value]="app._id">{{ app.name }}</option>
                  }
                </select>
              </div>
              <div class="sm:col-span-2">
                <label class="form-label">Description</label>
                <textarea class="form-input" rows="2" formControlName="description"></textarea>
              </div>
              <div>
                <label class="form-label">Team Lead</label>
                <select class="form-input" formControlName="teamLeadId">
                  <option value="">None</option>
                  @for (user of users(); track user._id) {
                    <option [value]="user._id">{{ user.firstName }} {{ user.lastName }}</option>
                  }
                </select>
              </div>
              <div>
                <label class="form-label">Modules</label>
                <select class="form-input" formControlName="moduleIds" multiple size="4">
                  @for (mod of filteredModules(); track mod._id) {
                    <option [value]="mod._id">{{ mod.name }} ({{ mod.code }})</option>
                  }
                </select>
              </div>
              <div class="sm:col-span-2">
                <label class="form-label">Members</label>
                <select class="form-input" formControlName="memberIds" multiple size="4">
                  @for (user of users(); track user._id) {
                    <option [value]="user._id">{{ user.firstName }} {{ user.lastName }} — {{ user.role }}</option>
                  }
                </select>
              </div>
              <label class="flex items-center gap-2 text-sm sm:col-span-2">
                <input type="checkbox" formControlName="isActive" class="rounded border-slate-300" />
                Active
              </label>
            </div>
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
      title="Delete team"
      [message]="'Delete ' + (deleteTarget()?.name || '') + '?'"
      (confirmed)="delete()"
      (cancelled)="deleteTarget.set(null)"
    />
  `
})
export class TeamsComponent implements OnInit {
  private readonly api = inject(TeamService);
  private readonly appApi = inject(ApplicationService);
  private readonly modApi = inject(ModuleService);
  private readonly userApi = inject(UserService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly isAdmin = this.auth.isAdmin;
  readonly items = signal<Team[]>([]);
  readonly applications = signal<Application[]>([]);
  readonly allModules = signal<AppModule[]>([]);
  readonly users = signal<User[]>([]);
  readonly filteredModules = signal<AppModule[]>([]);
  readonly error = signal('');
  readonly showForm = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly saving = signal(false);
  readonly deleteTarget = signal<Team | null>(null);

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    applicationId: ['', Validators.required],
    description: [''],
    teamLeadId: [''],
    moduleIds: [[] as string[]],
    memberIds: [[] as string[]],
    isActive: [true]
  });

  ngOnInit(): void {
    this.appApi.list().subscribe((res) => this.applications.set(res.data));
    this.modApi.list().subscribe((res) => this.allModules.set(res.data));
    this.userApi.list().subscribe((res) => this.users.set(res.data));
    this.load();
  }

  appLabel(ref: ApplicationRef | string): string {
    if (typeof ref === 'string') return ref;
    return ref.name;
  }

  userLabel(ref: User | string | null | undefined): string {
    if (!ref) return '—';
    if (typeof ref === 'string') return ref;
    return `${ref.firstName} ${ref.lastName}`;
  }

  onAppChange(): void {
    const appId = this.form.controls.applicationId.value;
    this.filteredModules.set(
      this.allModules().filter((m) => {
        const id = typeof m.applicationId === 'string' ? m.applicationId : m.applicationId._id;
        return id === appId;
      })
    );
    this.form.patchValue({ moduleIds: [] });
  }

  load(): void {
    this.api.list().subscribe({
      next: (res) => this.items.set(res.data),
      error: (err: HttpErrorResponse) => this.error.set(err.error?.message || 'Failed to load teams')
    });
  }

  openCreate(): void {
    this.editingId.set(null);
    this.form.reset({
      name: '',
      applicationId: '',
      description: '',
      teamLeadId: '',
      moduleIds: [],
      memberIds: [],
      isActive: true
    });
    this.filteredModules.set([]);
    this.showForm.set(true);
  }

  openEdit(team: Team): void {
    this.editingId.set(team._id);
    const appId = typeof team.applicationId === 'string' ? team.applicationId : team.applicationId._id;
    this.filteredModules.set(
      this.allModules().filter((m) => {
        const id = typeof m.applicationId === 'string' ? m.applicationId : m.applicationId._id;
        return id === appId;
      })
    );
    this.form.patchValue({
      name: team.name,
      applicationId: appId,
      description: team.description,
      teamLeadId: team.teamLeadId
        ? typeof team.teamLeadId === 'string'
          ? team.teamLeadId
          : team.teamLeadId._id
        : '',
      moduleIds: team.moduleIds.map((m) => (typeof m === 'string' ? m : m._id)),
      memberIds: team.memberIds.map((m) => (typeof m === 'string' ? m : m._id)),
      isActive: team.isActive
    });
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
  }

  save(): void {
    if (this.form.invalid) return;
    this.saving.set(true);
    const raw = this.form.getRawValue();
    const payload = {
      ...raw,
      teamLeadId: raw.teamLeadId || null
    };
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

  confirmDelete(team: Team): void {
    this.deleteTarget.set(team);
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
