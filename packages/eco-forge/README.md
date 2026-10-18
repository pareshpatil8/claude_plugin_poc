# @yourorg/eco-forge

Installs and configures the eco-forge delivery ecosystem around Claude Code. See
`docs/design/` and `docs/plan/` in the repository for the full design and roadmap.

**Status: 0.1.0-dev.** Done so far: M1-01 (package scaffold) and M1-02 (CLI core). Agents, hooks,
MCP servers and quality gates arrive in later milestones.

## Requirements

Node.js 22.12 or later. Run `eco-forge doctor` to check the rest of the workstation.

## Usage

```sh
# Project work: Claude via AWS Bedrock in an India region (the default)
npx @yourorg/eco-forge init \
  --model-high <in-region-id> --model-mid <in-region-id> --model-low <in-region-id>

# Testing eco-forge itself on a Claude subscription (synthetic data only)
npx @yourorg/eco-forge init --provider subscription --classification synthetic

npx @yourorg/eco-forge init --dry-run     # show what would change
npx @yourorg/eco-forge doctor             # check prerequisites
```

## How `init` treats existing files

eco-forge records every file it writes, with a hash, in `.eco/manifest.json`. On each run:

| Situation | Action |
|---|---|
| File missing | `create` |
| Managed and untouched, template changed | `update` |
| Already identical | `unchanged` (or `adopt` if it was not yet managed) |
| Managed but edited locally | `keep-modified`: your edit is kept (merging arrives with `upgrade`, M1-20) |
| Unmanaged file with different content | `conflict`: left alone, exit code 2; `--force` replaces it and backs up the original to `.eco/backup/` |
| Symlink or directory in the way | `conflict`, even with `--force` |

Re-running `init` without changes leaves the project byte-for-byte identical.

## Safety rules enforced by the CLI

- `--provider subscription` is refused unless `--classification synthetic` is set.
- Bedrock regions are limited to India (`ap-south-1`, `ap-south-2`).
- Cross-region inference profile model IDs (`us.`, `eu.`, `apac.`, `global.` …) are rejected.
- Generated Claude Code settings disable auto-update and, on Bedrock, non-essential traffic.
- The package has no runtime dependencies and no install scripts.

## Development

```sh
npm install          # from the repository root
npm test             # build + node:test with coverage thresholds
npm run lint && npm run typecheck
```
