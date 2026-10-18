package com.yourorg.golden.request;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.yourorg.golden.config.SecurityConfig;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(ServiceRequestController.class)
@Import(SecurityConfig.class)
class ServiceRequestControllerTest {

    private static final String VALID = """
            {"applicantName":"Test Applicant","applicantEmail":"applicant@example.test","category":"BILLING"}
            """;

    @Autowired
    MockMvc mvc;

    @MockitoBean
    ServiceRequestService service;

    @MockitoBean
    JwtDecoder jwtDecoder;

    @Test
    void rejectsRequestsWithoutToken() throws Exception {
        mvc.perform(post("/api/service-requests").contentType(MediaType.APPLICATION_JSON).content(VALID))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(service);
    }

    @Test
    void createsRequestAndReturnsLocation() throws Exception {
        when(service.submit(any(), eq("user-1"))).thenReturn(
                new ServiceRequestView("SR-0000000000000001", Category.BILLING, Status.SUBMITTED, Instant.EPOCH));

        mvc.perform(post("/api/service-requests").with(jwt().jwt(j -> j.subject("user-1")))
                        .contentType(MediaType.APPLICATION_JSON).content(VALID))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", "/api/service-requests/SR-0000000000000001"))
                .andExpect(jsonPath("$.reference").value("SR-0000000000000001"))
                .andExpect(jsonPath("$.applicantEmail").doesNotExist());
    }

    @Test
    void rejectsInvalidInputWithProblemDetails() throws Exception {
        var invalid = """
                {"applicantName":" ","applicantEmail":"not-an-email","category":null}
                """;
        mvc.perform(post("/api/service-requests").with(jwt()).contentType(MediaType.APPLICATION_JSON).content(invalid))
                .andExpect(status().isBadRequest())
                .andExpect(header().string("Content-Type", MediaType.APPLICATION_PROBLEM_JSON_VALUE));
        verifyNoInteractions(service);
    }

    @Test
    void rejectsOversizedName() throws Exception {
        var body = VALID.replace("Test Applicant", "x".repeat(201));
        mvc.perform(post("/api/service-requests").with(jwt()).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest());
    }

    @Test
    void returnsNotFoundAsProblemDetail() throws Exception {
        when(service.find("SR-MISSING", "user-1")).thenThrow(new ServiceRequestNotFoundException("SR-MISSING"));

        mvc.perform(get("/api/service-requests/SR-MISSING").with(jwt().jwt(j -> j.subject("user-1"))))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404));
    }

    @Test
    void healthIsNotUnderTheApi() throws Exception {
        mvc.perform(get("/api/anything")).andExpect(status().isUnauthorized());
    }
}
