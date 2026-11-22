# Architecture

## Overview

Tauri app with:
- Frontend: React + TypeScript
- Terminal: xterm.js + PTY (via tauri-plugin-pty or portable-pty)
- Editor: CodeMirror 6
- Layout: react-resizable-panels
- AI Panel: Free model improver + multi-agent executor + **RAG module**

## AI Flow

1. User enters rough instructions
2. Free model (Ollama / Groq / Gemini) improves and structures them (optionally with RAG context)
3. User reviews/edits (human-in-the-loop)
4. Selected agent (Claude, Grok, etc.) or orchestrator executes (with RAG context)
5. Session state synced via GitHub

## RAG Module

Retrieval-Augmented Generation to ground AI responses in the actual project:
- Indexes codebase, docs, and session history
- Provides relevant context to the free model and agents
- Improves accuracy and reduces hallucinations

See `docs/RAG_MODULE.md` for details.

## Agents

- Direct call or orchestrator-driven
- Tools: bash, file ops, git, etc.
- Can receive RAG-retrieved context
