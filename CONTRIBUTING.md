# Contributing to Agent Vault

Thanks for your interest in contributing. Here's how to get started.

## Prerequisites

- Node.js >= 22.5.0 (required for built-in `node:sqlite`)
- pnpm >= 10

## Setup

```bash
git clone https://github.com/agent-vault/agent-vault.git
cd agent-vault
pnpm install
pnpm build
```

## Development Workflow

```bash
pnpm build        # build all packages (turbo, respects dep graph)
pnpm typecheck    # tsc --noEmit across all packages
pnpm test         # vitest run across all packages
pnpm dev          # watch mode for CLI package
```

Filter to a single package:

```bash
pnpm --filter @agent-vault/core test
pnpm --filter @agent-vault/cli build
```

Run a single test file:

```bash
pnpm --filter @agent-vault/core exec vitest run src/services/IngestService.test.ts
```

## Architecture

The project uses a hexagonal (ports-and-adapters) architecture. Business logic lives in `@agent-vault/core` behind port interfaces. Adapters in `storage`, `providers`, and `ingestion` implement those interfaces. The CLI is a thin layer that wires adapters to services via `apps/cli/src/runtime.ts`.

When adding new functionality:

- Business logic goes in `packages/core/src/services/`
- External integrations implement interfaces from `packages/core/src/ports/interfaces.ts`
- CLI command handlers stay thin — call services, format output

## Testing

All packages use Vitest. Tests should be colocated with source or in a `test/` directory within each package.

Core services are tested with mock dependencies — no real API calls or database access needed.

```bash
pnpm test                    # run everything
pnpm --filter @agent-vault/core test   # run one package
```

## Pull Requests

1. Create a feature branch from `main`
2. Make your changes
3. Ensure `pnpm build && pnpm typecheck && pnpm test` all pass
4. Open a PR with a clear description of what changed and why

Keep PRs focused — one feature or fix per PR.

## Code Style

- TypeScript strict mode is enabled
- No ESLint/Prettier configured yet — just follow existing patterns
- Prefer backward-compatible SQLite schema migrations
- Credentials are never stored in config — they come from environment variables

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
