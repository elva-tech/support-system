import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserRole } from '../../../core/models';

@Component({
  selector: 'app-role-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="badge" [ngClass]="roleClass">{{ role }}</span>
  `
})
export class RoleBadgeComponent {
  @Input({ required: true }) role!: UserRole;

  get roleClass(): string {
    switch (this.role) {
      case 'ADMIN':
        return 'bg-purple-100 text-purple-800';
      case 'TEAM_LEAD':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  }
}
