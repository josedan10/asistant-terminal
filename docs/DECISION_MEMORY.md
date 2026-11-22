# Decision & Amendment Memory

## Purpose

Improve decisions and the way of working by learning from the instructions, amendments, and choices made during daily work.

Instead of only retrieving code (classic RAG), the system remembers:
- How you refine rough instructions
- What you change in agent outputs
- Explicit decisions and preferences ("we prefer X over Y because Z")

This memory is then used to make future free-model improvements and agent calls better aligned with your actual style and project decisions.

## What gets stored

1. **Instruction Amendments**
   - Rough input
   - Free-model improved version
   - Your final edited version
   - Optional tags or short reason ("too verbose", "missed constraint", "preferred approach")

2. **Decision Log** (lightweight)
   - Explicit decisions made during work
   - Rejected alternatives
   - Reasoning (optional)

3. **Accepted Outcomes**
   - Final accepted prompts or code changes that you kept

## How it's used

- **Free model (instruction improver)**: Retrieves similar past amendments and injects them as examples so it learns your preferred style and constraints.
- **Agents**: Can receive relevant past decisions and accepted patterns before acting.
- **Orchestrator**: Uses decision memory to route or constrain tasks more accurately.
- **You**: Can review or edit the memory (it's transparent).

## Storage approach (lightweight)

- Local: SQLite or simple JSON/Markdown files per project
- Synced via the existing GitHub session sync (so it travels with the project context across devices)
- Retrieval: Simple similarity (embeddings optional later) or keyword + recency

## Phased rollout

- **Phase 6**: Capture instruction amendments + basic retrieval into the free model
- Later: Decision log UI, agent injection, optional embeddings for better matching

## Relation to codebase RAG

Codebase retrieval (classic RAG) remains useful for grounding in current files and can be added later as a complementary module. Decision & Amendment Memory is the higher priority for improving *how* you work.
