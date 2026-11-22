# RAG Module

## Purpose

Improve the AI workflow by giving agents and the instruction improver better context from:
- The current project codebase
- Documentation
- Previous sessions / chat history
- Git history and diffs
- User-selected files or highlighted code

RAG reduces hallucinations and makes responses more accurate to the actual project.

## What gets indexed

- Source files (with embeddings)
- README, docs, comments
- Recent terminal commands and outputs (optional)
- AI conversation history (per project)
- Selected code snippets

## When it's used

1. **Free model (instruction improver)** — retrieves relevant files/context before rewriting the prompt.
2. **Agents (Claude, Grok, etc.)** — retrieve context before generating or editing code.
3. **Orchestrator** — can pull context for routing decisions.
4. **Manual** — user can ask "what does this function do?" and get grounded answers.

## Recommended approach (lightweight)

- **Local embeddings**: `nomic-embed-text` or `all-MiniLM` via Ollama / sentence-transformers
- **Vector store**: SQLite + `sqlite-vss` or LanceDB (lightweight, local)
- **Retrieval**: Top-k chunks + metadata (file path, line numbers)
- **Injection**: Append retrieved context to the prompt sent to the free model or agent

## Integration points

- On project open → background index (or incremental)
- On file save / git commit → update index
- In AI panel → "Include RAG context" toggle
- Session sync → optionally sync index metadata (not full vectors) via GitHub

## Phased addition

- **Phase 6** (after core AI panel): Basic file indexing + retrieval
- Later: Git-aware retrieval, conversation memory, multi-project support
