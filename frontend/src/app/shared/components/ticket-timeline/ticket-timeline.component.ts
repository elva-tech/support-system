import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimelineItem } from '../../../core/models/conversation.model';
import { AttachmentService } from '../../../core/services/attachment.service';

@Component({
  selector: 'app-ticket-timeline',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-4">
      @for (item of items; track item._id) {
        <div
          class="rounded-lg border p-4"
          [ngClass]="{
            'border-slate-200 bg-white': item.type === 'MESSAGE',
            'border-amber-200 bg-amber-50': item.type === 'INTERNAL_NOTE',
            'border-slate-200 bg-slate-50': item.type === 'SYSTEM',
            'border-blue-200 bg-blue-50': item.type === 'ATTACHMENT'
          }"
        >
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <span class="text-sm font-semibold text-slate-900">{{ item.senderName }}</span>
              <span class="badge bg-slate-100 text-slate-600">{{ typeLabel(item) }}</span>
            </div>
            <span class="text-xs text-slate-500">{{ item.createdAt | date: 'medium' }}</span>
          </div>
          <p class="mt-2 whitespace-pre-wrap text-sm text-slate-800">{{ item.message }}</p>

          @if (item.attachments?.length) {
            <div class="mt-3 space-y-2">
              @for (att of item.attachments; track att._id) {
                <button
                  type="button"
                  class="flex w-full items-center gap-2 rounded border border-slate-200 bg-white px-3 py-2 text-left text-sm text-blue-600 hover:underline"
                  (click)="download(att._id, att.fileName)"
                >
                  📎 {{ att.fileName }} ({{ formatSize(att.fileSize) }})
                </button>
              }
            </div>
          }

          @if (item.attachment) {
            <div class="mt-3">
              <button
                type="button"
                class="flex w-full items-center gap-2 rounded border border-slate-200 bg-white px-3 py-2 text-left text-sm text-blue-600 hover:underline"
                (click)="download(item.attachment!._id, item.attachment!.fileName)"
              >
                📎 {{ item.attachment.fileName }} ({{ formatSize(item.attachment.fileSize) }})
              </button>
            </div>
          }
        </div>
      } @empty {
        <p class="text-center text-sm text-slate-500">No timeline activity yet.</p>
      }
    </div>
  `
})
export class TicketTimelineComponent {
  private readonly attachments = inject(AttachmentService);

  @Input({ required: true }) items: TimelineItem[] = [];

  typeLabel(item: TimelineItem): string {
    switch (item.type) {
      case 'INTERNAL_NOTE':
        return 'Internal Note';
      case 'SYSTEM':
        return 'System';
      case 'ATTACHMENT':
        return 'Attachment';
      default:
        return item.senderType === 'MERCHANT' ? 'Merchant' : 'Agent';
    }
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  download(attachmentId: string, fileName: string): void {
    this.attachments.triggerDownload(attachmentId, fileName);
  }
}
