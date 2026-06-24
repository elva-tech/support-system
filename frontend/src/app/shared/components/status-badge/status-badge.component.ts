import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span
      class="badge"
      [ngClass]="active ? 'bg-elva-100 text-elva-800' : 'bg-slate-100 text-slate-600'"
    >
      {{ active ? 'Active' : 'Inactive' }}
    </span>
  `
})
export class StatusBadgeComponent {
  @Input() active = true;
}
