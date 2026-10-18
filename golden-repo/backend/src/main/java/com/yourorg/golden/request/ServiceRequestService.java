package com.yourorg.golden.request;

import java.security.SecureRandom;
import java.time.Clock;
import java.util.HexFormat;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ServiceRequestService {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final ServiceRequestRepository repository;
    private final ApplicationEventPublisher events;
    private final Clock clock;

    public ServiceRequestService(ServiceRequestRepository repository, ApplicationEventPublisher events, Clock clock) {
        this.repository = repository;
        this.events = events;
        this.clock = clock;
    }

    @Transactional
    public ServiceRequestView submit(CreateServiceRequest command, String requester) {
        var request = repository.save(new ServiceRequest(newReference(), command.applicantName().strip(),
                command.applicantEmail().strip(), command.category(), command.description(), requester,
                clock.instant()));
        events.publishEvent(new ServiceRequestSubmitted(request.getReference(), request.getCategory(),
                request.getCreatedAt()));
        return ServiceRequestView.of(request);
    }

    /**
     * Returns the request only to the user who created it. Anyone else gets "not found", so
     * references cannot be probed (no IDOR, no existence leak).
     */
    @Transactional(readOnly = true)
    public ServiceRequestView find(String reference, String requester) {
        return repository.findByReferenceAndCreatedBy(reference, requester)
                .map(ServiceRequestView::of)
                .orElseThrow(() -> new ServiceRequestNotFoundException(reference));
    }

    /** "SR-" plus 16 hex characters from a CSPRNG: unguessable and fits the 20-character column. */
    static String newReference() {
        var bytes = new byte[8];
        RANDOM.nextBytes(bytes);
        return "SR-" + HexFormat.of().withUpperCase().formatHex(bytes);
    }
}
