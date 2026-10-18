# Golden repository (eco-forge M2-01)

A small but realistic reference application. eco-forge uses it to **measure** its gates and
agents: later milestones seed planted defects here (M2-02) and count how many each gate catches.
All data in this repository is synthetic.

| Part | Stack |
|---|---|
| `backend/` | Spring Boot 4.1.1, Java 21, Maven wrapper; Oracle (Flyway, Oracle-first SQL); H2 in Oracle mode for the `local` profile; Kafka; OAuth2 resource server (in-house IdP pending, Keycloak stands in) |
| `frontend/` | Angular 22.2.1, standalone components, signals, reactive forms; Vitest |

## Feature

Raise a service request (`POST /api/service-requests`) and read it back
(`GET /api/service-requests/{reference}`).
- Only the creator can read a request; anyone else gets 404, so references cannot be probed.
- Responses and Kafka events carry no personal data.
- The submit event is published to Kafka only after the database commit.
- The form has labelled fields, linked error messages, focus on the first invalid field, and status and alert announcements.

## Run the checks

```sh
# Backend: unit, web-layer, H2 local-profile and Oracle Free + Kafka integration tests (needs Docker/Podman)
cd backend && ./mvnw test
#   behind a mirror: TC_ORACLE_IMAGE=<mirror>/gvenzl/oracle-free:23-slim-faststart TC_KAFKA_IMAGE=<mirror>/apache/kafka:4.2.1

# Frontend (Node >= 22.22.3)
cd frontend && npm ci && npx ng test --watch=false && npx ng build
```

## Version pins

Dependencies are pinned exactly, to releases at least two weeks old. **One documented exception:**
`vitest` 5.0.5 (dev-only). 5.0.3 triggers an npm resolver crash (`Cannot read properties of null
(reading 'edgesOut')`), so it cannot be installed.
