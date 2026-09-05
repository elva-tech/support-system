import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { UserService } from '../../core/services/user.service';
import { TeamService } from '../../core/services/team.service';
import { Team, User, UserLifecycleStatus, UserRole } from '../../core/models';
import { RoleBadgeComponent } from '../../shared/components/role-badge/role-badge.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RoleBadgeComponent, ConfirmDialogComponent],
  template: `
    <div class="space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 class="text-2xl font-bold text-slate-900">Users</h2>
          <p class="text-sm text-slate-500">Invite and manage staff for this workspace</p>
        </div>
        <button type="button" class="btn-primary" (click)="openInvite()">Invite User</button>
      </div>

      @if (error()) {
        <div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ error() }}</div>
      }

      <div class="flex flex-wrap gap-3">
        <input
          class="form-input max-w-xs"
          placeholder="Search name or email"
          [ngModel]="search()"
          (ngModelChange)="onSearch($event)"
          [ngModelOptions]="{ standalone: true }"
        />
        <select class="form-input max-w-[10rem]" [ngModel]="statusFilter()" (ngModelChange)="onStatusFilter($event)" [ngModelOptions]="{ standalone: true }">
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INVITED">Invited</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="DEACTIVATED">Deactivated</option>
        </select>
      </div>

      <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table class="min-w-full divide-y divide-slate-200 text-sm">
          <thead class="bg-slate-50">
            <tr>
              <th class="px-4 py-3 text-left font-medium text-slate-600">Name</th>
              <th class="px-4 py-3 text-left font-medium text-slate-600">Email</th>
              <th class="px-4 py-3 text-left font-medium text-slate-600">Role</th>
              <th class="px-4 py-3 text-left font-medium text-slate-600">Application & Team</th>
              <th class="px-4 py-3 text-left font-medium text-slate-600">Status</th>
              <th class="px-4 py-3 text-right font-medium text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            @for (user of filteredItems(); track user._id) {
              <tr class="hover:bg-slate-50">
                <td class="px-4 py-3 font-medium">{{ user.firstName }} {{ user.lastName }}</td>
                <td class="px-4 py-3">{{ user.email }}</td>
                <td class="px-4 py-3"><app-role-badge [role]="user.role" /></td>
                <td class="px-4 py-3">{{ assignmentLabel(user) }}</td>
                <td class="px-4 py-3">
                  <span class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium" [ngClass]="statusClass(user)">
                    {{ statusLabel(user) }}
                  </span>
                </td>
                <td class="px-4 py-3 text-right">
                  <div class="flex flex-wrap justify-end gap-2">
                    <button type="button" class="text-elva-600 hover:underline" (click)="openEdit(user)">Edit</button>
                    @if (lifecycleStatus(user) === 'INVITED') {
                      <button type="button" class="text-elva-600 hover:underline" (click)="resend(user)">Resend</button>
                      <button type="button" class="text-amber-700 hover:underline" (click)="revoke(user)">Revoke</button>
                    }
                    @if (lifecycleStatus(user) === 'ACTIVE') {
                      <button type="button" class="text-amber-700 hover:underline" (click)="suspend(user)">Suspend</button>
                      <button type="button" class="text-red-600 hover:underline" (click)="deactivate(user)">Deactivate</button>
                    }
                    @if (lifecycleStatus(user) === 'SUSPENDED' || lifecycleStatus(user) === 'DEACTIVATED') {
                      <button type="button" class="text-emerald-700 hover:underline" (click)="reactivate(user)">Reactivate</button>
                    }
                    <button type="button" class="text-red-600 hover:underline" (click)="confirmDelete(user)">Delete</button>
                  </div>
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
          <h3 class="text-lg font-semibold">{{ editingId() ? 'Edit User' : 'Invite User' }}</h3>
          <p class="mt-1 text-sm text-slate-500">
            @if (editingId()) {
              Update profile details. Passwords are set only by the user via invitation.
            } @else {
              An invitation email will be sent. The invitee sets their own password.
            }
          </p>

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
              <label class="form-label">Role</label>
              <select class="form-input" formControlName="role">
                @for (role of roles; track role) {
                  <option [value]="role">{{ role }}</option>
                }
              </select>
            </div>
            @if (form.controls.role.value !== 'ADMIN') {
              <div>
                <label class="form-label">Application & Team</label>
                <select class="form-input" formControlName="teamId">
                  <option value="">Select application and team</option>
                  @for (team of teams(); track team._id) {
                    <option [value]="team._id">{{ teamOptionLabel(team) }}</option>
                  }
                </select>
              </div>
            }
            <div class="flex justify-end gap-3 pt-2">
              <button type="button" class="btn-secondary" (click)="closeForm()">Cancel</button>
              <button type="submit" class="btn-primary" [disabled]="form.invalid || saving()">
                {{ saving() ? 'Saving...' : editingId() ? 'Save' : 'Send invitation' }}
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
  private readonly teamApi = inject(TeamService);
  private readonly fb = inject(FormBuilder);

  readonly roles: UserRole[] = ['ADMIN', 'TEAM_LEAD', 'AGENT'];
  readonly items = signal<User[]>([]);
  readonly teams = signal<Team[]>([]);
  readonly error = signal('');
  readonly showForm = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly saving = signal(false);
  readonly deleteTarget = signal<User | null>(null);
  readonly search = signal('');
  readonly statusFilter = signal('');

  readonly form = this.fb.nonNullable.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    role: ['AGENT' as UserRole, Validators.required],
    teamId: ['']
  });

  ngOnInit(): void {
    this.teamApi.list().subscribe((res) => this.teams.set(res.data));
    this.form.controls.role.valueChanges.subscribe((role) => this.updateTeamValidators(role));
    this.load();
  }

  filteredItems(): User[] {
    const q = this.search().trim().toLowerCase();
    const status = this.statusFilter();
    return this.items().filter((u) => {
      if (status && this.lifecycleStatus(u) !== status) return false;
      if (!q) return true;
      return (
        u.email.toLowerCase().includes(q) ||
        `${u.firstName} ${u.lastName}`.toLowerCase().includes(q)
      );
    });
  }

  onSearch(value: string): void {
    this.search.set(value);
  }

  onStatusFilter(value: string): void {
    this.statusFilter.set(value);
  }

  lifecycleStatus(user: User): UserLifecycleStatus {
    if (user.status) return user.status;
    return user.isActive ? 'ACTIVE' : 'DEACTIVATED';
  }

  statusLabel(user: User): string {
    return this.lifecycleStatus(user);
  }

  statusClass(user: User): string {
    switch (this.lifecycleStatus(user)) {
      case 'ACTIVE':
        return 'bg-emerald-50 text-emerald-800';
      case 'INVITED':
        return 'bg-sky-50 text-sky-800';
      case 'SUSPENDED':
        return 'bg-amber-50 text-amber-900';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  }

  teamOptionLabel(team: Team): string {
    const app = team.applicationId;
    const appLabel = typeof app === 'string' ? app : `${app.name} (${app.code})`;
    return `${appLabel} — ${team.name}`;
  }

  assignmentLabel(user: User): string {
    if (user.role === 'ADMIN') return '—';
    const teamId = user.teamId;
    if (!teamId) return '—';
    if (typeof teamId === 'object') {
      const team = this.teams().find((t) => t._id === teamId._id);
      if (team) return this.teamOptionLabel(team);
      return teamId.name;
    }
    const team = this.teams().find((t) => t._id === teamId);
    return team ? this.teamOptionLabel(team) : '—';
  }

  load(): void {
    this.api.list().subscribe({
      next: (res) => this.items.set(res.data),
      error: (err: HttpErrorResponse) => this.error.set(err.error?.message || 'Failed to load users')
    });
  }

  openInvite(): void {
    this.editingId.set(null);
    this.form.reset({
      firstName: '',
      lastName: '',
      email: '',
      role: 'AGENT',
      teamId: ''
    });
    this.form.controls.teamId.setValidators([Validators.required]);
    this.form.controls.teamId.updateValueAndValidity();
    this.showForm.set(true);
  }

  openEdit(user: User): void {
    this.editingId.set(user._id);
    this.form.patchValue({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      teamId: user.teamId ? (typeof user.teamId === 'string' ? user.teamId : user.teamId._id) : ''
    });
    this.updateTeamValidators(user.role);
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
  }

  private updateTeamValidators(role: UserRole): void {
    if (role === 'ADMIN') {
      this.form.controls.teamId.clearValidators();
      this.form.controls.teamId.setValue('');
    } else {
      this.form.controls.teamId.setValidators([Validators.required]);
    }
    this.form.controls.teamId.updateValueAndValidity();
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
      teamId: raw.role === 'ADMIN' ? null : raw.teamId || null
    };

    const id = this.editingId();
    const request = id ? this.api.update(id, payload) : this.api.invite(payload);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.closeForm();
        this.error.set('');
        this.load();
        this.teamApi.list().subscribe((res) => this.teams.set(res.data));
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(err.error?.message || 'Save failed');
        this.saving.set(false);
      }
    });
  }

  resend(user: User): void {
    this.api.resendInvitation(user._id).subscribe({
      next: () => {
        this.error.set('');
        this.load();
      },
      error: (err: HttpErrorResponse) => this.error.set(err.error?.message || 'Resend failed')
    });
  }

  revoke(user: User): void {
    this.api.revokeInvitation(user._id).subscribe({
      next: () => this.load(),
      error: (err: HttpErrorResponse) => this.error.set(err.error?.message || 'Revoke failed')
    });
  }

  suspend(user: User): void {
    this.api.suspend(user._id).subscribe({
      next: () => this.load(),
      error: (err: HttpErrorResponse) => this.error.set(err.error?.message || 'Suspend failed')
    });
  }

  reactivate(user: User): void {
    this.api.reactivate(user._id).subscribe({
      next: () => this.load(),
      error: (err: HttpErrorResponse) => this.error.set(err.error?.message || 'Reactivate failed')
    });
  }

  deactivate(user: User): void {
    this.api.deactivate(user._id).subscribe({
      next: () => this.load(),
      error: (err: HttpErrorResponse) => this.error.set(err.error?.message || 'Deactivate failed')
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
