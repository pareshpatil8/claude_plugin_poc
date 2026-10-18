package com.yourorg.golden.config;

import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "golden")
public record GoldenProperties(Topics topics) {

    public record Topics(@NotBlank String serviceRequestSubmitted) {
    }
}
