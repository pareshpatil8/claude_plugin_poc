// PLANTED DEFECT DEFECT-PERMITALL-1: permitAll on an API path (eco-disabled-method-security).
// Realistic Spring Security fragment (not compiled; scanned statically).
package planted;
class SecurityConfigBad {
    void chain(Object http) {
        authorizeHttpRequests(a -> a.requestMatchers("/api/admin").permitAll());
    }
    void authorizeHttpRequests(Object o) {}
    Object requestMatchers(String p) { return this; }
    Object permitAll() { return this; }
}
