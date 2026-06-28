import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { concatMap, from, last, of, switchMap } from 'rxjs';
import { MerchantTicketService } from '../../services/merchant-ticket.service';
import { MerchantModuleOption } from '../../../core/models/ticket.model';

const MAX_ATTACHMENTS = 5;
const MAX_FILE_MB = 10;

@Component({
  selector: 'app-merchant-create-ticket',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="space-y-6">
      <div>
        <h2 class="text-2xl font-bold text-slate-900">Create Ticket</h2>
        <p class="text-sm text-slate-500">Submit a support request for your application</p>
      </div>

      @if (error()) {
        <div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ error() }}</div>
      }

      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="card max-w-2xl space-y-4">
        <div>
          <label class="form-label">Module</label>
          <select class="form-input" formControlName="moduleId">
            <option value="">Select a module</option>
            @for (mod of modules(); track mod._id) {
              <option [value]="mod._id">{{ mod.name }} ({{ mod.code }})</option>
            }
          </select>
        </div>
        <div>
          <label class="form-label">Subject</label>
          <input class="form-input" formControlName="subject" maxlength="200" />
        </div>
        <div>
          <label class="form-label">Description</label>
          <textarea class="form-input" rows="6" formControlName="description" maxlength="5000"></textarea>
        </div>
        <div>
          <label class="form-label">Attachments (optional)</label>
          <input
            type="file"
            class="form-input"
            multiple
            accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.txt,.csv,.doc,.docx,.xls,.xlsx"
            (change)="onFilesSelected($event)"
          />
          <p class="mt-1 text-xs text-slate-500">
            Up to {{ maxAttachments }} files, {{ maxFileMb }}MB each — images, PDF, Word, Excel, or text.
          </p>
          @if (selectedFiles().length) {
            <ul class="mt-2 space-y-1 text-sm text-slate-700">
              @for (file of selectedFiles(); track file.name + file.size) {
                <li class="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-2">
                  <span class="truncate">{{ file.name }}</span>
                  <button type="button" class="text-xs text-red-600 hover:underline" (click)="removeFile(file)">
                    Remove
                  </button>
                </li>
              }
            </ul>
          }
        </div>
        <div class="flex gap-3 pt-2">
          <button type="submit" class="btn-primary" [disabled]="form.invalid || saving()">
            {{ saving() ? 'Submitting...' : 'Submit Ticket' }}
          </button>
          <a routerLink="/merchant/tickets" class="btn-secondary">Cancel</a>
        </div>
      </form>
    </div>
  `
})
export class MerchantCreateTicketComponent implements OnInit {
  private readonly api = inject(MerchantTicketService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  readonly maxAttachments = MAX_ATTACHMENTS;
  readonly maxFileMb = MAX_FILE_MB;

  readonly modules = signal<MerchantModuleOption[]>([]);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly selectedFiles = signal<File[]>([]);

  readonly form = this.fb.nonNullable.group({
    moduleId: ['', Validators.required],
    subject: ['', [Validators.required, Validators.maxLength(200)]],
    description: ['', [Validators.required, Validators.maxLength(5000)]]
  });

  ngOnInit(): void {
    this.api.listModules().subscribe({
      next: (res) => this.modules.set(res.data),
      error: (err: HttpErrorResponse) => this.error.set(err.error?.message || 'Failed to load modules')
    });
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    const maxBytes = MAX_FILE_MB * 1024 * 1024;

    const valid: File[] = [];
    for (const file of files) {
      if (file.size > maxBytes) {
        this.error.set(`"${file.name}" exceeds ${MAX_FILE_MB}MB`);
        continue;
      }
      valid.push(file);
    }

    const combined = [...this.selectedFiles(), ...valid].slice(0, MAX_ATTACHMENTS);
    if (files.length && combined.length >= MAX_ATTACHMENTS) {
      this.error.set(`You can attach up to ${MAX_ATTACHMENTS} files.`);
    }
    this.selectedFiles.set(combined);
    input.value = '';
  }

  removeFile(file: File): void {
    this.selectedFiles.update((files) => files.filter((f) => f !== file));
  }

  onSubmit(): void {
    if (this.form.invalid) return;

    this.saving.set(true);
    this.error.set('');

    const files = this.selectedFiles();

    this.api
      .create(this.form.getRawValue())
      .pipe(
        switchMap((res) => {
          if (!files.length) {
            return of(res);
          }

          return from(files).pipe(
            concatMap((file) => this.api.uploadAttachment(res.data._id, file)),
            last(),
            switchMap(() => of(res))
          );
        })
      )
      .subscribe({
        next: (res) => this.router.navigate(['/merchant/tickets', res.data._id]),
        error: (err: HttpErrorResponse) => {
          this.error.set(err.error?.message || 'Failed to create ticket');
          this.saving.set(false);
        },
        complete: () => this.saving.set(false)
      });
  }
}
