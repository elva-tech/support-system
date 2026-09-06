import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import {
  CentralSupportApiService,
  CentralSupportTeam
} from '../../../core/services/central-support-api.service';
import {
  CentralSupportRole,
  CentralSupportUser
} from '../../../core/services/central-support-auth.service';
import { formatApiError } from '../../../shared/utils/api-error.util';

@Component({
  selector: 'app-central-support-agents',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">Agents</h1>
          <p class="mt-1 text-sm text-slate-500">
            Manage Central Support identities (admins, team leads, and agents).
          </p>
        </div>
        <button type="button" class="btn-primary" (click)="openCreate()">Add agent</button>
      </div>

      @if (error()) {
        <div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ error() }}</div>
      }
      @if (message()) {
        <div class="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {{ message() }}
        </div>
      }

      <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table class="min-w-full text-left text-sm">
          <thead class="bg-slate-50 text-slate-500">
            <tr>
              <th class="px-4 py-3">Name</th>
              <th class="px-4 py-3">Email</th>
              <th class="px-4 py-3">Role</th>
              <th class="px-4 py-3">Team</th>
              <th class="px-4 py-3">Status</th>
              <th class="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (a of agents(); track a.id) {
              <tr class="border-t border-slate-100">
                <td class="px-4 py-3 font-medium">{{ a.name }}</td>
                <td class="px-4 py-3">{{ a.email }}</td>
                <td class="px-4 py-3">{{ roleLabel(a.role) }}</td>
                <td class="px-4 py-3">{{ teamName(a.teamId) }}</td>
                <td class="px-4 py-3">{{ a.status }}</td>
                <td class="px-4 py-3 text-right space-x-2">
                  <button type="button" class="text-elva-600 hover:underline" (click)="openEdit(a)">Edit</button>
                  @if (a.status === 'ACTIVE') {
                    <button type="button" class="text-amber-700 hover:underline" (click)="setStatus(a, 'DISABLED')">
                      Deactivate
                    </button>
                  } @else {
                    <button type="button" class="text-emerald-700 hover:underline" (click)="setStatus(a, 'ACTIVE')">
                      Activate
                    </button>
                  }
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="6" class="px-4 py-8 text-center text-slate-500">
                  {{ loading() ? 'Loading…' : 'No agents found.' }}
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    @if (showForm()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/50 p-4">
        <div class="my-8 w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
          <h3 class="text-lg font-semibold">{{ editingId() ? 'Edit agent' : 'Add agent' }}</h3>
          <form [formGroup]="form" (ngSubmit)="save()" class="mt-4 space-y-4">
            <div>
              <label class="form-label">Name</label>
              <input class="form-input" formControlName="name" />
            </div>
            <div>
              <label class="form-label">Email</label>
              <input type="email" class="form-input" formControlName="email" />
            </div>
            <div>
              <label class="form-label">{{ editingId() ? 'Password (optional)' : 'Password' }}</label>
              <input type="password" class="form-input" formControlName="password" autocomplete="new-password" />
            </div>
            <div>
              <label class="form-label">Role</label>
              <select class="form-input" formControlName="role">
                <option value="CENTRAL_SUPPORT_AGENT">Agent</option>
                <option value="CENTRAL_SUPPORT_TEAM_LEAD">Team Lead</option>
                <option value="CENTRAL_SUPPORT_ADMIN">Admin</option>
              </select>
            </div>
            <div>
              <label class="form-label">Team</label>
              <select class="form-input" formControlName="teamId">
                <option value="">None</option>
                @for (t of teams(); track t.id) {
                  <option [value]="t.id">{{ t.name }}</option>
                }
              </select>
            </div>
            <div class="flex justify-end gap-3 pt-2">
              <button type="button" class="btn-secondary" (click)="closeForm()">Cancel</button>
              <button type="submit" class="btn-primary" [disabled]="form.invalid || saving()">
                {{ saving() ? 'Saving…' : 'Save' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `
})
export class CentralSupportAgentsComponent implements OnInit {
  private readonly api = inject(CentralSupportApiService);
  private readonly fb = inject(FormBuilder);

  readonly agents = signal<CentralSupportUser[]>([]);
  readonly teams = signal<CentralSupportTeam[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  readonly showForm = signal(false);
  readonly editingId = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: [''],
    role: ['CENTRAL_SUPPORT_AGENT' as CentralSupportRole, Validators.required],
    teamId: ['']
  });

  ngOnInit(): void {
    this.load();
    this.api.listTeams(true).subscribe({
      next: (res) => this.teams.set(res.data || []),
      error: () => undefined
    });
  }

  roleLabel(role: string): string {
    if (role === 'CENTRAL_SUPPORT_ADMIN') return 'Admin';
    if (role === 'CENTRAL_SUPPORT_TEAM_LEAD') return 'Team Lead';
    if (role === 'CENTRAL_SUPPORT_AGENT') return 'Agent';
    return role;
  }

  teamName(teamId?: string | null): string {
    if (!teamId) return '—';
    return this.teams().find((t) => t.id === teamId)?.name || teamId;
  }

  load(): void {
    this.loading.set(true);
    this.api.listAgents().subscribe({
      next: (res) => {
        this.agents.set(res.data || []);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(formatApiError(err));
        this.loading.set(false);
      }
    });
  }

  openCreate(): void {
    this.editingId.set(null);
    this.form.reset({
      name: '',
      email: '',
      password: '',
      role: 'CENTRAL_SUPPORT_AGENT',
      teamId: ''
    });
    this.form.controls.password.setValidators([Validators.required, Validators.minLength(8)]);
    this.form.controls.password.updateValueAndValidity();
    this.showForm.set(true);
  }

  openEdit(agent: CentralSupportUser): void {
    this.editingId.set(agent.id);
    this.form.reset({
      name: agent.name,
      email: agent.email,
      password: '',
      role: agent.role,
      teamId: agent.teamId || ''
    });
    this.form.controls.password.setValidators([Validators.minLength(8)]);
    this.form.controls.password.updateValueAndValidity();
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
  }

  save(): void {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.error.set('');
    this.message.set('');
    const raw = this.form.getRawValue();
    const id = this.editingId();

    if (id) {
      const patch: {
        name: string;
        email: string;
        role: CentralSupportRole;
        teamId: string | null;
        password?: string;
      } = {
        name: raw.name,
        email: raw.email,
        role: raw.role,
        teamId: raw.teamId || null
      };
      if (raw.password.trim()) {
        patch.password = raw.password;
      }
      this.api.updateAgent(id, patch).subscribe({
        next: () => {
          this.saving.set(false);
          this.closeForm();
          this.message.set('Agent updated');
          this.load();
        },
        error: (err: HttpErrorResponse) => {
          this.error.set(formatApiError(err, 'Save failed'));
          this.saving.set(false);
        }
      });
      return;
    }

    this.api
      .createAgent({
        name: raw.name,
        email: raw.email,
        password: raw.password,
        role: raw.role,
        teamId: raw.teamId || null
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.closeForm();
          this.message.set('Agent created');
          this.load();
        },
        error: (err: HttpErrorResponse) => {
          this.error.set(formatApiError(err, 'Create failed'));
          this.saving.set(false);
        }
      });
  }

  setStatus(agent: CentralSupportUser, status: string): void {
    this.error.set('');
    this.message.set('');
    this.api.updateAgent(agent.id, { status }).subscribe({
      next: () => {
        this.message.set(status === 'ACTIVE' ? 'Agent activated' : 'Agent deactivated');
        this.load();
      },
      error: (err: HttpErrorResponse) => this.error.set(formatApiError(err))
    });
  }
}
