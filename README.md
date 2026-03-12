# Agent Vault

CLI-first retrieval system for project knowledge.  
Ingest local documents, ask grounded questions, and keep auditable markdown conversation logs.

## Why Agent Vault

- Retrieval-first workflow for coding agents and developer tooling.
- Monorepo architecture with clean ports-and-adapters boundaries.
- Local SQLite vector store (no Supabase dependency required).
- OpenAI and Azure OpenAI support.
- Deterministic CLI output with explicit failure exit codes.

## Features

- `configure`: interactive provider and model setup.
- `ingest`: recursive file discovery, parsing, chunking, embedding, persistence.
- `ask`: one-shot grounded answer with citations and markdown export.
- `status`: configuration + index health summary.
- `doctor`: environment and storage diagnostics.
- Local conversation exports to `.conversations/YYYY-MM-DD/*.md`.

## Requirements

- Node.js `24+`
- `pnpm` `10+`
- OpenAI or Azure OpenAI credentials

## Quick Start

```bash
pnpm install
pnpm build
```

Run from source:

```bash
node apps/cli/dist/index.js --help
```

Link globally:

```bash
cd apps/cli
pnpm link --global
agent-vault --help
```

## Command Reference

Top-level help:

```bash
agent-vault --help
```

Configure provider and model:

```bash
agent-vault configure
```

Ingest project documents:

```bash
agent-vault ingest --source ./docs --project my-project
agent-vault ingest --source ./docs --project my-project --reindex
```

Ask grounded questions:

```bash
agent-vault ask "How does configuration work?" --project my-project
agent-vault ask "What is the architecture?" --project my-project --top-k 6
```

Health/status:

```bash
agent-vault status --project my-project
agent-vault doctor
```

## Configuration and Secrets

Agent Vault uses two files in `~/.agent-vault/`:

- `agent-vault.json`: non-secret config (provider, models, output directory, db path, default project).
- `auth.json`: encrypted credentials.
- `auth.key`: local encryption key used to decrypt `auth.json`.

Behavior:

- `agent-vault configure` updates provider/model config and can capture credentials interactively.
- At runtime, credentials are loaded into process environment from the encrypted auth vault.
- You can still provide credentials through shell environment variables if preferred.

## Supported Inputs

Ingestion supports:

- `txt`
- `md`
- `pdf`
- `png`, `jpg`, `jpeg`, `webp` (stub image/OCR flow in v1)

## Project Structure

```text
apps/cli            # CLI entrypoint and command handlers
packages/core       # domain entities, ports, application services
packages/ingestion  # discovery/parsing/chunking pipeline
packages/retrieval  # context reduction and answer prompt assembly
packages/storage    # sqlite vector store + local config/auth/export repos
packages/providers  # OpenAI/Azure providers + OCR/vision stubs
packages/shared     # schemas, errors, utilities
```

## Development

Workspace scripts:

```bash
pnpm build
pnpm typecheck
pnpm test
pnpm lint
```

CLI package only:

```bash
pnpm --filter @agent-vault/cli build
pnpm --filter @agent-vault/cli test
```

## Troubleshooting

- Run `agent-vault doctor` first for environment/config/storage checks.
- If commands fail globally, relink:

```bash
cd apps/cli
pnpm link --global
```

- If provider calls fail, rerun `agent-vault configure` and re-enter credentials.

## Roadmap

- Replace image/OCR stubs with production adapters.
- Expand retrieval/ranking controls.
- Add broader fixture-based integration coverage.

## Contributing

Contributions are welcome.  
Before opening a PR, run:

```bash
pnpm typecheck
pnpm test
pnpm lint
```

## License

No license file is currently present in this repository.  
Add a `LICENSE` file before public distribution.
