import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export type Category = 'ACCOUNT' | 'BILLING' | 'TECHNICAL' | 'OTHER';

export interface CreateServiceRequest {
  applicantName: string;
  applicantEmail: string;
  category: Category;
  description?: string;
}

/** Mirrors the backend's ServiceRequestView: no personal data comes back. */
export interface ServiceRequestView {
  reference: string;
  category: Category;
  status: 'SUBMITTED' | 'IN_PROGRESS' | 'CLOSED';
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class ServiceRequestApi {
  private readonly http = inject(HttpClient);

  submit(request: CreateServiceRequest): Observable<ServiceRequestView> {
    return this.http.post<ServiceRequestView>('/api/service-requests', request);
  }
}
