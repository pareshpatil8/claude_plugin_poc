// PLANTED DEFECTS for gate measurement. NOT part of the application.
import { DomSanitizer } from '@angular/platform-browser';
export class Defects {
  constructor(private s: DomSanitizer) {}
  // DEFECT-XSS-1: bypasses Angular XSS protection (eco-angular-bypass-security-trust)
  danger(html: string) { return this.s.bypassSecurityTrustHtml(html); }
}
