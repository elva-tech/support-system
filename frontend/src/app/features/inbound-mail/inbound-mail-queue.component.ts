import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { InboundMailQueueService } from '../../core/services/inbound-mail-queue.service';
import { TeamService } from '../../core/services/team.service';
import { ApplicationService } from '../../core/services/application.service';
import { ModuleService } from '../../core/services/module.service';
import { Application, AppModule, InboundMailQueueItem, Team } from '../../core/models';

@Component({
  selector: 'app-inbound-mail-queue',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="space-y-6">
      <div>
        <h2 class="text-2xl font-bold text-slate-900">Inbound Mail Queue</h2>
        <p class="text-sm text-slate-500">
          Emails from unknown senders to support@ — assign to a team or reject with a reason. The sender is emailed for both actions.
        </p>
      </div>

      @if (error()) {
        <div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ error() }}</div>
      }
      @if (successMessage()) {
        <div class="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {{ successMessage() }}
        </div>
      }

      <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table class="min-w-full divide-y divide-slate-200 text-sm">
          <thead class="bg-slate-50">
            <tr>
              <th class="px-4 py-3 text-left font-medium text-slate-600">Received</th>
              <th class="px-4 py-3 text-left font-medium text-slate-600">From</th>
              <th class="px-4 py-3 text-left font-medium text-slate-600">Subject</th>
              <th class="px-4 py-3 text-left font-medium text-slate-600">Attachments</th>
              <th class="px-4 py-3 text-right font-medium text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            @for (item of items(); track item._id) {
              <tr class="hover:bg-slate-50">
                <td class="px-4 py-3 text-slate-600">{{ item.createdAt | date: 'short' }}</td>
                <td class="px-4 py-3">
                  <div class="font-medium text-slate-900">{{ item.senderName || item.senderEmail }}</div>
                  <div class="text-xs text-slate-500">{{ item.senderEmail }}</div>
                </td>
                <td class="px-4 py-3">{{ item.subject }}</td>
                <td class="px-4 py-3">{{ item.attachments.length || '—' }}</td>
                <td class="px-4 py-3 text-right">
                  <button type="button" class="text-elva-600 hover:underline" (click)="openReview(item)">
                    Review
                  </button>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="5" class="px-4 py-8 text-center text-slate-500">
                  No pending inbound emails from unknown senders.
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    @if (activeItem()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
        <div class="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
          <h3 class="text-lg font-semibold">Review inbound email</h3>
          <p class="mt-1 text-sm text-slate-500">{{ activeItem()!.senderEmail }}</p>

          <div class="mt-4 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
            <div><span class="font-medium text-slate-700">Subject:</span> {{ activeItem()!.subject }}</div>
            <div class="whitespace-pre-wrap text-slate-800">{{ activeItem()!.body || '(No message body)' }}</div>
            @if (activeItem()!.attachments.length) {
              <div>
                <p class="font-medium text-slate-700">Attachments</p>
                <ul class="mt-1 space-y-1">
                  @for (att of activeItem()!.attachments; track att._id) {
                    <li>
                      <button
                        type="button"
                        class="text-elva-600 hover:underline"
                        (click)="downloadAttachment(activeItem()!._id, att._id, att.fileName)"
                      >
                        {{ att.fileName }} ({{ formatSize(att.fileSize) }})
                      </button>
                    </li>
                  }
                </ul>
              </div>
            }
          </div>

          <div class="mt-6 flex gap-2 border-b border-slate-200">
            <button
              type="button"
              class="px-4 py-2 text-sm font-medium"
              [class.border-b-2]="mode() === 'assign'"
              [class.border-elva-brand]="mode() === 'assign'"
              (click)="mode.set('assign')"
            >
              Assign to team
            </button>
            <button
              type="button"
              class="px-4 py-2 text-sm font-medium"
              [class.border-b-2]="mode() === 'reject'"
              [class.border-red-500]="mode() === 'reject'"
              (click)="mode.set('reject')"
            >
              Reject
            </button>
          </div>

          @if (mode() === 'assign') {
            <form [formGroup]="assignForm" (ngSubmit)="submitAssign()" class="mt-4 space-y-4">
              <div>
                <label class="form-label">Application</label>
                <select class="form-input" formControlName="applicationId" (change)="onApplicationChange()">
                  <option value="">Select application</option>
                  @for (app of applications(); track app._id) {
                    <option [value]="app._id">{{ app.name }} ({{ app.code }})</option>
                  }
                </select>
              </div>
              <div>
                <label class="form-label">Module</label>
                <select class="form-input" formControlName="moduleId">
                  <option value="">Select module</option>
                  @for (mod of filteredModules(); track mod._id) {
                    <option [value]="mod._id">{{ mod.name }} ({{ mod.code }})</option>
                  }
                </select>
              </div>
              <div>
                <label class="form-label">Team</label>
                <select class="form-input" formControlName="teamId">
                  <option value="">Select team</option>
                  @for (team of filteredTeams(); track team._id) {
                    <option [value]="team._id">{{ team.name }}</option>
                  }
                </select>
              </div>
              <div>
                <label class="form-label">Note to sender (optional)</label>
                <textarea class="form-input" rows="2" formControlName="notes" placeholder="Included in the acceptance email"></textarea>
              </div>
              <div class="flex justify-end gap-3">
                <button type="button" class="btn-secondary" (click)="closeReview()">Cancel</button>
                <button type="submit" class="btn-primary" [disabled]="assignForm.invalid || saving()">
                  {{ saving() ? 'Assigning...' : 'Assign & notify sender' }}
                </button>
              </div>
            </form>
          } @else {
            <form [formGroup]="rejectForm" (ngSubmit)="submitReject()" class="mt-4 space-y-4">
              <div>
                <label class="form-label">Rejection reason</label>
                <textarea
                  class="form-input"
                  rows="3"
                  formControlName="reason"
                  placeholder="This reason is emailed to the sender"
                ></textarea>
              </div>
              <div class="flex justify-end gap-3">
                <button type="button" class="btn-secondary" (click)="closeReview()">Cancel</button>
                <button type="submit" class="btn-primary bg-red-600 hover:bg-red-700" [disabled]="rejectForm.invalid || saving()">
                  {{ saving() ? 'Rejecting...' : 'Reject & notify sender' }}
                </button>
              </div>
            </form>
          }

          @if (assignedTicketNumber()) {
            <p class="mt-4 text-sm text-green-700">
              Ticket created:
              <a [routerLink]="['/tickets', assignedTicketId()]" class="font-medium underline" (click)="closeReview()">
                {{ assignedTicketNumber() }}
              </a>
            </p>
          }
        </div>
      </div>
    }
  `
})
export class InboundMailQueueComponent implements OnInit {
  private readonly api = inject(InboundMailQueueService);
  private readonly teamApi = inject(TeamService);
  private readonly appApi = inject(ApplicationService);
  private readonly moduleApi = inject(ModuleService);
  private readonly fb = inject(FormBuilder);

  readonly items = signal<InboundMailQueueItem[]>([]);
  readonly applications = signal<Application[]>([]);
  readonly modules = signal<AppModule[]>([]);
  readonly teams = signal<Team[]>([]);
  readonly activeItem = signal<InboundMailQueueItem | null>(null);
  readonly mode = signal<'assign' | 'reject'>('assign');
  readonly error = signal('');
  readonly successMessage = signal('');
  readonly saving = signal(false);
  readonly assignedTicketNumber = signal('');
  readonly assignedTicketId = signal('');

  readonly assignForm = this.fb.group({
    applicationId: ['', Validators.required],
    moduleId: ['', Validators.required],
    teamId: ['', Validators.required],
    notes: ['']
  });

  readonly rejectForm = this.fb.group({
    reason: ['', Validators.required]
  });

  ngOnInit(): void {
    this.loadQueue();
    this.appApi.list().subscribe({ next: (res) => this.applications.set(res.data) });
    this.moduleApi.list().subscribe({ next: (res) => this.modules.set(res.data) });
    this.teamApi.list().subscribe({ next: (res) => this.teams.set(res.data) });
  }

  filteredModules(): AppModule[] {
    const appId = this.assignForm.value.applicationId;
    if (!appId) return [];
    return this.modules().filter((mod) => this.refId(mod.applicationId) === appId);
  }

  filteredTeams(): Team[] {
    const appId = this.assignForm.value.applicationId;
    if (!appId) return this.teams();
    return this.teams().filter((team) => this.refId(team.applicationId) === appId);
  }

  loadQueue(): void {
    this.api.list({ status: 'PENDING' }).subscribe({
      next: (res) => this.items.set(res.data),
      error: (err: HttpErrorResponse) => this.error.set(err.error?.message || 'Failed to load inbound mail queue')
    });
  }

  openReview(item: InboundMailQueueItem): void {
    this.activeItem.set(item);
    this.mode.set('assign');
    this.assignedTicketNumber.set('');
    this.assignedTicketId.set('');
    this.assignForm.reset();
    this.rejectForm.reset();
  }

  closeReview(): void {
    this.activeItem.set(null);
    this.loadQueue();
  }

  onApplicationChange(): void {
    this.assignForm.patchValue({ moduleId: '', teamId: '' });
  }

  submitAssign(): void {
    const item = this.activeItem();
    if (!item || this.assignForm.invalid) return;

    this.saving.set(true);
    this.error.set('');

    const value = this.assignForm.getRawValue();
    this.api
      .assign(item._id, {
        applicationId: value.applicationId!,
        moduleId: value.moduleId!,
        teamId: value.teamId!,
        notes: value.notes || undefined
      })
      .subscribe({
        next: (res) => {
          this.saving.set(false);
          this.successMessage.set('Assigned — ticket created and sender notified by email.');
          const ticket = res.data.ticketId;
          if (ticket && typeof ticket === 'object') {
            this.assignedTicketNumber.set(ticket.ticketNumber);
            this.assignedTicketId.set(ticket._id);
          }
          this.closeReview();
        },
        error: (err: HttpErrorResponse) => {
          this.saving.set(false);
          this.error.set(err.error?.message || 'Failed to assign inbound mail');
        }
      });
  }

  submitReject(): void {
    const item = this.activeItem();
    if (!item || this.rejectForm.invalid) return;

    this.saving.set(true);
    this.error.set('');

    this.api.reject(item._id, this.rejectForm.value.reason!).subscribe({
      next: () => {
        this.saving.set(false);
        this.successMessage.set('Rejected — sender has been notified by email.');
        this.closeReview();
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(err.error?.message || 'Failed to reject inbound mail');
      }
    });
  }

  downloadAttachment(queueItemId: string, attachmentId: string, fileName: string): void {
    this.api.triggerDownload(queueItemId, attachmentId, fileName);
  }

  formatSize(bytes: number): string {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  private refId(value: string | { _id: string }): string {
    return typeof value === 'string' ? value : value._id;
  }
}
