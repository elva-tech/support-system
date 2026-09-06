import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  CentralSupportApiService,
  CentralSupportAssignee,
  CentralSupportTeam
} from '../../../core/services/central-support-api.service';
import {
  PlatformSupportTicket,
  PlatformSupportTimelineItem
} from '../../../core/services/platform-support-api.service';
import { formatApiError } from '../../../shared/utils/api-error.util';
import { formatSlaDuration } from '../../../shared/utils/sla-duration.util';

@Component({
  selector: 'app-platform-support-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="mx-auto max-w-4xl space-y-6">
      <a routerLink="/team-queue" class="text-sm text-elva-brand hover:underline">← Back to queue</a>

      @if (error()) {
        <div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ error() }}</div>
      }
      @if (message()) {
        <div class="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {{ message() }}
        </div>
      }

      @if (ticket(); as t) {
        <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <div>
            <h1 class="text-2xl font-bold text-slate-900">{{ t.ticketNumber }}</h1>
            <p class="mt-1 text-sm text-slate-500">{{ t.subject }}</p>
          </div>

          <div class="grid gap-4 sm:grid-cols-2 text-sm">
            <div>
              <h2 class="text-xs font-semibold uppercase text-slate-400">Ticket</h2>
              <p>Status: {{ t.status }}</p>
              <p>Priority: {{ t.priority }}</p>
              <p>Category: {{ t.categoryLabel || t.category }}</p>
              <p>Created: {{ t.createdAt | date: 'medium' }}</p>
              <p>
                Assigned:
                {{ t.assignedUserName || 'Unassigned' }}
                @if (t.assignedTeamName) {
                  <span class="text-slate-500">({{ t.assignedTeamName }})</span>
                }
              </p>
            </div>
            <div>
              <h2 class="text-xs font-semibold uppercase text-slate-400">Business context</h2>
              <p>{{ t.sourceOrganizationName }}</p>
              <p>
                <a class="text-elva-brand hover:underline" [href]="t.sourceWorkspaceUrl" target="_blank" rel="noopener">
                  {{ t.sourceWorkspaceUrl }}
                </a>
              </p>
              <p>Slug: {{ t.sourceTenantSlug }}</p>
            </div>
            <div>
              <h2 class="text-xs font-semibold uppercase text-slate-400">Requester</h2>
              <p>{{ t.raisedByName }}</p>
              <p>{{ t.raisedByEmail }}</p>
              <p>{{ t.raisedByRole }}</p>
            </div>
            <div>
              <h2 class="text-xs font-semibold uppercase text-slate-400">SLA</h2>
              @if (t.sla?.currentCycle; as c) {
                <p>Response: {{ c.responseState }} · {{ formatDuration(c.responseTargetMinutes) }}</p>
                <p>Resolution: {{ c.resolutionState }} · {{ formatDuration(c.resolutionTargetMinutes) }}</p>
              } @else {
                <p>—</p>
              }
            </div>
          </div>

          <div>
            <h2 class="text-xs font-semibold uppercase text-slate-400">Issue</h2>
            <p class="mt-2 whitespace-pre-wrap text-sm text-slate-800">{{ t.description }}</p>
          </div>

          <div class="flex flex-wrap gap-3 items-end">
            <div>
              <label class="form-label">Team</label>
              <select class="form-input" [(ngModel)]="assignTeamId">
                <option value="">Select team…</option>
                @for (team of teams(); track team.id) {
                  <option [value]="team.id">{{ team.name }}</option>
                }
              </select>
            </div>
            <div>
              <label class="form-label">Agent</label>
              <select class="form-input" [(ngModel)]="assignUserId">
                <option value="">Select agent…</option>
                @for (a of filteredAssignees(); track a.id) {
                  <option [value]="a.id">{{ a.name }} ({{ a.role }})</option>
                }
              </select>
            </div>
            <button
              type="button"
              class="btn-secondary"
              (click)="assign()"
              [disabled]="(!assignUserId && !assignTeamId) || busy()"
            >
              Assign
            </button>
            <button
              type="button"
              class="btn-secondary"
              (click)="unassign()"
              [disabled]="(!t.assignedUserId && !t.assignedTeamId) || busy()"
            >
              Unassign
            </button>
            <div>
              <label class="form-label">Status</label>
              <select class="form-input" [(ngModel)]="statusValue">
                <option value="OPEN">OPEN</option>
                <option value="IN_PROGRESS">IN_PROGRESS</option>
                <option value="WAITING_FOR_REQUESTER">WAITING_FOR_REQUESTER</option>
                <option value="RESOLVED">RESOLVED</option>
                <option value="CLOSED">CLOSED</option>
              </select>
            </div>
            <button type="button" class="btn-primary" (click)="saveStatus()" [disabled]="busy()">Update status</button>
          </div>
        </div>

        <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 class="font-semibold">Conversation</h2>
          @for (item of timeline(); track item.id) {
            <div class="rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <p class="text-xs text-slate-500">
                {{ item.senderName }} · {{ item.senderType }} · {{ item.createdAt | date: 'medium' }}
                @if (item.type === 'INTERNAL_NOTE') {
                  <span class="ml-1 rounded bg-amber-100 px-1 text-amber-800">internal</span>
                }
              </p>
              <p class="mt-1 whitespace-pre-wrap">{{ item.message }}</p>
            </div>
          }
          <form class="space-y-2" [formGroup]="replyForm" (ngSubmit)="reply(false)">
            <textarea class="form-input" rows="3" formControlName="message" placeholder="Reply to business user"></textarea>
            <div class="flex flex-wrap gap-2">
              <button type="submit" class="btn-primary" [disabled]="replyForm.invalid || busy()">Send reply</button>
              <button type="button" class="btn-secondary" [disabled]="replyForm.invalid || busy()" (click)="reply(true)">
                Add internal note
              </button>
            </div>
          </form>
        </div>
      } @else if (!error()) {
        <p class="text-sm text-slate-500">Loading…</p>
      }
    </div>
  `
})
export class PlatformSupportDetailComponent implements OnInit {
  private readonly api = inject(CentralSupportApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);

  readonly ticket = signal<PlatformSupportTicket | null>(null);
  readonly timeline = signal<PlatformSupportTimelineItem[]>([]);
  readonly assignees = signal<CentralSupportAssignee[]>([]);
  readonly teams = signal<CentralSupportTeam[]>([]);
  readonly error = signal('');
  readonly message = signal('');
  readonly busy = signal(false);
  assignUserId = '';
  assignTeamId = '';
  statusValue = 'OPEN';

  readonly replyForm = this.fb.nonNullable.group({
    message: ['', Validators.required]
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('Missing ticket id');
      return;
    }
    this.load(id);
    this.api.listAssignees().subscribe({
      next: (res) => this.assignees.set(res.data || []),
      error: () => undefined
    });
    this.api.listTeams().subscribe({
      next: (res) => this.teams.set(res.data || []),
      error: () => undefined
    });
  }

  filteredAssignees(): CentralSupportAssignee[] {
    const teamId = this.assignTeamId;
    if (!teamId) return this.assignees();
    return this.assignees().filter((a) => !a.teamId || a.teamId === teamId);
  }

  formatDuration(m?: number): string {
    return formatSlaDuration(m || 0);
  }

  load(id: string): void {
    this.api.getTimeline(id).subscribe({
      next: (res) => {
        this.ticket.set(res.data.ticket);
        this.timeline.set(res.data.timeline || []);
        this.statusValue = res.data.ticket.status;
        this.assignUserId = res.data.ticket.assignedUserId || '';
        this.assignTeamId = res.data.ticket.assignedTeamId || '';
      },
      error: (err) => this.error.set(formatApiError(err))
    });
  }

  assign(): void {
    const t = this.ticket();
    if (!t || (!this.assignUserId && !this.assignTeamId)) return;
    this.busy.set(true);
    this.error.set('');
    this.api
      .assignTicket(t.id, {
        assignedUserId: this.assignUserId || null,
        assignedTeamId: this.assignTeamId || null
      })
      .subscribe({
        next: () => {
          this.message.set('Ticket assigned');
          this.load(t.id);
          this.busy.set(false);
        },
        error: (err) => {
          this.error.set(formatApiError(err));
          this.busy.set(false);
        }
      });
  }

  unassign(): void {
    const t = this.ticket();
    if (!t) return;
    this.busy.set(true);
    this.error.set('');
    this.api.assignTicket(t.id, { unassign: true }).subscribe({
      next: () => {
        this.message.set('Ticket unassigned');
        this.assignUserId = '';
        this.assignTeamId = '';
        this.load(t.id);
        this.busy.set(false);
      },
      error: (err) => {
        this.error.set(formatApiError(err));
        this.busy.set(false);
      }
    });
  }

  saveStatus(): void {
    const t = this.ticket();
    if (!t) return;
    this.busy.set(true);
    this.api.updateStatus(t.id, this.statusValue).subscribe({
      next: () => {
        this.message.set('Status updated');
        this.load(t.id);
        this.busy.set(false);
      },
      error: (err) => {
        this.error.set(formatApiError(err));
        this.busy.set(false);
      }
    });
  }

  reply(internal: boolean): void {
    const t = this.ticket();
    if (!t || this.replyForm.invalid) return;
    this.busy.set(true);
    this.api.reply(t.id, this.replyForm.controls.message.value, internal).subscribe({
      next: () => {
        this.replyForm.reset({ message: '' });
        this.load(t.id);
        this.busy.set(false);
      },
      error: (err) => {
        this.error.set(formatApiError(err));
        this.busy.set(false);
      }
    });
  }
}
