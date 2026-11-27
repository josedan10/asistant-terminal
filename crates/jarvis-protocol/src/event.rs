use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::usage::UsageEvent;

/// Which agent produced an event.
#[derive(Serialize, Deserialize, TS, Clone, Copy, Debug, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum AgentKind {
    Claude,
    Codex,
    Cursor,
    Gemini,
    Antigravity,
    Junie,
    Local,
    Generic,
}

/// Lifecycle state of an agent or subagent session.
#[derive(Serialize, Deserialize, TS, Clone, Copy, Debug, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum SessionState {
    Queued,
    Running,
    WaitingInput,
    NeedsApproval,
    Paused,
    Done,
    Failed,
    Stopped,
}

#[derive(Serialize, Deserialize, TS, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Role {
    Assistant,
    User,
}

#[derive(Serialize, Deserialize, TS, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Risk {
    Low,
    High,
}

/// A normalized event emitted by any agent adapter.
#[derive(Serialize, Deserialize, TS, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AgentEvent {
    pub session_id: String,
    /// Set for subagents: the parent session id (builds the agent tree).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub parent_id: Option<String>,
    pub agent: AgentKind,
    /// Unix epoch milliseconds.
    #[ts(type = "number")]
    pub ts: u64,
    pub kind: EventKind,
}

#[derive(Serialize, Deserialize, TS, Clone, Debug, PartialEq)]
#[serde(
    tag = "type",
    rename_all = "snake_case",
    rename_all_fields = "camelCase"
)]
pub enum EventKind {
    Started {
        cwd: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        #[ts(optional)]
        model: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        #[ts(optional)]
        task: Option<String>,
    },
    State {
        state: SessionState,
    },
    Message {
        role: Role,
        text: String,
    },
    ToolCall {
        id: String,
        name: String,
        summary: String,
    },
    ToolResult {
        id: String,
        ok: bool,
    },
    ApprovalRequest {
        id: String,
        action: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        #[ts(optional)]
        risk: Option<Risk>,
    },
    SubagentSpawned {
        child_id: String,
        task: String,
    },
    Progress {
        #[serde(default, skip_serializing_if = "Option::is_none")]
        #[ts(optional)]
        step: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        #[ts(optional)]
        pct: Option<f32>,
    },
    Usage(UsageEvent),
    Error {
        message: String,
    },
    Finished {
        #[serde(default, skip_serializing_if = "Option::is_none")]
        #[ts(optional)]
        summary: Option<String>,
    },
}
