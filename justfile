# Jarvis task runner. Run `just` to list recipes.
set shell := ["bash", "-euo", "pipefail", "-c"]

checks := "pnpm --filter @jarvis/checks exec tsx src/cli.ts"

default:
    @just --list

# One-time setup: verify Node, install deps, install git hooks
setup:
    @req="$(tr -dc '0-9' < .nvmrc)"; cur="$(node -p 'process.versions.node.split(".")[0]')"; \
      [ "$cur" = "$req" ] || { echo "Node $req is required (from .nvmrc) but $(node -v) is active. Run: nvm use"; exit 1; }
    pnpm install --frozen-lockfile
    {{checks}} node-version
    lefthook install

# Run the desktop app in dev mode
dev:
    pnpm --filter desktop tauri dev

# Build everything (Rust workspace + TS packages)
build:
    cargo build --workspace --all-targets
    pnpm -r --if-present build

# Run all tests (Rust + TS)
test:
    cargo nextest run --workspace --no-tests=pass
    pnpm -r --if-present test

# Lint everything; fails on any warning
lint:
    cargo fmt --all --check
    cargo clippy --workspace --all-targets -- -D warnings
    pnpm exec biome ci .
    pnpm -r --if-present typecheck

# Format everything
fmt:
    cargo fmt --all
    pnpm exec biome check --write .

# Regenerate TS protocol types from Rust
gen:
    rm -rf packages/protocol/src/generated
    TS_RS_EXPORT_DIR="{{justfile_directory()}}/packages/protocol/src/generated" cargo test -p jarvis-protocol --lib export_bindings --quiet
    cd packages/protocol/src/generated && ls *.ts | sort | sed 's/\.ts$//' | awk '{print "export type * from \"./" $0 "\";"}' > index.tmp && mv index.tmp index.ts

# Fail if generated TS types are out of date
gen-check: gen
    git diff --exit-code -- packages/protocol/src/generated
    test -z "$(git status --porcelain -- packages/protocol/src/generated)"

# Security & policy audit
audit:
    {{checks}} tauri-hardening
    {{checks}} workflow-lint
    {{checks}} ignore-policy
    cargo deny check
    osv-scanner scan source -r . --config osv-scanner.toml
    gitleaks git --no-banner --redact

# Memory benchmark (Phase 0, Track B)
bench *args:
    cargo run -p jarvis-bench --release -- {{args}}

# Sanitize a raw agent capture into a fixture
sanitize raw out agent version:
    {{checks}} sanitize "{{raw}}" "{{out}}" "{{agent}}" "{{version}}"
