# Architecture

## Overview

Tauri app with:
- Frontend: React + TypeScript
- Terminal: xterm.js + PTY (via tauri-plugin-pty or portable-pty)
- Editor: CodeMirror 6
- Layout: react-resizable-panels
- AI Panel: Free model improver + multi-agent executor

## AI Flow

1. User enters rough instructions
2. Free model (Ollama / Groq / Gemini) improves and structures them
3. User reviews/edits (human-in-the-loop)
4. Selected agent (Claude, Grok, etc.) or orchestrator executes
5. Session state synced via GitHub

## Agents

- Direct call or orchestrator-driven
- Tools: bash, file ops, git, etc.
