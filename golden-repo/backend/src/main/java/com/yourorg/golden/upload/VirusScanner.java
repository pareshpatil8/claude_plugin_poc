package com.yourorg.golden.upload;

/**
 * Malware scan abstraction. Production binds a ClamAV-backed implementation (clamd sidecar);
 * tests bind a stub. The daemon is therefore never required to run the test suite.
 */
public interface VirusScanner {

    /** @return true when the content is clean. */
    boolean isClean(byte[] content);
}
