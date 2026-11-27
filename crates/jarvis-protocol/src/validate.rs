use crate::event::{AgentEvent, EventKind};
use crate::usage::{PlanUsageSnapshot, UsageEvent};

#[derive(thiserror::Error, Debug, Clone, PartialEq)]
pub enum ValidationError {
    #[error("{0} must not be empty")]
    Empty(&'static str),
    #[error("{field} out of range: {value}")]
    OutOfRange { field: &'static str, value: f64 },
    #[error("resetsAt must not be before observedAt")]
    ResetBeforeObserved,
}

/// Semantic checks that serde cannot express.
pub trait Validate {
    fn validate(&self) -> Result<(), ValidationError>;
}

fn non_empty(field: &'static str, value: &str) -> Result<(), ValidationError> {
    if value.is_empty() {
        Err(ValidationError::Empty(field))
    } else {
        Ok(())
    }
}

fn in_range(field: &'static str, value: f64, min: f64, max: f64) -> Result<(), ValidationError> {
    if value.is_finite() && (min..=max).contains(&value) {
        Ok(())
    } else {
        Err(ValidationError::OutOfRange { field, value })
    }
}

impl Validate for AgentEvent {
    fn validate(&self) -> Result<(), ValidationError> {
        non_empty("sessionId", &self.session_id)?;
        if let Some(p) = &self.parent_id {
            non_empty("parentId", p)?;
        }
        match &self.kind {
            EventKind::ToolCall { id, .. }
            | EventKind::ToolResult { id, .. }
            | EventKind::ApprovalRequest { id, .. } => non_empty("id", id),
            EventKind::SubagentSpawned { child_id, .. } => non_empty("childId", child_id),
            EventKind::Progress { pct: Some(p), .. } => in_range("pct", f64::from(*p), 0.0, 100.0),
            EventKind::Usage(u) => u.validate(),
            _ => Ok(()),
        }
    }
}

impl Validate for UsageEvent {
    fn validate(&self) -> Result<(), ValidationError> {
        match self.cost_usd {
            Some(c) => in_range("costUsd", c, 0.0, f64::MAX),
            None => Ok(()),
        }
    }
}

impl Validate for PlanUsageSnapshot {
    fn validate(&self) -> Result<(), ValidationError> {
        if let Some(p) = self.used_pct {
            in_range("usedPct", f64::from(p), 0.0, 100.0)?;
        }
        for (field, v) in [("used", self.used), ("limit", self.limit)] {
            if let Some(v) = v {
                in_range(field, v, 0.0, f64::MAX)?;
            }
        }
        match self.resets_at {
            Some(r) if r < self.observed_at => Err(ValidationError::ResetBeforeObserved),
            _ => Ok(()),
        }
    }
}
