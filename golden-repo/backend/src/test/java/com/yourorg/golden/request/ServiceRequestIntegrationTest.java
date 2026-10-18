package com.yourorg.golden.request;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.yourorg.golden.TestcontainersConfiguration;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.kafka.core.KafkaAdmin;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.json.JsonMapper;

/** End to end against real Oracle Free and Kafka (Testcontainers): the Dev-onwards database, not H2. */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class ServiceRequestIntegrationTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    JsonMapper json;

    @Autowired
    KafkaAdmin kafkaAdmin;

    @Autowired
    ServiceRequestRepository repository;

    @MockitoBean
    JwtDecoder jwtDecoder;

    @Test
    void submitStoresInOraclePublishesEventAndIsOnlyVisibleToItsOwner() throws Exception {
        var body = """
                {"applicantName":"Test Applicant","applicantEmail":"applicant@example.test",
                 "category":"TECHNICAL","description":"Synthetic test data"}
                """;

        try (var consumer = consumer()) {
            consumer.subscribe(List.of("service-requests.submitted"));
            consumer.poll(Duration.ofMillis(500));

            var response = mvc.perform(post("/api/service-requests").with(jwt().jwt(j -> j.subject("owner")))
                            .contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isCreated())
                    .andReturn().getResponse().getContentAsString();
            var reference = json.readTree(response).get("reference").asString();

            mvc.perform(get("/api/service-requests/" + reference).with(jwt().jwt(j -> j.subject("owner"))))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.category").value("TECHNICAL"));

            // Another user must not be able to read it, nor learn that it exists.
            mvc.perform(get("/api/service-requests/" + reference).with(jwt().jwt(j -> j.subject("someone-else"))))
                    .andExpect(status().isNotFound());

            assertThat(repository.findByReferenceAndCreatedBy(reference, "owner")).isPresent();

            var event = pollFor(consumer, reference);
            assertThat(event).contains("\"category\":\"TECHNICAL\"").doesNotContain("applicant");
        }
    }

    private KafkaConsumer<String, String> consumer() {
        Map<String, Object> config = Map.of(
                ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG,
                kafkaAdmin.getConfigurationProperties().get("bootstrap.servers"),
                ConsumerConfig.GROUP_ID_CONFIG, "it-" + UUID.randomUUID(),
                ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");
        return new KafkaConsumer<>(config, new StringDeserializer(), new StringDeserializer());
    }

    private static String pollFor(KafkaConsumer<String, String> consumer, String key) {
        var deadline = System.nanoTime() + Duration.ofSeconds(30).toNanos();
        while (System.nanoTime() < deadline) {
            for (var record : consumer.poll(Duration.ofMillis(500))) {
                if (key.equals(record.key())) {
                    return record.value();
                }
            }
        }
        throw new AssertionError("No Kafka event received for " + key);
    }
}
