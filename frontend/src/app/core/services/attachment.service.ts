import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AttachmentService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/attachments`;

  download(attachmentId: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${attachmentId}/download`, {
      responseType: 'blob'
    });
  }

  triggerDownload(attachmentId: string, fileName: string): void {
    this.download(attachmentId).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = fileName;
        anchor.click();
        window.URL.revokeObjectURL(url);
      }
    });
  }
}
