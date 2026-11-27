use clap::Parser;

/// Jarvis cloud relay: daemon WSS and remote MCP endpoint (Phase 0 stub).
#[derive(Parser)]
#[command(name = "jarvis-relay", version, about)]
struct Cli {}

fn main() {
    let _cli = Cli::parse();
    println!(
        "jarvis-relay {} — not implemented yet (Phase 0 stub)",
        env!("CARGO_PKG_VERSION")
    );
}
