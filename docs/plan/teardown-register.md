# Teardown register

Light/ephemeral tools installed in the test environment for verification, and how each was removed
when the activity closed. Nothing persistent is left in the repository or a shipped artifact.

| Tool | Installed as | Used for | Status |
|---|---|---|---|
| Node 22.23.3 | tarball unpacked under the session scratchpad (not in repo) | Angular 22 build (needs Node ≥ 22.22.3) | Ephemeral; scratchpad is session-scoped, nothing committed |
| Semgrep 1.179.0 | `uvx semgrep@1.179.0` (uv cache in ~/.cache/uv) | Running custom rule packs on the golden repo and planted fixtures | Ephemeral; no repo/install footprint; cache is outside deliverables |
| gitleaks 8.28.0, Oracle Free, Kafka, hello-world | pulled container images | secret scan; Testcontainers integration tests | Images are session-scoped; `docker image prune` on teardown |
| Docker daemon | started in-session | container tests | Session-scoped; stops with the container |
| Planted-defect fixtures | scratchpad `vuln/` | prove rules fire | Deleted after verification (below) |

## Commands run at teardown
- `rm -rf <scratchpad>/vuln` — planted fixtures removed.
- Scratchpad Node and uv caches are session-scoped and discarded with the container.
- No teardown is needed inside the repo: all tool usage was ephemeral and none was committed.

Nothing light-installed here is part of `@yourorg/eco-forge`. The package ships only config
(Semgrep rule YAML, CI job definitions) that points at your Nexus-mirrored tools in production.

## Session 3 additions (removed)
| Tool | Installed as | Used for | Status |
|---|---|---|---|
| Trivy 0.60.0 | container image (public.ecr.aws/aquasecurity/trivy) + vuln-DB cache | Real SCA scan of golden backend + a log4shell fixture to prove the reachability chain | **Removed**: `docker rmi` + deleted the DB cache and fixtures |

Trivy reached its vuln DB through the agent proxy by mounting /root/.ccr/ca-bundle.crt and passing
HTTPS_PROXY/SSL_CERT_FILE — the same thing your Nexus ORAS mirror handles in production.
