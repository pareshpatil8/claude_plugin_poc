package com.yourorg.golden;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

/** The AI-environment profile must start on H2 (Oracle mode) and apply the Oracle-first migrations. */
@SpringBootTest
@ActiveProfiles("local")
class LocalProfileTest {

    @Autowired
    JdbcTemplate jdbc;

    @Test
    void migrationsApplyOnH2InOracleMode() {
        var count = jdbc.queryForObject("SELECT COUNT(*) FROM service_request", Integer.class);
        assertThat(count).isZero();
    }
}
