import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import {
  CentralSupportApiService,
  CentralSupportTeam
} from '../../../core/services/central-support-api.service';
import {
  CentralSupportAuthService,
  CentralSupportUser
} from '../../../core/services/central-support-auth.service';
import { formatApiError } from '../../../shared/utils/api-error.util';

@Component({
  selector: 'app-central-support-teams',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">{{ isAdmin ? 'Teams' : 'Team' }}</h1>
          <p class="mt-1 text-sm text-slate-500">
            Central Support teams for routing and workload.
          </p>
        </div>
        @if (isAdmin) {
          <button type="button" class="btn-primary" (click)="openCreate()">Add team</button>
        }
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
              <th class="px-4 py-3">Description</th>
              <th class="px-4 py-3">Team Lead</th>
              <th class="px-4 py-3">Members</th>
              <th class="px-4 py-3">Status</th>
              @if (isAdmin) {
                <th class="px-4 py-3 text-right">Actions</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (t of teams(); track t.id) {
              <tr class="border-t border-slate-100">
                <td class="px-4 py-3 font-medium">{{ t.name }}</td>
                <td class="px-4 py-3 max-w-[16rem] truncate">{{ t.description || '—' }}</td>
                <td class="px-4 py-3">{{ t.teamLeadName || '—' }}</td>
                <td class="px-4 py-3">{{ t.memberIds?.length || 0 }}</td>
                <td class="px-4 py-3">{{ t.isActive ? 'Active' : 'Inactive' }}</td>
                @if (isAdmin) {
                  <td class="px-4 py-3 text-right space-x-2">
                    <button type="button" class="text-elva-600 hover:underline" (click)="openEdit(t)">Edit</button>
                    @if (t.isActive) {
                      <button type="button" class="text-red-600 hover:underline" (click)="deactivate(t)">
                        Deactivate
                      </button>
                    }
                  </td>
                }
              </tr>
            } @empty {
              <tr>
                <td [attr.colspan]="isAdmin ? 6 : 5" class="px-4 py-8 text-center text-slate-500">
                  {{ loading() ? 'Loading…' : 'No teams found.' }}
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
          <h3 class="text-lg font-semibold">{{ editingId() ? 'Edit team' : 'New team' }}</h3>
          <form [formGroup]="form" (ngSubmit)="save()" class="mt-4 space-y-4">
            <div>
              <label class="form-label">Name</label>
              <input class="form-input" formControlName="name" />
            </div>
            <div>
              <label class="form-label">Description</label>
              <textarea class="form-input" rows="2" formControlName="description"></textarea>
            </div>
            <div>
              <label class="form-label">Team Lead</label>
              <select class="form-input" formControlName="teamLeadId">
                <option value="">None</option>
                @for (a of agents(); track a.id) {
                  <option [value]="a.id">{{ a.name }} ({{ a.email }})</option>
                }
              </select>
            </div>
            <div>
              <label class="form-label">Members</label>
              <select class="form-input" formControlName="memberIds" multiple size="6">
                @for (a of agents(); track a.id) {
                  <option [value]="a.id">{{ a.name }} — {{ a.role }}</option>
                }
              </select>
              <p class="mt-1 text-xs text-slate-500">Hold Ctrl/Cmd to select multiple members.</p>
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
export class CentralSupportTeamsComponent implements OnInit {
  private readonly api = inject(CentralSupportApiService);
  private readonly auth = inject(CentralSupportAuthService);
  private readonly fb = inject(FormBuilder);

  readonly isAdmin = this.auth.hasRole('CENTRAL_SUPPORT_ADMIN');
  readonly teams = signal<CentralSupportTeam[]>([]);
  readonly agents = signal<CentralSupportUser[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  readonly showForm = signal(false);
  readonly editingId = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    description: [''],
    teamLeadId: [''],
    memberIds: [[] as string[]]
  });

  ngOnInit(): void {
    this.load();
    if (this.isAdmin) {
      this.api.listAgents().subscribe({
        next: (res) => this.agents.set(res.data || []),
        error: () => undefined
      });
    }
  }

  load(): void {
    this.loading.set(true);
    this.api.listTeams(this.isAdmin).subscribe({
      next: (res) => {
        this.teams.set(res.data || []);
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
    this.form.reset({ name: '', description: '', teamLeadId: '', memberIds: [] });
    this.showForm.set(true);
  }

  openEdit(team: CentralSupportTeam): void {
    this.editingId.set(team.id);
    this.form.reset({
      name: team.name,
      description: team.description || '',
      teamLeadId: team.teamLeadId || '',
      memberIds: [...(team.memberIds || [])]
    });
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
    const payload = {
      name: raw.name,
      description: raw.description,
      teamLeadId: raw.teamLeadId || null,
      memberIds: raw.memberIds || []
    };
    const id = this.editingId();
    const request = id ? this.api.updateTeam(id, payload) : this.api.createTeam(payload);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.closeForm();
        this.message.set(id ? 'Team updated' : 'Team created');
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(formatApiError(err, 'Save failed'));
        this.saving.set(false);
      }
    });
  }

  deactivate(team: CentralSupportTeam): void {
    this.error.set('');
    this.message.set('');
    this.api.deactivateTeam(team.id).subscribe({
      next: () => {
        this.message.set('Team deactivated');
        this.load();
      },
      error: (err: HttpErrorResponse) => this.error.set(formatApiError(err))
    });
  }
}
