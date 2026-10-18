package com.yourorg.golden.request;

import jakarta.validation.Valid;
import java.net.URI;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/service-requests")
class ServiceRequestController {

    private final ServiceRequestService service;

    ServiceRequestController(ServiceRequestService service) {
        this.service = service;
    }

    @PostMapping
    ResponseEntity<ServiceRequestView> submit(@Valid @RequestBody CreateServiceRequest body,
                                              @AuthenticationPrincipal Jwt user) {
        var created = service.submit(body, user.getSubject());
        return ResponseEntity.created(URI.create("/api/service-requests/" + created.reference())).body(created);
    }

    @GetMapping("/{reference}")
    ServiceRequestView find(@PathVariable String reference, @AuthenticationPrincipal Jwt user) {
        return service.find(reference, user.getSubject());
    }

    @ExceptionHandler(ServiceRequestNotFoundException.class)
    ProblemDetail notFound(ServiceRequestNotFoundException ex) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
    }
}
