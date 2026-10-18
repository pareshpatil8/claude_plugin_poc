package com.yourorg.golden.request;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "service_request")
public class ServiceRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 20)
    private String reference;

    /** Personal data (DPDP): never logged, never published on events. */
    @Pii(Pii.Class.IDENTIFIER)
    @Column(name = "applicant_name", nullable = false, length = 200)
    private String applicantName;

    /** Personal data (DPDP): never logged, never published on events. */
    @Pii(Pii.Class.CONTACT)
    @Column(name = "applicant_email", nullable = false, length = 320)
    private String applicantEmail;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private Category category;

    @Column(length = 2000)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status;

    @Column(name = "created_by", nullable = false, length = 200)
    private String createdBy;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "closed_at")
    private Instant closedAt;

    protected ServiceRequest() {
        // for JPA
    }

    ServiceRequest(String reference, String applicantName, String applicantEmail, Category category,
                   String description, String createdBy, Instant createdAt) {
        this.reference = reference;
        this.applicantName = applicantName;
        this.applicantEmail = applicantEmail;
        this.category = category;
        this.description = description;
        this.status = Status.SUBMITTED;
        this.createdBy = createdBy;
        this.createdAt = createdAt;
    }

    public Long getId() {
        return id;
    }

    public String getReference() {
        return reference;
    }

    public Category getCategory() {
        return category;
    }

    public Status getStatus() {
        return status;
    }

    public String getCreatedBy() {
        return createdBy;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    void close(Instant when) {
        this.status = Status.CLOSED;
        this.closedAt = when;
    }
}
