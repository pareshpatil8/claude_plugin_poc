package com.yourorg.golden.upload;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.ByteArrayOutputStream;
import java.util.zip.GZIPOutputStream;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

/** OWASP File Upload attack cases. All data is synthetic. */
class FileUploadServiceTest {

    private final FileUploadService service = new FileUploadService(content -> true);
    private final FileUploadService rejectingScanner = new FileUploadService(content -> false);

    private static final byte[] PNG = { (byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0 };
    private static final byte[] PDF = "%PDF-1.7\n1 0 obj\n<<>>\nendobj\n".getBytes();

    @Test
    void acceptsAGenuinePngWithMatchingExtension() {
        var stored = service.accept(new MockMultipartFile("file", "photo.png", "image/png", PNG));
        assertThat(stored.mediaType()).isEqualTo("image/png");
        assertThat(stored.storedName()).matches("[0-9a-f]{32}\\.png"); // random name, detected extension
        assertThat(stored.storedName()).doesNotContain("photo");
    }

    @Test
    void acceptsPdf() {
        assertThat(service.accept(new MockMultipartFile("file", "doc.pdf", "application/pdf", PDF)).mediaType())
                .isEqualTo("application/pdf");
    }

    @Test
    void rejectsExecutableRenamedAsPng() {
        // Real content is a Windows PE; the client lies with a .png name and image/png header.
        byte[] pe = { 'M', 'Z', (byte) 0x90, 0, 3, 0, 0, 0, 4, 0 };
        assertThatThrownBy(() -> service.accept(new MockMultipartFile("file", "evil.png", "image/png", pe)))
                .isInstanceOf(UploadException.class)
                .hasMessageContaining("not allowed");
    }

    @Test
    void rejectsDoubleExtension() {
        assertThatThrownBy(() -> service.accept(new MockMultipartFile("file", "evil.png.exe", "image/png", PNG)))
                .isInstanceOf(UploadException.class)
                .hasMessageContaining("does not match");
    }

    @Test
    void rejectsSvgWithScript() {
        // SVG is not in the allow-list at all, so a scripted SVG never reaches storage.
        byte[] svg = "<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>".getBytes();
        assertThatThrownBy(() -> service.accept(new MockMultipartFile("file", "x.svg", "image/svg+xml", svg)))
                .isInstanceOf(UploadException.class);
    }

    @Test
    void rejectsContentTypeMismatchWherePdfBytesClaimPngName() {
        assertThatThrownBy(() -> service.accept(new MockMultipartFile("file", "doc.png", "image/png", PDF)))
                .isInstanceOf(UploadException.class)
                .hasMessageContaining("does not match");
    }

    @Test
    void rejectsOversizeFile() {
        byte[] big = new byte[(int) (UploadPolicy.MAX_BYTES + 1)];
        System.arraycopy(PNG, 0, big, 0, PNG.length);
        assertThatThrownBy(() -> service.accept(new MockMultipartFile("file", "big.png", "image/png", big)))
                .isInstanceOf(UploadException.class)
                .hasMessageContaining("limit");
    }

    @Test
    void rejectsPathTraversalName() {
        // Even a traversal name cannot matter: storage uses a random name. The ../ name has no
        // allowed extension, so it is rejected before storage anyway.
        assertThatThrownBy(() -> service.accept(new MockMultipartFile("file", "../../etc/passwd", "image/png", PNG)))
                .isInstanceOf(UploadException.class);
    }

    @Test
    void rejectsZipBomb() throws Exception {
        var baos = new ByteArrayOutputStream();
        try (var gz = new GZIPOutputStream(baos)) {
            gz.write(new byte[64 * 1024 * 1024]); // 64 MB of zeros -> tiny gzip
        }
        assertThatThrownBy(() -> service.accept(new MockMultipartFile("file", "bomb.png", "image/png", baos.toByteArray())))
                .isInstanceOf(UploadException.class);
    }

    @Test
    void rejectsEmptyUpload() {
        assertThatThrownBy(() -> service.accept(new MockMultipartFile("file", "a.png", "image/png", new byte[0])))
                .isInstanceOf(UploadException.class)
                .hasMessageContaining("No file");
    }

    @Test
    void rejectsWhenScannerReportsMalware() {
        assertThatThrownBy(() -> rejectingScanner.accept(new MockMultipartFile("file", "p.png", "image/png", PNG)))
                .isInstanceOf(UploadException.class)
                .hasMessageContaining("malware");
    }
}
