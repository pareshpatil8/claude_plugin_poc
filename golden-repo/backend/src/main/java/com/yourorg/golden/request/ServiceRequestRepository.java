package com.yourorg.golden.request;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ServiceRequestRepository extends JpaRepository<ServiceRequest, Long> {

    Optional<ServiceRequest> findByReferenceAndCreatedBy(String reference, String createdBy);
}
