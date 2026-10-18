package com.yourorg.golden;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.testcontainers.kafka.KafkaContainer;
import org.testcontainers.oracle.OracleContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * Real Oracle Free and Kafka for integration tests. Image names can be overridden per environment
 * (e.g. a Nexus mirror) with TC_ORACLE_IMAGE / TC_KAFKA_IMAGE, or globally with Testcontainers'
 * hub.image.name.prefix.
 */
@TestConfiguration(proxyBeanMethods = false)
public class TestcontainersConfiguration {

    @Bean
    @ServiceConnection
    OracleContainer oracle() {
        var image = DockerImageName.parse(env("TC_ORACLE_IMAGE", "gvenzl/oracle-free:23-slim-faststart"))
                .asCompatibleSubstituteFor("gvenzl/oracle-free");
        return new OracleContainer(image);
    }

    @Bean
    @ServiceConnection
    KafkaContainer kafka() {
        var image = DockerImageName.parse(env("TC_KAFKA_IMAGE", "apache/kafka:4.2.1"))
                .asCompatibleSubstituteFor("apache/kafka");
        return new KafkaContainer(image);
    }

    private static String env(String name, String fallback) {
        var value = System.getenv(name);
        return value == null || value.isBlank() ? fallback : value;
    }
}
