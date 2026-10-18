package com.yourorg.golden.request;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Marks a field as personal data (DPDP). Enforced two ways: the pii-check gate fails the build if
 * such a field is referenced in a log statement, and these fields are excluded from API responses
 * and domain events by design.
 */
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.FIELD)
public @interface Pii {

    enum Class { IDENTIFIER, CONTACT, FINANCIAL, SENSITIVE }

    Class value() default Class.CONTACT;
}
