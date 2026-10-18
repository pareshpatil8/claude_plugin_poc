package com.yourorg.golden.upload;

import java.util.Map;
import java.util.Set;

/**
 * Allow-list policy for uploads (OWASP File Upload Cheat Sheet). The detected content type (by
 * magic bytes) must be in the allow-list, and the declared extension must match the detected type.
 */
public final class UploadPolicy {

    /** Detected media type -> the one extension we store it under. Allow-list, not deny-list. */
    static final Map<String, String> ALLOWED = Map.of(
            "application/pdf", "pdf",
            "image/png", "png",
            "image/jpeg", "jpg");

    static final long MAX_BYTES = 5L * 1024 * 1024;

    private UploadPolicy() {
    }

    static Set<String> allowedTypes() {
        return ALLOWED.keySet();
    }
}
