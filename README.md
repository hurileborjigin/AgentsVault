# AgentVault

CLI-first RAG system for project knowledge.

AgentVault indexes local files into a vector database and exposes a lightweight CLI interface for grounded question answering. It is designed to work alongside coding agents such as OpenClaw, Claude Code, Codex, or any automation tool that can call shell commands.

Instead of repeatedly scanning entire repositories, AgentVault performs semantic retrieval over a pre-built index and returns only the relevant context needed to answer a question.

This significantly reduces token usage, latency, and cost when working with large local projects.

## Why AgentVault

Modern coding agents often answer questions by reading large portions of a repository. While effective, this approach becomes expensive and slow when projects grow.

AgentVault introduces a retrieval layer between the agent and the filesystem.

The workflow becomes:

Agent → AgentVault CLI → Vector Retrieval → Grounded Answer

## Key advantages:

Token efficient – avoids repeatedly loading entire codebases

Agent friendly – simple CLI interface that agents can call directly

Local-first – no external vector database required

Deterministic outputs – predictable CLI responses for automation

Auditable interactions – all queries saved as markdown logs

AgentVault acts as a knowledge gateway for local repositories, allowing agents to query project knowledge instead of scanning files every time.
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
- OpenAI or Azure OpenAI credentials, **or** [Ollama](https://ollama.com) for local models

## Installation

```bash
npm install -g agents-vault
```

Then run:

```bash
agents-vault --help
```

## Quick Start

```bash
agents-vault configure
agents-vault ingest --source ./docs --project my-project
agents-vault ask "How does auth work?" --project my-project
```

### From source

```bash
pnpm install
pnpm build
node apps/cli/dist/index.js --help
```

## Command Reference

Top-level help:

```bash
agents-vault --help
```

Configure provider and model:

```bash
agents-vault configure
```

Ingest project documents:

```bash
agents-vault ingest --source ./docs --project my-project
agents-vault ingest --source ./docs --project my-project --reindex
```

Ask grounded questions:

```bash
agents-vault ask "How does configuration work?" --project my-project
agents-vault ask "What is the architecture?" --project my-project --top-k 6
```

Health/status:

```bash
agents-vault status --project my-project
agents-vault doctor
```

## Configuration and Secrets

Agent Vault uses two files in `~/.agents-vault/`:

- `agents-vault.json`: non-secret config (provider, models, output directory, db path, default project).
- `auth.json`: encrypted credentials.
- `auth.key`: local encryption key used to decrypt `auth.json`.

Behavior:

- `agents-vault configure` updates provider/model config and can capture credentials interactively.
- At runtime, credentials are loaded into process environment from the encrypted auth vault.
- You can still provide credentials through shell environment variables if preferred.

## Using Ollama (Local Models)

Agent Vault supports [Ollama](https://ollama.com) for fully local inference — no API keys, no cloud calls.

### 1. Install Ollama

```bash
# macOS
brew install ollama

# or download from https://ollama.com/download
```

### 2. Pull models

You need one model for answering questions and one for generating embeddings.

```bash
# Start the Ollama server
ollama serve

# Pull an answer model
ollama pull gpt-oss:20b

# Pull an embedding model
ollama pull embeddinggemma
```

Other popular combinations:

| Answer model | Embedding model | Notes |
|---|---|---|
| `gpt-oss:20b` | `embeddinggemma` | Recommended — strong reasoning + fast embeddings |
| `llama3.2` | `nomic-embed-text` | Lightweight, good for smaller machines |
| `mistral` | `mxbai-embed-large` | Balanced quality and speed |
| `qwen2:7b` | `nomic-embed-text` | Good multilingual support |

### 3. Configure Agent Vault

```bash
agents-vault configure
```

Select **Ollama (Local)** when prompted. Agent Vault will auto-discover your pulled models:

```
? Select LLM provider: Ollama (Local)
? Ollama base URL: http://localhost:11434
Discovering local models...
? Select answer model: gpt-oss:20b
? Select embedding model: embeddinggemma
✔ Configuration saved
```

No API keys are needed — Ollama runs entirely on your machine.

### 4. Ingest and ask

```bash
agents-vault ingest --source ./my-docs --project my-project
agents-vault ask "What does this project do?" --project my-project
```

### Troubleshooting Ollama

- Make sure `ollama serve` is running before using `ingest` or `ask`.
- If embedding fails mid-ingest, retry with `--reindex`. Large batches can occasionally cause Ollama's internal subprocess to restart.
- To verify Ollama is reachable: `curl http://localhost:11434/api/tags`
- If using a non-default port or remote Ollama instance, specify the base URL during `agents-vault configure`.

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
packages/providers  # OpenAI/Azure/Ollama providers + OCR/vision stubs
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
pnpm --filter @agents-vault/cli build
pnpm --filter @agents-vault/cli test
```

## Troubleshooting

- Run `agents-vault doctor` first for environment/config/storage checks.
- If commands fail globally, relink:

```bash
cd apps/cli
pnpm link --global
```

- If provider calls fail, rerun `agents-vault configure` and re-enter credentials.

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

MIT — see [LICENSE](./LICENSE).
