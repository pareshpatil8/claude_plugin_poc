package com.yourorg.golden.request;

import java.time.Instant;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ServiceRequestRepository extends JpaRepository<ServiceRequest, Long> {

    Optional<ServiceRequest> findByReferenceAndCreatedBy(String reference, String createdBy);

    @Modifying
    @Query("DELETE FROM ServiceRequest r WHERE r.status = com.yourorg.golden.request.Status.CLOSED AND r.closedAt < :cutoff")
    int deleteClosedBefore(@Param("cutoff") Instant cutoff);
}
