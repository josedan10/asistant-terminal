//! Agent adapters (Phase 2). Phase 0 holds recorded fixtures and their tests.

pub use jarvis_protocol::AgentKind;

/// Agents Jarvis plans to support, in adapter-matrix order.
pub const SUPPORTED_AGENTS: [AgentKind; 7] = [
    AgentKind::Claude,
    AgentKind::Codex,
    AgentKind::Cursor,
    AgentKind::Gemini,
    AgentKind::Junie,
    AgentKind::Local,
    AgentKind::Antigravity,
];

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    #[test]
    fn supported_agents_are_unique() {
        let set: HashSet<_> = SUPPORTED_AGENTS.iter().collect();
        assert_eq!(set.len(), SUPPORTED_AGENTS.len());
    }
}
