# Assistant Terminal

Lightweight, cross-platform terminal built with **Tauri**, designed as a command center ("Jarvis") for launching, supervising and operating coding agents and their subagents (Claude Code, Codex, Cursor, Gemini/Antigravity, Junie and local models), with a low memory footprint.

A mobile app lets you monitor progress and queue backlog tasks that your connected computer picks up and works through while you're away. Any MCP-capable assistant (ChatGPT, Claude, …) can connect to it to browse your projects and queue tasks.

See `docs/COMMAND_CENTER.md`, `docs/REMOTE_AND_MOBILE.md`, `docs/CONTEXT_OPTIMIZATION.md`, `docs/MCP_GATEWAY.md`, `docs/SECURITY.md`, `docs/USAGE_MONITORING.md` and `docs/ROADMAP.md`.

## Features (planned)

- Terminal panes with split & resize
- Lightweight editor (CodeMirror)
- AI panel with:
  - Free model for instruction improvement (human-in-the-loop)
  - Multi-agent support (Claude, Grok, Gemini, Codex, Junie)
  - Orchestrator for task routing
- Drag & drop files
- Highlight code and send to AI context
- Git integration (history, diffs, PRs)
- Session sync across devices via GitHub

## Stack

Rust daemon (`jarvisd`) + **Tauri 2** desktop (React 19, TypeScript, xterm.js, Zustand) + **Expo** mobile + **Supabase** and a Rust relay on Fly.io. See `docs/TECH_STACK.md`.

## Getting started

```bash
npm create tauri-app@latest
# Then follow the setup in this repo
```

## Status

Early scaffolding. See `docs/` for architecture and roadmap.
