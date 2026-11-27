//! Shared protocol types for Jarvis.
//!
//! Rust is the single source of truth: TypeScript bindings in `packages/protocol`
//! are generated from these types with `just gen` (ts-rs).

mod event;
mod usage;
mod validate;

pub use event::{AgentEvent, AgentKind, EventKind, Risk, Role, SessionState};
pub use usage::{PlanUsageSnapshot, PlanWindow, Provider, UsageEvent, UsageSource, UsageUnit};
pub use validate::{Validate, ValidationError};

#[cfg(test)]
mod export {
    use super::*;
    use ts_rs::TS;

    /// Writes TS bindings to `TS_RS_EXPORT_DIR`. Run via `just gen`.
    #[test]
    fn export_bindings() {
        if std::env::var_os("TS_RS_EXPORT_DIR").is_none() {
            return; // only `just gen` writes bindings
        }
        let cfg = ts_rs::Config::from_env();
        AgentEvent::export_all(&cfg).expect("export AgentEvent");
        PlanUsageSnapshot::export_all(&cfg).expect("export PlanUsageSnapshot");
    }
}
