# eco-forge gate catch-rate report

Planted defects: **8**. Caught: **8/8**.
Semgrep-targeted (measured live in this run): **5/5**.

| Defect | Category | Gate | Caught | How |
|--------|----------|------|--------|-----|
| DEFECT-SQLI-1 | injection | semgrep:eco-sql-string-concatenation | YES | fired in this run |
| DEFECT-PII-1 | dpdp-logging | semgrep:eco-pii-in-logs | YES | fired in this run |
| DEFECT-PERMITALL-1 | broken-access-control | semgrep:eco-disabled-method-security | YES | fired in this run |
| DEFECT-XSS-1 | xss | semgrep:eco-angular-bypass-security-trust | YES | fired in this run |
| DEFECT-XSS-2 | xss | semgrep:eco-angular-innerhtml-binding | YES | fired in this run |
| DEFECT-SCA-1 | vulnerable-dependency | sca:trivy | YES | measured separately (sca:trivy) |
| DEFECT-CMDI-1 | command-injection | spotbugs:COMMAND_INJECTION | YES | measured separately (proven in M2-06 Java SAST run) |
| DEFECT-RNG-1 | weak-random | spotbugs:PREDICTABLE_RANDOM | YES | measured separately (proven in M2-06 Java SAST run) |

Notes:
- SCA (Trivy) and SpotBugs/FindSecBugs defects are marked measured-separately: each was proven
  blocking in its own run (Log4Shell SCA; command injection + predictable RNG via FindSecBugs).
- This report is reproducible: `mvn -Pquality` + Semgrep + Trivy regenerate every input.
