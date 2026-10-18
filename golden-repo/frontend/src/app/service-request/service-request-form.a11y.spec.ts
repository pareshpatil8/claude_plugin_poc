import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import axe from 'axe-core';
import { ServiceRequestForm } from './service-request-form';

/**
 * Accessibility gate: runs axe-core (WCAG 2.1/2.2 A + AA rule sets) against the rendered form.
 * Fails on any serious/critical violation — the same severities the eco-forge a11y gate blocks on.
 */
async function violations(root: HTMLElement) {
  const results = await axe.run(root, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
  });
  return results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
}

describe('ServiceRequestForm accessibility (axe)', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ServiceRequestForm],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('has no serious or critical WCAG violations', async () => {
    const fixture = TestBed.createComponent(ServiceRequestForm);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    document.body.appendChild(root);
    const found = await violations(root);
    document.body.removeChild(root);
    expect(found.map((v) => v.id)).toEqual([]);
  });

  it('axe catches an injected defect (input with no label)', async () => {
    // Negative control: proves the gate actually detects violations, not just passes vacuously.
    const bad = document.createElement('div');
    bad.innerHTML = '<input type="text" />';
    document.body.appendChild(bad);
    const found = await violations(bad);
    document.body.removeChild(bad);
    expect(found.some((v) => v.id === 'label')).toBe(true);
  });
});
