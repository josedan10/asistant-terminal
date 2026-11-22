# Architecture

## Overview

Tauri app with:
- Frontend: React + TypeScript
- Terminal: xterm.js + PTY (via tauri-plugin-pty or portable-pty)
- Editor: CodeMirror 6
- Layout: react-resizable-panels
- AI Panel: Free model improver + multi-agent executor + **Decision & Amendment Memory**

## AI Flow

1. User enters rough instructions
2. Free model improves and structures them (using past amendments as examples)
3. User reviews/edits (human-in-the-loop)
4. Amendment is stored in Decision & Amendment Memory
5. Selected agent or orchestrator executes (optionally with relevant past decisions)
6. Session state (including memory) synced via GitHub

## Decision & Amendment Memory

Learns from the instructions, refinements, and decisions made during daily work so future interactions are better aligned with how you actually prefer to work.

See `docs/DECISION_MEMORY.md` for details.

## Agents

- Direct call or orchestrator-driven
- Tools: bash, file ops, git, etc.
- Can receive relevant past decisions and accepted patterns
