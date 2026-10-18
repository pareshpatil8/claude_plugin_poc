package com.yourorg.golden.request;

public class ServiceRequestNotFoundException extends RuntimeException {

    public ServiceRequestNotFoundException(String reference) {
        super("Service request " + reference + " not found");
    }
}
