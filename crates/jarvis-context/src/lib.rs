//! Context Broker (Phase 2+): builds lean, task-scoped context for agents.

/// Default token budget for a task's context pack brief.
pub const DEFAULT_PACK_TOKEN_BUDGET: usize = 3_000;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_budget_is_lean() {
        assert!((1_000..=3_000).contains(&DEFAULT_PACK_TOKEN_BUDGET));
    }
}
