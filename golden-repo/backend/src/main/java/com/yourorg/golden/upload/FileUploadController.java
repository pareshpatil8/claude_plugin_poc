package com.yourorg.golden.upload;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/uploads")
class FileUploadController {

    private final FileUploadService service;

    FileUploadController(FileUploadService service) {
        this.service = service;
    }

    @PostMapping
    StoredFile upload(@RequestParam("file") MultipartFile file) {
        return service.accept(file);
    }

    @ExceptionHandler(UploadException.class)
    ProblemDetail rejected(UploadException ex) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.UNPROCESSABLE_ENTITY, ex.getMessage());
    }
}
