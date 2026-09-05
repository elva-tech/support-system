import { Injectable, computed, inject } from '@angular/core';
import { BrandingService } from './branding.service';
import {
  CUSTOMER_LABEL_COPY,
  CustomerLabel,
  normalizeCustomerLabel
} from './default-branding';

/**
 * Presentation terminology for MerchantProfile entities.
 * Does not rename APIs or models — UI labels only.
 */
@Injectable({ providedIn: 'root' })
export class CustomerTerminologyService {
  private readonly branding = inject(BrandingService);

  readonly label = computed<CustomerLabel>(() =>
    normalizeCustomerLabel(this.branding.branding().customerLabel)
  );

  readonly copy = computed(() => CUSTOMER_LABEL_COPY[this.label()]);

  readonly singular = computed(() => this.copy().singular);
  readonly plural = computed(() => this.copy().plural);
  readonly addLabel = computed(() => this.copy().add);
  readonly detailsLabel = computed(() => this.copy().details);
  readonly emptyLabel = computed(() => this.copy().empty);

  forLabel(label: CustomerLabel | string | null | undefined) {
    return CUSTOMER_LABEL_COPY[normalizeCustomerLabel(label)];
  }
}
