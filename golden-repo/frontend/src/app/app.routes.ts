import { Routes } from '@angular/router';
import { ServiceRequestForm } from './service-request/service-request-form';

export const routes: Routes = [
  { path: '', component: ServiceRequestForm, title: 'Raise a service request' },
  { path: '**', redirectTo: '' },
];
