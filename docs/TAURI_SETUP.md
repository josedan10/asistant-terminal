# Tauri Setup Outline

> Superseded by `TECH_STACK.md` (monorepo layout, versions). The desktop app lives in `apps/desktop` and is an IPC client of `jarvisd`.

## Create the project

```bash
npm create tauri-app@latest
# Choose: React + TypeScript + Vite
```

## Recommended dependencies

```bash
npm install react-resizable-panels
npm install @xterm/xterm @xterm/addon-fit @xterm/addon-webgl
npm install @codemirror/state @codemirror/view @codemirror/lang-javascript
# + tauri-plugin-pty or portable-pty for real terminals
```

## High-level structure

```
src/
  components/
    TerminalPane.tsx
    Editor.tsx
    AIPanel.tsx
    Layout.tsx
  lib/
    agents.ts          # agent runners
    freeModel.ts       # instruction improver
    session.ts         # GitHub sync
  App.tsx
src-tauri/
  src/
    main.rs
    commands.rs        # PTY, file ops, etc.
```

## Next steps

1. Scaffold with `npm create tauri-app`
2. Add the layout with react-resizable-panels
3. Wire xterm.js panes
4. Add AI panel with free-model step
5. Connect first agent (Claude or Grok)
