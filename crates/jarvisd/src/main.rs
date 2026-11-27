use clap::Parser;

/// Jarvis background daemon: sessions, PTY, store, runner, sync (Phase 0 stub).
#[derive(Parser)]
#[command(name = "jarvisd", version, about)]
struct Cli {}

fn main() {
    let _cli = Cli::parse();
    println!(
        "jarvisd {} — not implemented yet (Phase 0 stub)",
        env!("CARGO_PKG_VERSION")
    );
}
