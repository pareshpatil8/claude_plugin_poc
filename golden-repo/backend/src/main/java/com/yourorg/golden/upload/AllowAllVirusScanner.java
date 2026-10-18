package com.yourorg.golden.upload;

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Default no-op scanner so the app boots without ClamAV in the AI/local environment. Dev onwards
 * MUST provide a real VirusScanner bean (ClamAV); this fallback only marks content clean and logs
 * nothing sensitive. It is deliberately NOT used when a real scanner bean is present.
 */
@Configuration(proxyBeanMethods = false)
class AllowAllVirusScannerConfig {

    @Bean
    @ConditionalOnMissingBean(VirusScanner.class)
    VirusScanner allowAllVirusScanner() {
        return content -> true;
    }
}
