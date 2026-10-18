package com.yourorg.golden.request;

import com.yourorg.golden.config.GoldenProperties;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import tools.jackson.databind.json.JsonMapper;

/** Publishes only after the database commit, so consumers never see a request that was rolled back. */
@Component
class ServiceRequestEventPublisher {

    private final KafkaTemplate<String, String> kafka;
    private final JsonMapper json;
    private final String topic;

    ServiceRequestEventPublisher(KafkaTemplate<String, String> kafka, JsonMapper json, GoldenProperties properties) {
        this.kafka = kafka;
        this.json = json;
        this.topic = properties.topics().serviceRequestSubmitted();
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    void on(ServiceRequestSubmitted event) {
        kafka.send(topic, event.reference(), json.writeValueAsString(event));
    }
}
