import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { TicketService } from '../../core/services/ticket.service';
import { TeamService } from '../../core/services/team.service';
import { AuthService } from '../../core/services/auth.service';
import { Ticket, TicketStatus } from '../../core/models/ticket.model';
import { TimelineItem } from '../../core/models/conversation.model';
import { Team } from '../../core/models';
import { TicketAssignee } from '../../core/models/operations.model';
import { TicketStatusBadgeComponent } from '../../shared/components/ticket-status-badge/ticket-status-badge.component';
import { TicketTimelineComponent } from '../../shared/components/ticket-timeline/ticket-timeline.component';

@Component({
  selector: 'app-ticket-detail',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TicketStatusBadgeComponent, TicketTimelineComponent],
  template: `
    <div class="space-y-6">
      <a routerLink="/tickets" class="text-sm text-elva-600 hover:underline">← Back to tickets</a>

      @if (error()) {
        <div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ error() }}</div>
      }

      @if (ticket(); as t) {
        <div class="card space-y-4">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p class="font-mono text-sm font-medium text-elva-700">{{ t.ticketNumber }}</p>
              <h2 class="mt-1 text-2xl font-bold text-slate-900">{{ t.subject }}</h2>
            </div>
            <app-ticket-status-badge [status]="t.status" />
          </div>

          <div class="grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p class="text-sm text-slate-500">Merchant</p>
              <p class="font-medium text-slate-900">{{ merchantName(t) }}</p>
              <p class="text-xs text-slate-400">{{ merchantEmail(t) }}</p>
            </div>
            <div>
              <p class="text-sm text-slate-500">Application</p>
              <p class="font-medium text-slate-900">{{ t.applicationCode }}</p>
            </div>
            <div>
              <p class="text-sm text-slate-500">Module</p>
              <p class="font-medium text-slate-900">{{ refName(t.moduleId) }}</p>
            </div>
            <div>
              <p class="text-sm text-slate-500">Assigned Team</p>
              <p class="font-medium text-slate-900">{{ refName(t.teamId) }}</p>
            </div>
            <div>
              <p class="text-sm text-slate-500">Assigned Agent</p>
              <p class="font-medium text-slate-900">{{ assigneeLabel(t) }}</p>
            </div>
            <div>
              <p class="text-sm text-slate-500">Created</p>
              <p class="font-medium text-slate-900">{{ t.createdAt | date: 'medium' }}</p>
            </div>
            <div>
              <p class="text-sm text-slate-500">Updated</p>
              <p class="font-medium text-slate-900">{{ t.updatedAt | date: 'medium' }}</p>
            </div>
          </div>
        </div>

        <div class="grid gap-6 lg:grid-cols-3">
          <div class="space-y-6 lg:col-span-2">
            <div class="card">
              <h3 class="text-lg font-semibold text-slate-900">Timeline</h3>
              <div class="mt-4">
                <app-ticket-timeline [items]="timeline()" />
              </div>
            </div>

            <div class="card space-y-4">
              <h3 class="text-lg font-semibold text-slate-900">Reply to Merchant</h3>
              <form [formGroup]="replyForm" (ngSubmit)="sendReply()" class="space-y-3">
                <textarea class="form-input" rows="4" formControlName="message" placeholder="Reply visible to merchant..."></textarea>
                <button type="submit" class="btn-primary" [disabled]="replyForm.invalid || sendingReply()">
                  {{ sendingReply() ? 'Sending...' : 'Send Reply' }}
                </button>
              </form>
            </div>

            <div class="card space-y-4">
              <h3 class="text-lg font-semibold text-slate-900">Internal Note</h3>
              <p class="text-xs text-slate-500">Visible to agents only — not shown to merchant</p>
              <form [formGroup]="noteForm" (ngSubmit)="sendNote()" class="space-y-3">
                <textarea class="form-input" rows="3" formControlName="message" placeholder="Internal note..."></textarea>
                <button type="submit" class="btn-secondary" [disabled]="noteForm.invalid || sendingNote()">
                  {{ sendingNote() ? 'Saving...' : 'Add Internal Note' }}
                </button>
              </form>
            </div>

            <div class="card space-y-4">
              <h3 class="text-lg font-semibold text-slate-900">Upload Attachment</h3>
              <input type="file" class="form-input" (change)="onFileSelected($event)" />
              @if (selectedFile()) {
                <button type="button" class="btn-secondary" (click)="uploadFile()" [disabled]="uploading()">
                  {{ uploading() ? 'Uploading...' : 'Upload ' + selectedFile()!.name }}
                </button>
              }
            </div>
          </div>

          <div class="space-y-6">
            <div class="card space-y-4">
              <h3 class="text-lg font-semibold text-slate-900">Status</h3>
              <select class="form-input" [value]="t.status" (change)="onStatusChange($event)">
                @for (status of statuses; track status) {
                  <option [value]="status">{{ status.replace('_', ' ') }}</option>
                }
              </select>
            </div>

            @if (showCloseDialog()) {
              <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
                <div class="card w-full max-w-lg space-y-4 shadow-xl">
                  <h3 class="text-lg font-semibold text-slate-900">Close ticket</h3>
                  <p class="text-sm text-slate-600">
                    Add closure notes before closing this ticket. The merchant will receive these notes in the closure email.
                  </p>
                  <form [formGroup]="closeForm" (ngSubmit)="confirmClose()" class="space-y-4">
                    <textarea
                      class="form-input"
                      rows="5"
                      formControlName="closureNotes"
                      placeholder="Describe how the issue was resolved or why the ticket is being closed..."
                    ></textarea>
                    @if (closeForm.controls.closureNotes.touched && closeForm.controls.closureNotes.invalid) {
                      <p class="text-sm text-red-600">Closure notes are required.</p>
                    }
                    <div class="flex justify-end gap-3">
                      <button type="button" class="btn-secondary" (click)="cancelClose()">Cancel</button>
                      <button type="submit" class="btn-primary" [disabled]="closeForm.invalid || closingTicket()">
                        {{ closingTicket() ? 'Closing...' : 'Close ticket' }}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            }

            <div class="card space-y-4">
              <h3 class="text-lg font-semibold text-slate-900">Transfer Team</h3>
              <select class="form-input" [value]="currentTeamId(t)" (change)="onTransfer($event)">
                @for (team of teams(); track team._id) {
                  <option [value]="team._id">{{ team.name }}</option>
                }
              </select>
            </div>

            @if (auth.canAssign()) {
              <div class="card space-y-4">
                <h3 class="text-lg font-semibold text-slate-900">Assign To</h3>
                <select class="form-input" [value]="currentAssigneeId(t)" (change)="onAssign($event)">
                  @if (!currentAssigneeId(t)) {
                    <option value="" disabled selected>Select agent...</option>
                  }
                  @for (agent of assignableAgents(); track agent._id) {
                    <option [value]="agent._id">{{ agent.firstName }} {{ agent.lastName }}</option>
                  }
                </select>
              </div>
            }
          </div>
        </div>
      } @else if (!error()) {
        <div class="card text-center text-slate-500">Loading ticket...</div>
      }
    </div>
  `
})
export class TicketDetailComponent implements OnInit {
  private readonly api = inject(TicketService);
  private readonly teamApi = inject(TeamService);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  readonly auth = inject(AuthService);

  readonly statuses: TicketStatus[] = [
    'OPEN',
    'IN_PROGRESS',
    'WAITING_FOR_CUSTOMER',
    'RESOLVED',
    'CLOSED'
  ];

  readonly ticket = signal<Ticket | null>(null);
  readonly timeline = signal<TimelineItem[]>([]);
  readonly teams = signal<Team[]>([]);
  readonly assignableAgents = signal<TicketAssignee[]>([]);
  readonly error = signal('');
  readonly sendingReply = signal(false);
  readonly sendingNote = signal(false);
  readonly uploading = signal(false);
  readonly selectedFile = signal<File | null>(null);
  readonly showCloseDialog = signal(false);
  readonly closingTicket = signal(false);

  readonly replyForm = this.fb.nonNullable.group({
    message: ['', [Validators.required, Validators.maxLength(5000)]]
  });

  readonly noteForm = this.fb.nonNullable.group({
    message: ['', [Validators.required, Validators.maxLength(5000)]]
  });

  readonly closeForm = this.fb.nonNullable.group({
    closureNotes: ['', [Validators.required, Validators.maxLength(5000)]]
  });

  private ticketId = '';

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    this.ticketId = id;

    this.teamApi.list().subscribe((res) => this.teams.set(res.data));
    this.loadTicket();
    this.loadTimeline();
    if (this.auth.canAssign()) {
      this.loadAssignableAgents();
    }
  }

  loadAssignableAgents(): void {
    this.api.getAssignableAgents(this.ticketId).subscribe({
      next: (res) => this.assignableAgents.set(res.data)
    });
  }

  loadTicket(): void {
    this.api.getById(this.ticketId).subscribe({
      next: (res) => this.ticket.set(res.data),
      error: (err: HttpErrorResponse) => this.error.set(err.error?.message || 'Ticket not found')
    });
  }

  loadTimeline(): void {
    this.api.getTimeline(this.ticketId).subscribe({
      next: (res) => this.timeline.set(res.data)
    });
  }

  sendReply(): void {
    if (this.replyForm.invalid) return;
    this.sendingReply.set(true);
    this.api.reply(this.ticketId, this.replyForm.controls.message.value).subscribe({
      next: () => {
        this.replyForm.reset();
        this.loadTimeline();
        this.sendingReply.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(err.error?.message || 'Failed to send reply');
        this.sendingReply.set(false);
      }
    });
  }

  sendNote(): void {
    if (this.noteForm.invalid) return;
    this.sendingNote.set(true);
    this.api.addInternalNote(this.ticketId, this.noteForm.controls.message.value).subscribe({
      next: () => {
        this.noteForm.reset();
        this.loadTimeline();
        this.sendingNote.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(err.error?.message || 'Failed to add note');
        this.sendingNote.set(false);
      }
    });
  }

  onStatusChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const status = select.value as TicketStatus;
    const current = this.ticket()?.status;

    if (status === 'CLOSED') {
      if (current) {
        select.value = current;
      }
      this.closeForm.reset();
      this.showCloseDialog.set(true);
      return;
    }

    this.applyStatus(status);
  }

  confirmClose(): void {
    if (this.closeForm.invalid) {
      this.closeForm.markAllAsTouched();
      return;
    }

    this.closingTicket.set(true);
    this.api
      .updateStatus(this.ticketId, 'CLOSED', this.closeForm.controls.closureNotes.value)
      .subscribe({
        next: (res) => {
          this.ticket.set(res.data);
          this.showCloseDialog.set(false);
          this.closeForm.reset();
          this.loadTimeline();
          this.closingTicket.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.error.set(err.error?.message || 'Failed to close ticket');
          this.closingTicket.set(false);
        }
      });
  }

  cancelClose(): void {
    this.showCloseDialog.set(false);
    this.closeForm.reset();
  }

  private applyStatus(status: TicketStatus): void {
    this.api.updateStatus(this.ticketId, status).subscribe({
      next: (res) => {
        this.ticket.set(res.data);
        this.loadTimeline();
      },
      error: (err: HttpErrorResponse) => this.error.set(err.error?.message || 'Status update failed')
    });
  }

  onTransfer(event: Event): void {
    const teamId = (event.target as HTMLSelectElement).value;
    this.api.transfer(this.ticketId, teamId).subscribe({
      next: (res) => {
        this.ticket.set(res.data);
        this.loadTimeline();
        if (this.auth.canAssign()) {
          this.loadAssignableAgents();
        }
      },
      error: (err: HttpErrorResponse) => this.error.set(err.error?.message || 'Transfer failed')
    });
  }

  onAssign(event: Event): void {
    const userId = (event.target as HTMLSelectElement).value;
    if (!userId) return;

    this.api.assign(this.ticketId, userId).subscribe({
      next: (res) => {
        this.ticket.set(res.data);
        this.loadTimeline();
      },
      error: (err: HttpErrorResponse) => this.error.set(err.error?.message || 'Assignment failed')
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile.set(input.files?.[0] || null);
  }

  uploadFile(): void {
    const file = this.selectedFile();
    if (!file) return;

    this.uploading.set(true);
    this.api.uploadAttachment(this.ticketId, file).subscribe({
      next: () => {
        this.selectedFile.set(null);
        this.loadTimeline();
        this.uploading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(err.error?.message || 'Upload failed');
        this.uploading.set(false);
      }
    });
  }

  refName(ref: Ticket['moduleId']): string {
    return typeof ref === 'string' ? ref : ref.name;
  }

  merchantName(t: Ticket): string {
    const m = t.merchantId;
    return typeof m === 'string' ? m : m.merchantName;
  }

  merchantEmail(t: Ticket): string {
    const m = t.merchantId;
    return typeof m === 'string' ? '' : m.email;
  }

  currentTeamId(t: Ticket): string {
    const team = t.teamId;
    return typeof team === 'string' ? team : team._id;
  }

  currentAssigneeId(t: Ticket): string {
    if (!t.assignedTo) return '';
    return typeof t.assignedTo === 'string' ? t.assignedTo : t.assignedTo._id;
  }

  assigneeLabel(t: Ticket): string {
    if (!t.assignedTo) return 'Unassigned';
    const a = t.assignedTo;
    return typeof a === 'string' ? a : `${a.firstName} ${a.lastName}`;
  }
}
