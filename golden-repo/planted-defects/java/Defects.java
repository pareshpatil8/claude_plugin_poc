// PLANTED DEFECTS for gate measurement. NOT part of the application. Each method carries a
// DEFECT-ID matching catalogue.json. Synthetic only.
package planted;
import java.sql.*;
import org.slf4j.Logger;
import jakarta.persistence.EntityManager;

class Defects {
    Logger log; EntityManager em; Connection conn;

    // DEFECT-SQLI-1: SQL injection via string concatenation (eco-sql-string-concatenation)
    void sqli(String name) { em.createQuery("SELECT u FROM User u WHERE u.name='" + name + "'"); }

    // DEFECT-PII-1: personal data written to logs (eco-pii-in-logs)
    void piiLog(String applicantEmail) { log.info("email {}", applicantEmail); }
}
