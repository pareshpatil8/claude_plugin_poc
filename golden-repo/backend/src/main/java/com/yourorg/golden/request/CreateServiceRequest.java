package com.yourorg.golden.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateServiceRequest(
        @NotBlank @Size(max = 200) String applicantName,
        @NotBlank @Email @Size(max = 320) String applicantEmail,
        @NotNull Category category,
        @Size(max = 2000) String description) {
}
