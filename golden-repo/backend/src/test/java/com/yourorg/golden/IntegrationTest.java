package com.yourorg.golden;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.kafka.KafkaContainer;
import org.testcontainers.oracle.OracleContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * Base for integration tests. Oracle Free and Kafka start ONCE per JVM as shared singletons and
 * are reused across every integration test, so a fresh test does not cold-start its own container
 * (which caused start-up contention and readiness timeouts). The JVM shutdown reaps them via
 * Testcontainers' Ryuk. Image names are overridable for a Nexus mirror.
 */
@SpringBootTest
public abstract class IntegrationTest {

    static final OracleContainer ORACLE = new OracleContainer(image("TC_ORACLE_IMAGE", "gvenzl/oracle-free:23-slim-faststart"));
    static final KafkaContainer KAFKA = new KafkaContainer(image("TC_KAFKA_IMAGE", "apache/kafka:4.2.1"));

    static {
        // start() is idempotent; both start in parallel once, then every test reuses them.
        ORACLE.start();
        KAFKA.start();
    }

    private static DockerImageName image(String env, String fallback) {
        var value = System.getenv(env);
        var name = value == null || value.isBlank() ? fallback : value;
        var base = fallback.substring(0, fallback.indexOf(':'));
        return DockerImageName.parse(name).asCompatibleSubstituteFor(base);
    }

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", ORACLE::getJdbcUrl);
        registry.add("spring.datasource.username", ORACLE::getUsername);
        registry.add("spring.datasource.password", ORACLE::getPassword);
        registry.add("spring.kafka.bootstrap-servers", KAFKA::getBootstrapServers);
    }
}
