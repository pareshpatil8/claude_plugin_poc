import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ServiceRequestForm } from './service-request-form';

describe('ServiceRequestForm', () => {
  let fixture: ComponentFixture<ServiceRequestForm>;
  let http: HttpTestingController;
  let root: HTMLElement;

  const field = <T extends HTMLElement>(id: string) => root.querySelector<T>(`#${id}`)!;
  const type = (id: string, value: string) => {
    const el = field<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(id);
    el.value = value;
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input'));
  };
  const submit = async () => {
    root.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
    await fixture.whenStable();
  };
  const fillValid = () => {
    type('applicantName', '  Test Applicant ');
    type('applicantEmail', 'applicant@example.test');
    type('category', 'BILLING');
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ServiceRequestForm],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(ServiceRequestForm);
    http = TestBed.inject(HttpTestingController);
    root = fixture.nativeElement as HTMLElement;
    document.body.appendChild(root); // focus only moves within the document
    await fixture.whenStable();
  });

  afterEach(() => {
    root.remove();
    http.verify();
  });

  it('labels every control', () => {
    for (const id of ['applicantName', 'applicantEmail', 'category', 'description']) {
      expect(root.querySelector(`label[for=${id}]`), id).not.toBeNull();
    }
  });

  it('shows linked errors, marks fields invalid and moves focus on an empty submit', async () => {
    await submit();
    const name = field<HTMLInputElement>('applicantName');
    expect(name.getAttribute('aria-invalid')).toBe('true');
    expect(name.getAttribute('aria-describedby')).toBe('applicantName-error');
    expect(field('applicantName-error').textContent).toContain('Enter your full name');
    expect(document.activeElement).toBe(name);
    http.expectNone('/api/service-requests');
  });

  it('focuses the first invalid field in form order', async () => {
    type('applicantName', 'Test Applicant');
    await submit();
    expect(document.activeElement).toBe(field('applicantEmail'));
  });

  it('rejects a whitespace-only name and an invalid email', async () => {
    type('applicantName', '   ');
    type('applicantEmail', 'not-an-email');
    type('category', 'OTHER');
    await submit();
    expect(field('applicantName').getAttribute('aria-invalid')).toBe('true');
    expect(field('applicantEmail').getAttribute('aria-invalid')).toBe('true');
    http.expectNone('/api/service-requests');
  });

  it('caps inputs at the backend limits', () => {
    expect(field('applicantName').getAttribute('maxlength')).toBe('200');
    expect(field('applicantEmail').getAttribute('maxlength')).toBe('320');
    expect(field('description').getAttribute('maxlength')).toBe('2000');
  });

  it('submits trimmed values, omits an empty description and announces the reference', async () => {
    fillValid();
    await submit();
    const req = http.expectOne('/api/service-requests');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      applicantName: 'Test Applicant',
      applicantEmail: 'applicant@example.test',
      category: 'BILLING',
    });
    req.flush({ reference: 'SR-0000000000000001', category: 'BILLING', status: 'SUBMITTED', createdAt: '' });
    await fixture.whenStable();
    expect(root.querySelector('[role=status]')?.textContent).toContain('SR-0000000000000001');
    expect(field<HTMLInputElement>('applicantName').value).toBe('');
  });

  it('shows an alert and keeps the input when the server fails', async () => {
    fillValid();
    await submit();
    http.expectOne('/api/service-requests').flush('boom', { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();
    expect(root.querySelector('[role=alert]')?.textContent).toContain('could not be submitted');
    expect(field<HTMLInputElement>('applicantEmail').value).toBe('applicant@example.test');
  });
});
