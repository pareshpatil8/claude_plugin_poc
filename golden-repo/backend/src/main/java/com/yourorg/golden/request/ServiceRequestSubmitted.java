package com.yourorg.golden.request;

import java.time.Instant;

/** Domain event published to Kafka. Carries no personal data. */
public record ServiceRequestSubmitted(String reference, Category category, Instant submittedAt) {
}
