import { Component, EventEmitter, Output, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ApplicationService } from '../../../core/services/application.service';
import { ModuleService } from '../../../core/services/module.service';
import { TeamService } from '../../../core/services/team.service';
import { UserService } from '../../../core/services/user.service';
import { Application, Team, User, AppModule } from '../../../core/models';

export interface QueueFilters {
  search?: string;
  application?: string;
  module?: string;
  team?: string;
  status?: string;
  assignedTo?: string;
}

@Component({
  selector: 'app-ticket-queue-filters',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div [formGroup]="form" class="space-y-4">
      <div class="card flex flex-col gap-3 sm:flex-row">
        <div class="flex-1">
          <label class="form-label">Search</label>
          <input
            class="form-input"
            type="search"
            formControlName="search"
            placeholder="Ticket #, subject, merchant name or email"
            (keyup.enter)="emitFilters()"
          />
        </div>
        <div class="flex items-end gap-2">
          <button type="button" class="btn-primary" (click)="emitFilters()">Search</button>
          <button type="button" class="btn-secondary" (click)="clearSearch()">Clear</button>
        </div>
      </div>

      <div class="card grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label class="form-label">Application</label>
          <select class="form-input" formControlName="application" (change)="emitFilters()">
            <option value="">All</option>
            @for (app of applications(); track app._id) {
              <option [value]="app.code">{{ app.name }}</option>
            }
          </select>
        </div>
        <div>
          <label class="form-label">Module</label>
          <select class="form-input" formControlName="module" (change)="emitFilters()">
            <option value="">All</option>
            @for (mod of modules(); track mod._id) {
              <option [value]="mod._id">{{ mod.name }}</option>
            }
          </select>
        </div>
        <div>
          <label class="form-label">Team</label>
          <select class="form-input" formControlName="team" (change)="emitFilters()">
            <option value="">All</option>
            @for (team of teams(); track team._id) {
              <option [value]="team._id">{{ team.name }}</option>
            }
          </select>
        </div>
        <div>
          <label class="form-label">Status</label>
          <select class="form-input" formControlName="status" (change)="emitFilters()">
            <option value="">All</option>
            @for (status of statuses; track status) {
              <option [value]="status">{{ status.replace('_', ' ') }}</option>
            }
          </select>
        </div>
        <div>
          <label class="form-label">Assigned Agent</label>
          <select class="form-input" formControlName="assignedTo" (change)="emitFilters()">
            <option value="">All</option>
            <option value="unassigned">Unassigned</option>
            @for (user of agents(); track user._id) {
              <option [value]="user._id">{{ user.firstName }} {{ user.lastName }}</option>
            }
          </select>
        </div>
      </div>
    </div>
  `
})
export class TicketQueueFiltersComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly appApi = inject(ApplicationService);
  private readonly modApi = inject(ModuleService);
  private readonly teamApi = inject(TeamService);
  private readonly userApi = inject(UserService);

  @Output() filtersChange = new EventEmitter<QueueFilters>();

  readonly applications = signal<Application[]>([]);
  readonly modules = signal<AppModule[]>([]);
  readonly teams = signal<Team[]>([]);
  readonly agents = signal<User[]>([]);

  readonly statuses = ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER', 'RESOLVED', 'CLOSED'];

  readonly form = this.fb.nonNullable.group({
    search: [''],
    application: [''],
    module: [''],
    team: [''],
    status: [''],
    assignedTo: ['']
  });

  ngOnInit(): void {
    this.appApi.list().subscribe((res) => this.applications.set(res.data));
    this.modApi.list().subscribe((res) => this.modules.set(res.data));
    this.teamApi.list().subscribe((res) => this.teams.set(res.data));
    this.userApi.list().subscribe((res) => {
      this.agents.set(res.data.filter((u) => u.role === 'AGENT' || u.role === 'TEAM_LEAD'));
    });
  }

  clearSearch(): void {
    this.form.patchValue({ search: '' });
    this.emitFilters();
  }

  emitFilters(): void {
    const raw = this.form.getRawValue();
    const filters: QueueFilters = {};
    if (raw.search.trim()) filters.search = raw.search.trim();
    if (raw.application) filters.application = raw.application;
    if (raw.module) filters.module = raw.module;
    if (raw.team) filters.team = raw.team;
    if (raw.status) filters.status = raw.status;
    if (raw.assignedTo) filters.assignedTo = raw.assignedTo;
    this.filtersChange.emit(filters);
  }
}
