import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  PlatformSupportApiService,
  PlatformSupportContext,
  PlatformSupportTicket,
  PlatformSupportTimelineItem
} from '../../core/services/platform-support-api.service';
import { PortalDocumentTitleService } from '../../core/portal/portal-document-title.service';
import { formatApiError } from '../../shared/utils/api-error.util';
import { formatSlaDuration } from '../../shared/utils/sla-duration.util';

@Component({
  selector: 'app-tenant-platform-support',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="mx-auto max-w-3xl space-y-6">
      <div>
        <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Contact ELVA Support</p>
        <h1 class="text-2xl font-bold text-slate-900">ELVA Support</h1>
        <p class="mt-1 text-sm text-slate-500">
          We're here to help. If you are experiencing an issue with your workspace, provide the details
          below and our support team will assist you.
        </p>
        <p class="mt-2 text-xs text-slate-400">Powered by ELVA Support</p>
      </div>

      <div class="flex gap-2 border-b border-slate-200 pb-2 text-sm">
        <button
          type="button"
          class="rounded-lg px-3 py-1.5 font-medium"
          [class.bg-[var(--tenant-primary-color)]]="tab() === 'raise'"
          [class.text-[var(--tenant-primary-contrast,#fff)]]="tab() === 'raise'"
          [class.text-slate-600]="tab() !== 'raise'"
          (click)="tab.set('raise'); created.set(null)"
        >
          Raise Support Request
        </button>
        <button
          type="button"
          class="rounded-lg px-3 py-1.5 font-medium"
          [class.bg-[var(--tenant-primary-color)]]="tab() === 'mine'"
          [class.text-[var(--tenant-primary-contrast,#fff)]]="tab() === 'mine'"
          [class.text-slate-600]="tab() !== 'mine'"
          (click)="showMine()"
        >
          My Requests
        </button>
      </div>

      @if (error()) {
        <div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ error() }}</div>
      }

      @if (tab() === 'raise') {
        @if (created(); as c) {
          <div class="card space-y-3">
            <h2 class="text-lg font-semibold text-emerald-800">Support ticket created successfully</h2>
            <p class="text-sm text-slate-700">
              Ticket ID: <strong>{{ c.ticketNumber }}</strong>
            </p>
            <p class="text-sm text-slate-600">Our support team has been notified.</p>
            <div class="flex flex-wrap gap-3">
              <button type="button" class="btn-primary" (click)="openDetail(c.id)">View ticket</button>
              <button type="button" class="btn-secondary" (click)="showMine()">View My Support Requests</button>
            </div>
          </div>
        } @else if (ctx(); as context) {
          <div class="card space-y-3">
            <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">Support request context</h2>
            <dl class="grid gap-2 text-sm sm:grid-cols-2">
              <div><dt class="text-slate-500">Organization</dt><dd class="font-medium">{{ context.organizationName }}</dd></div>
              <div><dt class="text-slate-500">Workspace</dt><dd class="font-medium">{{ context.workspace }}</dd></div>
              <div><dt class="text-slate-500">Raised by</dt><dd class="font-medium">{{ context.raisedByName }}</dd></div>
              <div><dt class="text-slate-500">Email</dt><dd class="font-medium">{{ context.email }}</dd></div>
              <div><dt class="text-slate-500">Role</dt><dd class="font-medium">{{ context.role }}</dd></div>
            </dl>
          </div>

          <form class="card space-y-4" [formGroup]="form" (ngSubmit)="submit()">
            <div>
              <label class="form-label">Category</label>
              <select class="form-input" formControlName="category">
                @for (c of context.categories; track c.code) {
                  <option [value]="c.code">{{ c.label }}</option>
                }
              </select>
            </div>
            <div>
              <label class="form-label">Priority</label>
              <select class="form-input" formControlName="priority">
                <option value="LOW">Low</option>
                <option value="MEDIUM">Normal</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Urgent</option>
              </select>
            </div>
            <div>
              <label class="form-label">Subject</label>
              <input class="form-input" formControlName="subject" />
            </div>
            <div>
              <label class="form-label">Description</label>
              <textarea class="form-input" rows="5" formControlName="description"></textarea>
            </div>
            <div>
              <label class="form-label">Attachments (optional)</label>
              <input type="file" class="form-input" multiple (change)="onFiles($event)" />
            </div>
            <button type="submit" class="btn-primary" [disabled]="form.invalid || saving()">
              {{ saving() ? 'Submitting…' : 'Raise Support Ticket' }}
            </button>
          </form>
        } @else {
          <p class="text-sm text-slate-500">Loading support context…</p>
        }
      }

      @if (tab() === 'mine') {
        <div class="card overflow-x-auto">
          <table class="min-w-full text-left text-sm">
            <thead>
              <tr class="border-b text-slate-500">
                <th class="py-2 pr-3">Ticket</th>
                <th class="py-2 pr-3">Subject</th>
                <th class="py-2 pr-3">Status</th>
                <th class="py-2">Created</th>
              </tr>
            </thead>
            <tbody>
              @for (t of tickets(); track t.id) {
                <tr class="border-b border-slate-100 cursor-pointer hover:bg-slate-50" (click)="openDetail(t.id)">
                  <td class="py-2 pr-3 font-medium">{{ t.ticketNumber }}</td>
                  <td class="py-2 pr-3">{{ t.subject }}</td>
                  <td class="py-2 pr-3">{{ t.status }}</td>
                  <td class="py-2">{{ t.createdAt | date: 'short' }}</td>
                </tr>
              } @empty {
                <tr><td colspan="4" class="py-6 text-center text-slate-500">No support requests yet.</td></tr>
              }
            </tbody>
          </table>
        </div>
      }

      @if (tab() === 'detail' && detail(); as d) {
        <div class="space-y-4">
          <button type="button" class="text-sm hover:underline" [style.color]="'var(--tenant-primary-color)'" (click)="showMine()">
            ← Back to my requests
          </button>
          <div class="card space-y-2">
            <h2 class="text-lg font-semibold">{{ d.ticket.ticketNumber }} — {{ d.ticket.subject }}</h2>
            <p class="text-sm text-slate-600">{{ d.ticket.status }} · {{ d.ticket.priority }} · {{ d.ticket.categoryLabel || d.ticket.category }}</p>
            @if (d.ticket.sla?.currentCycle; as cycle) {
              <p class="text-xs text-slate-500">
                SLA response: {{ cycle.responseState }} ({{ formatDuration(cycle.responseTargetMinutes) }}) ·
                resolution: {{ cycle.resolutionState }} ({{ formatDuration(cycle.resolutionTargetMinutes) }})
              </p>
            }
          </div>
          <div class="card space-y-3">
            <h3 class="font-semibold">Conversation</h3>
            @for (item of d.timeline; track item.id) {
              <div class="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <p class="text-xs text-slate-500">{{ item.senderName }} · {{ item.createdAt | date: 'medium' }}</p>
                <p class="mt-1 whitespace-pre-wrap">{{ item.message }}</p>
              </div>
            }
            <form class="flex flex-col gap-2 sm:flex-row" [formGroup]="replyForm" (ngSubmit)="sendReply()">
              <input class="form-input flex-1" formControlName="message" placeholder="Reply to ELVA Support" />
              <button type="submit" class="btn-primary" [disabled]="replyForm.invalid || saving()">Send</button>
            </form>
            <input type="file" class="form-input" (change)="uploadDetail($event)" />
          </div>
        </div>
      }
    </div>
  `
})
export class TenantPlatformSupportComponent implements OnInit {
  private readonly api = inject(PlatformSupportApiService);
  private readonly fb = inject(FormBuilder);
  private readonly titles = inject(PortalDocumentTitleService);
  private readonly route = inject(ActivatedRoute);

  readonly tab = signal<'raise' | 'mine' | 'detail'>('raise');
  readonly ctx = signal<PlatformSupportContext | null>(null);
  readonly tickets = signal<PlatformSupportTicket[]>([]);
  readonly created = signal<PlatformSupportTicket | null>(null);
  readonly detail = signal<{
    ticket: PlatformSupportTicket;
    timeline: PlatformSupportTimelineItem[];
  } | null>(null);
  readonly error = signal('');
  readonly saving = signal(false);
  private pendingFiles: File[] = [];

  readonly form = this.fb.nonNullable.group({
    category: ['TECHNICAL_ISSUE', Validators.required],
    priority: ['MEDIUM'],
    subject: ['', [Validators.required, Validators.maxLength(200)]],
    description: ['', [Validators.required, Validators.maxLength(10000)]]
  });

  readonly replyForm = this.fb.nonNullable.group({
    message: ['', Validators.required]
  });

  ngOnInit(): void {
    this.titles.setPageSuffix('Contact ELVA Support');
    this.api.getContext().subscribe({
      next: (res) => {
        this.ctx.set(res.data);
        if (res.data.categories[0]) {
          this.form.patchValue({ category: res.data.categories[0].code });
        }
      },
      error: (err) => this.error.set(formatApiError(err))
    });
    const id = this.route.snapshot.queryParamMap.get('id');
    if (id) this.openDetail(id);
  }

  formatDuration(minutes?: number): string {
    return formatSlaDuration(minutes || 0);
  }

  onFiles(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.pendingFiles = Array.from(input.files || []);
  }

  submit(): void {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.error.set('');
    this.api.create(this.form.getRawValue()).subscribe({
      next: (res) => {
        const ticket = res.data;
        const uploads = this.pendingFiles.map(
          (f) =>
            new Promise<void>((resolve) => {
              this.api.upload(ticket.id, f).subscribe({ next: () => resolve(), error: () => resolve() });
            })
        );
        Promise.all(uploads).then(() => {
          this.created.set(ticket);
          this.pendingFiles = [];
          this.form.patchValue({ subject: '', description: '' });
          this.saving.set(false);
        });
      },
      error: (err) => {
        this.error.set(formatApiError(err, 'Unable to create support ticket'));
        this.saving.set(false);
      }
    });
  }

  showMine(): void {
    this.tab.set('mine');
    this.created.set(null);
    this.detail.set(null);
    this.api.listMine().subscribe({
      next: (res) => this.tickets.set(res.data || []),
      error: (err) => this.error.set(formatApiError(err))
    });
  }

  openDetail(id: string): void {
    this.tab.set('detail');
    this.api.timeline(id).subscribe({
      next: (res) => this.detail.set(res.data),
      error: (err) => this.error.set(formatApiError(err))
    });
  }

  sendReply(): void {
    const d = this.detail();
    if (!d || this.replyForm.invalid) return;
    this.saving.set(true);
    this.api.reply(d.ticket.id, this.replyForm.controls.message.value).subscribe({
      next: () => {
        this.replyForm.reset({ message: '' });
        this.openDetail(d.ticket.id);
        this.saving.set(false);
      },
      error: (err) => {
        this.error.set(formatApiError(err));
        this.saving.set(false);
      }
    });
  }

  uploadDetail(event: Event): void {
    const d = this.detail();
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!d || !file) return;
    this.api.upload(d.ticket.id, file).subscribe({
      next: () => this.openDetail(d.ticket.id),
      error: (err) => this.error.set(formatApiError(err, 'Attachment upload failed'))
    });
  }
}
