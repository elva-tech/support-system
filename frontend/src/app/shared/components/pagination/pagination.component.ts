import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PaginationMeta } from '../../../core/models';

@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (pagination.total > 0) {
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p class="text-sm text-slate-500">
          Showing {{ rangeStart }}–{{ rangeEnd }} of {{ pagination.total }} tickets
        </p>

        <div class="flex items-center gap-2">
          <label class="text-sm text-slate-500">
            Per page
            <select
              class="form-input ml-2 inline-block w-auto py-1"
              [value]="pagination.limit"
              (change)="onLimitChange($event)"
            >
              @for (size of pageSizes; track size) {
                <option [value]="size">{{ size }}</option>
              }
            </select>
          </label>

          <button
            type="button"
            class="btn-secondary !px-3 !py-1"
            [disabled]="pagination.page <= 1"
            (click)="changePage(pagination.page - 1)"
          >
            Previous
          </button>
          <span class="text-sm text-slate-600">Page {{ pagination.page }} of {{ pagination.totalPages }}</span>
          <button
            type="button"
            class="btn-secondary !px-3 !py-1"
            [disabled]="pagination.page >= pagination.totalPages"
            (click)="changePage(pagination.page + 1)"
          >
            Next
          </button>
        </div>
      </div>
    }
  `
})
export class PaginationComponent {
  @Input({ required: true }) pagination!: PaginationMeta;
  @Output() pageChange = new EventEmitter<number>();
  @Output() limitChange = new EventEmitter<number>();

  readonly pageSizes = [10, 20, 50];

  get rangeStart(): number {
    return (this.pagination.page - 1) * this.pagination.limit + 1;
  }

  get rangeEnd(): number {
    return Math.min(this.pagination.page * this.pagination.limit, this.pagination.total);
  }

  changePage(page: number): void {
    if (page >= 1 && page <= this.pagination.totalPages) {
      this.pageChange.emit(page);
    }
  }

  onLimitChange(event: Event): void {
    const limit = parseInt((event.target as HTMLSelectElement).value, 10);
    this.limitChange.emit(limit);
  }
}
