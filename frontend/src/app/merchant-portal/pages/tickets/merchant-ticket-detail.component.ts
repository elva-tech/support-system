import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { MerchantTicketService } from '../../services/merchant-ticket.service';
import { Ticket } from '../../../core/models/ticket.model';
import { TimelineItem } from '../../../core/models/conversation.model';
import { TicketStatusBadgeComponent } from '../../../shared/components/ticket-status-badge/ticket-status-badge.component';
import { TicketTimelineComponent } from '../../../shared/components/ticket-timeline/ticket-timeline.component';

@Component({
  selector: 'app-merchant-ticket-detail',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TicketStatusBadgeComponent, TicketTimelineComponent],
  template: `
    <div class="space-y-6">
      <a routerLink="/merchant/tickets" class="text-sm text-elva-brand hover:underline">← Back to tickets</a>

      @if (error()) {
        <div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ error() }}</div>
      }

      @if (ticket(); as t) {
        <div class="card space-y-4">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p class="font-mono text-sm font-medium text-elva-800">{{ t.ticketNumber }}</p>
              <h2 class="mt-1 text-2xl font-bold text-slate-900">{{ t.subject }}</h2>
            </div>
            <app-ticket-status-badge [status]="t.status" />
          </div>

          <div class="grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
            <div>
              <p class="text-sm text-slate-500">Module</p>
              <p class="font-medium text-slate-900">{{ moduleLabel(t) }}</p>
            </div>
            <div>
              <p class="text-sm text-slate-500">Created</p>
              <p class="font-medium text-slate-900">{{ t.createdAt | date: 'medium' }}</p>
            </div>
            <div>
              <p class="text-sm text-slate-500">Application</p>
              <p class="font-medium text-slate-900">{{ t.applicationCode }}</p>
            </div>
            <div>
              <p class="text-sm text-slate-500">Assigned Team</p>
              <p class="font-medium text-slate-900">{{ teamLabel(t) }}</p>
            </div>
          </div>
        </div>

        <div class="card">
          <h3 class="text-lg font-semibold text-slate-900">Timeline</h3>
          <div class="mt-4">
            <app-ticket-timeline [items]="timeline()" />
          </div>
        </div>

        <div class="card space-y-4">
          <h3 class="text-lg font-semibold text-slate-900">Reply</h3>
          <form [formGroup]="replyForm" (ngSubmit)="sendReply()" class="space-y-3">
            <textarea class="form-input" rows="4" formControlName="message" placeholder="Type your reply..."></textarea>
            <button type="submit" class="btn-primary" [disabled]="replyForm.invalid || sendingReply()">
              {{ sendingReply() ? 'Sending...' : 'Send Reply' }}
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
      } @else if (!error()) {
        <div class="card text-center text-slate-500">Loading ticket...</div>
      }
    </div>
  `
})
export class MerchantTicketDetailComponent implements OnInit {
  private readonly api = inject(MerchantTicketService);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);

  readonly ticket = signal<Ticket | null>(null);
  readonly timeline = signal<TimelineItem[]>([]);
  readonly error = signal('');
  readonly sendingReply = signal(false);
  readonly uploading = signal(false);
  readonly selectedFile = signal<File | null>(null);

  readonly replyForm = this.fb.nonNullable.group({
    message: ['', [Validators.required, Validators.maxLength(5000)]]
  });

  private ticketId = '';

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    this.ticketId = id;
    this.loadTicket();
    this.loadTimeline();
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

  moduleLabel(ticket: Ticket): string {
    const mod = ticket.moduleId;
    return typeof mod === 'string' ? mod : mod.name;
  }

  teamLabel(ticket: Ticket): string {
    const team = ticket.teamId;
    return typeof team === 'string' ? team : team.name;
  }
}
