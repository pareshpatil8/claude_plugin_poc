package com.yourorg.golden.request;

import static org.assertj.core.api.Assertions.assertThat;

import com.yourorg.golden.IntegrationTest;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;

/** DPDP retention on real Oracle (Testcontainers): only closed, past-retention rows are erased. */
@Import(RetentionJobTest.FixedClockConfig.class)
class RetentionJobTest extends IntegrationTest {

    static final Instant NOW = Instant.parse("2026-10-18T00:00:00Z");

    @TestConfiguration(proxyBeanMethods = false)
    static class FixedClockConfig {
        @Bean
        @Primary
        Clock fixedClock() {
            return Clock.fixed(NOW, ZoneOffset.UTC);
        }
    }

    @Autowired
    ServiceRequestService service;

    @Autowired
    ServiceRequestRepository repository;

    @Autowired
    RetentionJob job;

    @Test
    void erasesOnlyClosedRequestsPastRetention() {
        repository.deleteAll();
        // Open request: never erased.
        service.submit(new CreateServiceRequest("A Name", "a@example.test", Category.OTHER, null), "u1");
        // Closed long ago: must be erased.
        var old = repository.save(closed(NOW.minus(Duration.ofDays(31))));
        // Closed recently: retained.
        var recent = repository.save(closed(NOW.minus(Duration.ofDays(5))));

        int erased = job.eraseExpired();

        assertThat(erased).isEqualTo(1);
        assertThat(repository.findById(old.getId())).isEmpty();
        assertThat(repository.findById(recent.getId())).isPresent();
        assertThat(repository.count()).isEqualTo(2);
    }

    private ServiceRequest closed(Instant closedAt) {
        var r = new ServiceRequest(ServiceRequestService.newReference(), "Closed Name", "closed@example.test",
                Category.TECHNICAL, null, "u2", closedAt.minus(Duration.ofDays(1)));
        r.close(closedAt);
        return r;
    }
}
