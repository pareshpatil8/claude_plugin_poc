-- DPDP retention: service requests are erased 30 days after closure. Oracle-first; H2 placeholder.
ALTER TABLE service_request ADD closed_at TIMESTAMP WITH TIME ZONE;
