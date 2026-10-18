package com.yourorg.golden.upload;

import java.io.IOException;
import java.security.SecureRandom;
import java.util.HexFormat;
import java.util.zip.GZIPInputStream;
import org.apache.tika.Tika;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

/**
 * Validates and accepts an uploaded file per the OWASP File Upload Cheat Sheet:
 *  - size limit (and a decompression-ratio guard against zip bombs);
 *  - true content type by magic bytes (Apache Tika), not the client-supplied Content-Type;
 *  - the client's declared extension must match the detected type;
 *  - malware scan (pluggable);
 *  - a random server-side name with the extension derived from the DETECTED type, so a
 *    double-extension or path-traversal filename cannot influence where/how it is stored.
 * The original filename is never used for storage and never echoed back.
 */
@Service
public class FileUploadService {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final long MAX_DECOMPRESSED_BYTES = 20L * 1024 * 1024;

    private final Tika tika = new Tika();
    private final VirusScanner scanner;

    public FileUploadService(VirusScanner scanner) {
        this.scanner = scanner;
    }

    public StoredFile accept(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new UploadException("No file was uploaded.");
        }
        if (file.getSize() > UploadPolicy.MAX_BYTES) {
            throw new UploadException("File exceeds the " + (UploadPolicy.MAX_BYTES / (1024 * 1024)) + " MB limit.");
        }

        byte[] content;
        try {
            content = file.getBytes();
        } catch (IOException e) {
            throw new UploadException("Upload could not be read.");
        }

        String detected = detectType(content);
        String extension = UploadPolicy.ALLOWED.get(detected);
        if (extension == null) {
            throw new UploadException("File type " + detected + " is not allowed.");
        }
        if (!declaredExtensionMatches(file.getOriginalFilename(), detected)) {
            throw new UploadException("The file extension does not match its actual content.");
        }
        guardAgainstZipBomb(content, detected);
        if (!scanner.isClean(content)) {
            throw new UploadException("The file failed a malware scan.");
        }
        return new StoredFile(randomName(extension), detected, file.getSize());
    }

    private String detectType(byte[] content) {
        return tika.detect(content);
    }

    /**
     * The declared extension must map to the same detected type. A ".png.exe" style name resolves
     * to "exe", which maps to nothing and is rejected.
     */
    private boolean declaredExtensionMatches(String originalName, String detected) {
        if (originalName == null || !originalName.contains(".")) {
            return false;
        }
        String ext = originalName.substring(originalName.lastIndexOf('.') + 1).toLowerCase();
        if (ext.equals("jpeg")) {
            ext = "jpg";
        }
        return extensionAllowsType(ext, detected);
    }

    private boolean extensionAllowsType(String ext, String detected) {
        String expected = UploadPolicy.ALLOWED.get(detected);
        return ext.equals(expected);
    }

    /** For gzip-based content, refuse if it expands beyond the decompression cap. */
    private void guardAgainstZipBomb(byte[] content, String detected) {
        if (!detected.contains("gzip") && !detected.contains("zip")) {
            return;
        }
        try (var in = new GZIPInputStream(new java.io.ByteArrayInputStream(content))) {
            long total = 0;
            byte[] buffer = new byte[8192];
            int read;
            while ((read = in.read(buffer)) != -1) {
                total += read;
                if (total > MAX_DECOMPRESSED_BYTES) {
                    throw new UploadException("Compressed file expands beyond the allowed size.");
                }
            }
        } catch (IOException e) {
            throw new UploadException("Compressed file could not be validated.");
        }
    }

    private String randomName(String extension) {
        var bytes = new byte[16];
        RANDOM.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes) + "." + extension;
    }
}
