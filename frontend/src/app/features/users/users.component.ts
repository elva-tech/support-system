import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { UserService } from '../../core/services/user.service';
import { ApplicationService } from '../../core/services/application.service';
import { TeamService } from '../../core/services/team.service';
import { Application, Team, TeamRef, User, UserRole } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { RoleBadgeComponent } from '../../shared/components/role-badge/role-badge.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, StatusBadgeComponent, RoleBadgeComponent, ConfirmDialogComponent],
  template: `
    <div class="space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 class="text-2xl font-bold text-slate-900">Users</h2>
          <p class="text-sm text-slate-500">Manage admin, team lead, and agent accounts</p>
        </div>
        <button type="button" class="btn-primary" (click)="openCreate()">Add User</button>
      </div>

      @if (error()) {
        <div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ error() }}</div>
      }

      <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table class="min-w-full divide-y divide-slate-200 text-sm">
          <thead class="bg-slate-50">
            <tr>
              <th class="px-4 py-3 text-left font-medium text-slate-600">Name</th>
              <th class="px-4 py-3 text-left font-medium text-slate-600">Email</th>
              <th class="px-4 py-3 text-left font-medium text-slate-600">Role</th>
              <th class="px-4 py-3 text-left font-medium text-slate-600">Team</th>
              <th class="px-4 py-3 text-left font-medium text-slate-600">Status</th>
              <th class="px-4 py-3 text-right font-medium text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            @for (user of items(); track user._id) {
              <tr class="hover:bg-slate-50">
                <td class="px-4 py-3 font-medium">{{ user.firstName }} {{ user.lastName }}</td>
                <td class="px-4 py-3">{{ user.email }}</td>
                <td class="px-4 py-3"><app-role-badge [role]="user.role" /></td>
                <td class="px-4 py-3">{{ teamLabel(user.teamId) }}</td>
                <td class="px-4 py-3"><app-status-badge [active]="user.isActive" /></td>
                <td class="px-4 py-3 text-right space-x-2">
                  <button type="button" class="text-elva-600 hover:underline" (click)="openEdit(user)">Edit</button>
                  <button type="button" class="text-red-600 hover:underline" (click)="confirmDelete(user)">Delete</button>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="6" class="px-4 py-8 text-center text-slate-500">No users found.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    @if (showForm()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/50 p-4">
        <div class="my-8 w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
          <h3 class="text-lg font-semibold">{{ editingId() ? 'Edit User' : 'New User' }}</h3>
          <form [formGroup]="form" (ngSubmit)="save()" class="mt-4 space-y-4">
            <div class="grid gap-4 sm:grid-cols-2">
              <div>
                <label class="form-label">First Name</label>
                <input class="form-input" formControlName="firstName" />
              </div>
              <div>
                <label class="form-label">Last Name</label>
                <input class="form-input" formControlName="lastName" />
              </div>
            </div>
            <div>
              <label class="form-label">Email</label>
              <input type="email" class="form-input" formControlName="email" />
            </div>
            <div>
              <label class="form-label">Password {{ editingId() ? '(leave blank to keep)' : '' }}</label>
              <input type="password" class="form-input" formControlName="password" />
            </div>
            <div>
              <label class="form-label">Role</label>
              <select class="form-input" formControlName="role">
                @for (role of roles; track role) {
                  <option [value]="role">{{ role }}</option>
                }
              </select>
            </div>
            <div>
              <label class="form-label">Team</label>
              <select class="form-input" formControlName="teamId">
                <option value="">None</option>
                @for (team of teams(); track team._id) {
                  <option [value]="team._id">{{ team.name }}</option>
                }
              </select>
            </div>
            <div>
              <label class="form-label">Applications</label>
              <select class="form-input" formControlName="applicationIds" multiple size="4">
                @for (app of applications(); track app._id) {
                  <option [value]="app._id">{{ app.name }} ({{ app.code }})</option>
                }
              </select>
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
      title="Delete user"
      [message]="'Delete ' + (deleteTarget()?.email || '') + '?'"
      (confirmed)="delete()"
      (cancelled)="deleteTarget.set(null)"
    />
  `
})
export class UsersComponent implements OnInit {
  private readonly api = inject(UserService);
  private readonly appApi = inject(ApplicationService);
  private readonly teamApi = inject(TeamService);
  private readonly fb = inject(FormBuilder);

  readonly roles: UserRole[] = ['ADMIN', 'TEAM_LEAD', 'AGENT'];
  readonly items = signal<User[]>([]);
  readonly applications = signal<Application[]>([]);
  readonly teams = signal<Team[]>([]);
  readonly error = signal('');
  readonly showForm = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly saving = signal(false);
  readonly deleteTarget = signal<User | null>(null);

  readonly form = this.fb.nonNullable.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: [''],
    role: ['AGENT' as UserRole, Validators.required],
    teamId: [''],
    applicationIds: [[] as string[]],
    isActive: [true]
  });

  ngOnInit(): void {
    this.appApi.list().subscribe((res) => this.applications.set(res.data));
    this.teamApi.list().subscribe((res) => this.teams.set(res.data));
    this.load();
  }

  teamLabel(ref: TeamRef | string | null | undefined): string {
    if (!ref) return '—';
    if (typeof ref === 'string') return ref;
    return ref.name;
  }

  load(): void {
    this.api.list().subscribe({
      next: (res) => this.items.set(res.data),
      error: (err: HttpErrorResponse) => this.error.set(err.error?.message || 'Failed to load users')
    });
  }

  openCreate(): void {
    this.editingId.set(null);
    this.form.reset({
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      role: 'AGENT',
      teamId: '',
      applicationIds: [],
      isActive: true
    });
    this.form.controls.password.setValidators([Validators.required, Validators.minLength(8)]);
    this.form.controls.password.updateValueAndValidity();
    this.showForm.set(true);
  }

  openEdit(user: User): void {
    this.editingId.set(user._id);
    this.form.patchValue({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      password: '',
      role: user.role,
      teamId: user.teamId ? (typeof user.teamId === 'string' ? user.teamId : user.teamId._id) : '',
      applicationIds: (user.applicationIds || []).map((a) => (typeof a === 'string' ? a : a._id)),
      isActive: user.isActive
    });
    this.form.controls.password.clearValidators();
    this.form.controls.password.updateValueAndValidity();
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
  }

  save(): void {
    if (this.form.invalid) return;
    this.saving.set(true);
    const raw = this.form.getRawValue();
    const payload: Record<string, unknown> = {
      firstName: raw.firstName,
      lastName: raw.lastName,
      email: raw.email,
      role: raw.role,
      teamId: raw.teamId || null,
      applicationIds: raw.applicationIds,
      isActive: raw.isActive
    };

    if (raw.password) {
      payload['password'] = raw.password;
    }

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

  confirmDelete(user: User): void {
    this.deleteTarget.set(user);
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
