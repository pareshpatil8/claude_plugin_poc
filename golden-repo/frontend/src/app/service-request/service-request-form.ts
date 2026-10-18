import { Component, ElementRef, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Category, ServiceRequestApi, ServiceRequestView } from './service-request.api';

/** Limits mirror the backend's Bean Validation constraints on CreateServiceRequest. */
export const LIMITS = { name: 200, email: 320, description: 2000 } as const;

export const CATEGORIES: readonly { value: Category; label: string }[] = [
  { value: 'ACCOUNT', label: 'Account' },
  { value: 'BILLING', label: 'Billing' },
  { value: 'TECHNICAL', label: 'Technical' },
  { value: 'OTHER', label: 'Other' },
];

@Component({
  selector: 'app-service-request-form',
  imports: [ReactiveFormsModule],
  templateUrl: './service-request-form.html',
  styleUrl: './service-request-form.scss',
})
export class ServiceRequestForm {
  private readonly api = inject(ServiceRequestApi);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly categories = CATEGORIES;
  protected readonly limits = LIMITS;
  protected readonly submitted = signal<ServiceRequestView | null>(null);
  protected readonly submitError = signal<string | null>(null);
  protected readonly submitting = signal(false);
  protected readonly showErrors = signal(false);

  protected readonly form = inject(NonNullableFormBuilder).group({
    applicantName: ['', [Validators.required, Validators.maxLength(LIMITS.name), Validators.pattern(/\S/)]],
    applicantEmail: ['', [Validators.required, Validators.email, Validators.maxLength(LIMITS.email)]],
    category: ['' as Category | '', Validators.required],
    description: ['', Validators.maxLength(LIMITS.description)],
  });

  protected invalid(name: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[name];
    return control.invalid && (control.touched || this.showErrors());
  }

  protected submit(): void {
    this.submitError.set(null);
    if (this.form.invalid) {
      this.showErrors.set(true);
      this.form.markAllAsTouched();
      this.focusFirstInvalid();
      return;
    }
    const value = this.form.getRawValue();
    this.submitting.set(true);
    this.api
      .submit({
        applicantName: value.applicantName.trim(),
        applicantEmail: value.applicantEmail.trim(),
        category: value.category as Category,
        ...(value.description.trim() ? { description: value.description.trim() } : {}),
      })
      .subscribe({
        next: (view) => {
          this.submitting.set(false);
          this.submitted.set(view);
          this.showErrors.set(false);
          this.form.reset();
        },
        error: () => {
          this.submitting.set(false);
          this.submitError.set('Your request could not be submitted. Please try again.');
        },
      });
  }

  /** Uses form order, not the DOM: error attributes are not rendered yet when this runs. */
  private focusFirstInvalid(): void {
    const first = Object.entries(this.form.controls).find(([, control]) => control.invalid)?.[0];
    if (first) {
      this.host.nativeElement.querySelector<HTMLElement>(`#${first}`)?.focus();
    }
  }
}
