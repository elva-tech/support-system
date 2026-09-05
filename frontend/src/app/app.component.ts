import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PortalDocumentTitleService } from './core/portal/portal-document-title.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet />`
})
export class AppComponent {
  /** Eager init — applies host-aware document titles */
  private readonly documentTitle = inject(PortalDocumentTitleService);
}
