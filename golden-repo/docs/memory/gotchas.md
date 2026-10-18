# Gotchas

Verified lessons learned (from `/eco:retro` after merges and bug fixes). Each entry is
reviewed in a merge request before it lands, so this file only holds checked facts.

<!-- Format: ## <short title>  /  What happens  /  Why  /  What to do instead  /  Source (MR or issue) -->

## H2 (Oracle mode) rejects `NUMBER(19)` ids under Hibernate schema validation
- **What happens:** the `local` profile fails at startup with "wrong column type encountered in column [id]; found numeric, expecting bigint". Oracle itself is fine.
- **Why:** H2 maps `NUMBER(19)` to NUMERIC even in Oracle mode, while Hibernate expects BIGINT for a `Long` id on H2.
- **What to do:** write the id type as the Flyway placeholder `${id_type}`: `NUMBER(19)` in `application.yml` (Oracle), `BIGINT` in `application-local.yml` (H2). Never switch off `ddl-auto: validate` to hide the mismatch.
- **Source:** golden-repo sprint 1, caught by `LocalProfileTest`.
