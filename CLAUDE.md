# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Dev Commands

```bash
pnpm install              # install all workspace deps
pnpm build                # build all packages (turbo, respects dep graph)
pnpm typecheck            # tsc --noEmit across all packages
pnpm test                 # vitest run across all packages
pnpm lint                 # same as typecheck (no ESLint/Prettier configured)
pnpm dev                  # dev mode for CLI package
```

Filter to a single package:

```bash
pnpm --filter @agent-vault/cli build
pnpm --filter @agent-vault/core test
pnpm --filter @agent-vault/storage typecheck
```

Run a single test file:

```bash
pnpm --filter @agent-vault/core exec vitest run src/services/IngestService.test.ts
```

Turbo task order: `build` → `typecheck` → `test` → `lint`. Tests depend on `^build`.

## Architecture

Ports-and-adapters (hexagonal) architecture. All external integrations sit behind interfaces defined in `packages/core/src/ports/interfaces.ts`.

### Dependency Flow

```
apps/cli  →  @agent-vault/core (services + ports)
                ↓ depends on
         @agent-vault/shared (config schemas, errors, logger, utils)
                ↑ implemented by
  @agent-vault/storage     (SqliteVectorStore, LocalConfigRepository, AuthVault, MarkdownConversationExporter)
  @agent-vault/providers   (OpenAI/Azure embedding + answer providers, stub OCR/vision)
  @agent-vault/ingestion   (FileScanner, parsers, DefaultChunker, IngestionPipeline)
  @agent-vault/retrieval   (contextReducer, groundedPrompt, citationBuilder)
```

### Runtime Wiring

`apps/cli/src/runtime.ts` is the composition root — it constructs all adapters and injects them into core services. CLI command handlers (`apps/cli/src/commands/*.ts`) are thin: they call services and format output.

### Key Ports (interfaces.ts)

- `VectorStore` — document/chunk persistence and similarity search
- `DocumentParser` / `Chunker` — ingestion pipeline stages
- `EmbeddingProvider` / `AnswerProvider` — LLM integration
- `ConfigRepository` / `ConversationExporter` — config and log persistence

### Storage

- SQLite at `~/.agent-vault/agent-vault.sqlite` — cosine similarity computed in TypeScript (no vector extension)
- Config at `~/.agent-vault/agent-vault.json`, encrypted auth at `~/.agent-vault/auth.json`
- Optional Supabase backend with pgvector (migrations in `supabase/`)

### Ingestion Pipeline

FileScanner → ParserFactory (Text/PDF/Image) → DefaultChunker (800-token window, 120-token overlap) → EmbeddingProvider → VectorStore. File checksums prevent duplicate ingestion; `--reindex` forces refresh.

## CLI Surface

```
agent-vault configure          # interactive provider/model setup
agent-vault ingest             # discover, parse, chunk, embed, persist
agent-vault ask                # grounded Q&A with citations
agent-vault status             # config + index health
agent-vault doctor             # environment diagnostics
```

## Conventions

- Business logic lives in `@agent-vault/core` services, never in CLI command handlers.
- All provider/storage access goes through port interfaces — no direct imports of adapters in core.
- CLI output is deterministic key=value pairs for scripting; non-zero exit codes on errors.
- Prefer backward-compatible SQLite schema migrations.
- Credentials are not auto-loaded from `.env`; export them in your shell or use `agent-vault configure`.

## Environment Variables

No `.env` auto-loading. Export in shell:

```bash
export OPENAI_API_KEY=...
export AZURE_OPENAI_API_KEY=...
export AZURE_OPENAI_ENDPOINT=...
export AZURE_OPENAI_API_VERSION=2024-12-01-preview
```

## Package Names

| Directory              | Package name               |
|------------------------|----------------------------|
| `apps/cli`             | `@agent-vault/cli`         |
| `packages/core`        | `@agent-vault/core`        |
| `packages/ingestion`   | `@agent-vault/ingestion`   |
| `packages/retrieval`   | `@agent-vault/retrieval`   |
| `packages/storage`     | `@agent-vault/storage`     |
| `packages/providers`   | `@agent-vault/providers`   |
| `packages/shared`      | `@agent-vault/shared`      |
