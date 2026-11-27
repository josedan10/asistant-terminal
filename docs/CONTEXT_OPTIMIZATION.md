# Context Optimization

## Goal

Each agent should get **only the context the task needs**, not the whole project. This means
fewer tokens, lower cost, faster responses and better focus. It also makes prompt injection harder,
because less untrusted content reaches the model.

## Principle: pull, don't push

Don't stuff the prompt up front. Give the agent:
1. a small, task-scoped **brief** (pushed), and
2. **precise retrieval tools** it calls when it needs more (pulled).

The agents run in different CLIs, so the common interface is **MCP**. Claude Code, Codex,
Cursor, Gemini CLI and most others support MCP servers, which means one context layer can serve
every agent.

## Architecture: Context Broker (inside `jarvisd`)

```text
Task ──▶ Context Broker ──▶ (1) Context Pack (brief, ~1–3k tokens) ──▶ agent prompt / AGENTS.md
              │
              ├──▶ (2) MCP config injected at launch ──▶ agent pulls on demand:
              │        • code-nav MCP (symbols, references, definitions)
              │        • docs MCP (up-to-date library docs, version-pinned)
              │        • jarvis MCP (decisions, task info, sibling-task results)
              │
              └──▶ (3) Scope rules: ignore lists + read allowlist per task
```

### 1. Context Pack (per task)
Built by the daemon before dispatch:
- the task (after the instruction improver, Phase 11)
- a **repo map**: a compact outline of the relevant modules and their key symbols. It is built with
  tree-sitter and ranked by the reference graph (the technique Aider's repo-map popularized), and
  trimmed to a token budget.
- the candidate files: paths only, ranked. The agent reads them itself if needed.
- the relevant **decisions** from Decision & Amendment Memory: top-k items, user-confirmed only
- the conventions: the nearest `AGENTS.md` / `CLAUDE.md` for the touched directory, not every one

### 2. Retrieval tools (MCP), the recommended stack

| Need | Recommendation | Why |
|------|----------------|-----|
| Code navigation | **Serena** (LSP-backed MCP: find symbol, references, symbol-level edits) | The agent reads a function instead of a whole file; works across languages through language servers; agent-agnostic via MCP |
| Repo map / outline | **tree-sitter** in Rust (our own module) | Fast, local, low memory; no embedding service required |
| Library docs | **Context7** (MCP, version-specific docs) | Stops agents from pulling outdated docs or dumping whole READMEs |
| Semantic search (optional, later) | Local embeddings index (e.g. sqlite-vec + a small local embedding model) | Only if symbol and keyword search prove not to be enough; see `RAG_MODULE.md` |
| Project memory | **jarvis MCP** (ours): `get_decisions`, `get_task`, `get_sibling_results` | Shares orchestrator and memory context without copying it into every prompt |

> ⚠️ Verify these in the Phase 0 spikes: current maintenance status, license, memory use, and how
> each agent CLI loads per-session MCP config. Pin versions. Every MCP server is part of the attack
> surface (see `SECURITY.md`).

### 3. Scope rules
- A shared ignore list generated for every agent (`.gitignore`, plus build output, lockfiles,
  vendored and generated code, binaries and large fixtures), mapped to each agent's own mechanism
  (permission deny rules, `.cursorignore`, and so on).
- A per-task read allowlist when the task names a module. Reads outside it go through the approval
  policy.
- Subagents get **their own small pack**, never the parent's full transcript.

### 4. Agent-native techniques the adapters turn on
- **Skills / progressive disclosure:** instructions load only when relevant (Claude Code skills,
  equivalent rules files elsewhere). Keep `.atl/skill-registry.md` as the index.
- **Subagents for exploration:** wide searches run in a child context, and only the conclusion
  comes back.
- **Prompt caching:** keep the brief's stable prefix (conventions, repo map) byte-identical across
  turns so providers can cache it.
- **Compaction thresholds:** prefer a fresh session with a handoff summary over endlessly
  compacting long sessions.

## Measuring it (shown on the board)

Per session and per task:
- input tokens, cached tokens and the cache-hit ratio
- **context efficiency:** tokens read vs. files actually changed or cited
- top token sinks: which reads or tool outputs cost the most

The benchmark repo has golden tasks. A change to the broker must not raise tokens per task without
improving the success rate.

## Rollout
- **Phase 2:** ignore lists + MCP config injection (Serena, Context7) for each adapter.
- **Phase 6:** Context Packs for backlog tasks (repo map + candidate files + decisions); the jarvis MCP.
- **Phase 11:** decisions from memory feed the pack; context-efficiency metrics drive tuning.
- **Later:** optional local semantic index.
