# Java SAST (quality profile)

`./mvnw -Pquality spotbugs:spotbugs pmd:check` runs SpotBugs + FindSecBugs (SARIF to
target/sarif/) and PMD (security/errorprone/bestpractices rulesets). Feed the SARIF to the gate:

    node eco-forge-gate target/sarif/spotbugs.sarif --block critical,high

The eco-forge gate elevates FindSecBugs security rule-ids (COMMAND_INJECTION, SQL_INJECTION,
PREDICTABLE_RANDOM, …) to critical/high, because SpotBugs reports every finding as SARIF
"warning". Proven: a planted command injection + predictable RNG make the gate fail (exit 2);
the clean backend passes with 0 blocking findings.
