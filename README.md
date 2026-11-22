# Assistant Terminal

Lightweight, cross-platform terminal built with **Tauri**.

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

- **Tauri 2** (Rust + WebView)
- **React** + TypeScript
- **xterm.js** for terminal panes
- **CodeMirror 6** for editor
- **react-resizable-panels** for layout

## Getting started

```bash
npm create tauri-app@latest
# Then follow the setup in this repo
```

## Status

Early scaffolding. See `docs/` for architecture and roadmap.
