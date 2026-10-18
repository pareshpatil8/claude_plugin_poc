package com.yourorg.golden.request;

import java.time.Clock;
import java.time.Duration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * DPDP retention: permanently erase closed requests past the retention period. Logs only counts
 * and the non-identifying reference, never personal data.
 */
@Component
public class RetentionJob {

    private static final Logger log = LoggerFactory.getLogger(RetentionJob.class);
    static final Duration RETENTION = Duration.ofDays(30);

    private final ServiceRequestRepository repository;
    private final Clock clock;

    public RetentionJob(ServiceRequestRepository repository, Clock clock) {
        this.repository = repository;
        this.clock = clock;
    }

    @Scheduled(cron = "0 30 2 * * *")
    @Transactional
    public int eraseExpired() {
        var cutoff = clock.instant().minus(RETENTION);
        int erased = repository.deleteClosedBefore(cutoff);
        log.info("DPDP retention: erased {} service request(s) closed before {}", erased, cutoff);
        return erased;
    }
}
