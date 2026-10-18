package com.yourorg.golden.upload;

/** Thrown when an upload is rejected. The message is safe to return to the caller. */
public class UploadException extends RuntimeException {

    public UploadException(String message) {
        super(message);
    }
}
