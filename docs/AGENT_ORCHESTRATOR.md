# Agent Orchestrator Design

> Superseded in part by `COMMAND_CENTER.md` (adapter tiers, event model). Orchestrator work is now Phase 6.

## Goal

Allow agents (Claude, Grok, Gemini, Codex, Junie) to be called:

- Directly by the user
- By an orchestrator that routes subtasks

## Architecture

```text
User / Free-model improver
        ↓
   Orchestrator (optional)
        ↓
┌────────────────────────────────┐
│  Agent Pool                         │
│  • Claude   (strong coding)         │
│  • Grok     (fast + tool use)       │
│  • Gemini   (free / multimodal)     │
│  • Codex    (OpenAI coding)         │
│  • Junie    (if API available)      │
└────────────────────────────────┘
        ↓
Tools (bash, file ops, git, search…)
        ↓
Results streamed to AI panel
```

## Orchestrator Behavior

- Receives refined prompt + context
- Breaks into subtasks if needed
- Routes to the best agent based on task type
- Can be a lightweight model or simple rules-based router
- User can always override and call an agent directly

## Tools available to agents

- Run terminal commands
- Read / write files
- Git operations
- Search codebase
- (Future) Browser, etc.
