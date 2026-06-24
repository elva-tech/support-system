import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (open) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
        <div class="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
          <h3 class="text-lg font-semibold text-slate-900">{{ title }}</h3>
          <p class="mt-2 text-sm text-slate-600">{{ message }}</p>
          <div class="mt-6 flex justify-end gap-3">
            <button type="button" class="btn-secondary" (click)="cancelled.emit()">Cancel</button>
            <button type="button" class="btn-danger" (click)="confirmed.emit()">Delete</button>
          </div>
        </div>
      </div>
    }
  `
})
export class ConfirmDialogComponent {
  @Input() open = false;
  @Input() title = 'Confirm deletion';
  @Input() message = 'Are you sure? This action cannot be undone.';
  @Output() confirmed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();
}
