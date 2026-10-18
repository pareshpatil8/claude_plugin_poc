package com.yourorg.golden.request;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.HashSet;
import org.junit.jupiter.api.Test;

class ServiceRequestServiceTest {

    @Test
    void referencesAreWellFormedAndUnique() {
        var seen = new HashSet<String>();
        for (int i = 0; i < 10_000; i++) {
            var reference = ServiceRequestService.newReference();
            assertThat(reference).matches("SR-[0-9A-F]{16}").hasSizeLessThanOrEqualTo(20);
            assertThat(seen.add(reference)).as("duplicate reference %s", reference).isTrue();
        }
    }
}
