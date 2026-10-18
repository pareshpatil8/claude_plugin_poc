package com.yourorg.golden.upload;

/** The result of accepting an upload: a random server-side name and the validated media type. */
public record StoredFile(String storedName, String mediaType, long size) {
}
