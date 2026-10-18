package com.yourorg.golden.request;

import java.time.Instant;

/** What the API returns. Personal data is deliberately left out (data minimisation). */
public record ServiceRequestView(String reference, Category category, Status status, Instant createdAt) {

    static ServiceRequestView of(ServiceRequest request) {
        return new ServiceRequestView(request.getReference(), request.getCategory(), request.getStatus(),
                request.getCreatedAt());
    }
}
