#![allow(dead_code)]
use jarvis_protocol::*;

pub fn full_usage() -> UsageEvent {
    UsageEvent {
        model: Some("claude-sonnet-5-5".into()),
        input_tokens: 1200,
        output_tokens: 340,
        cache_read_tokens: Some(9000),
        cache_write_tokens: Some(800),
        reasoning_tokens: Some(120),
        cost_usd: Some(0.0123),
        cost_source: Some(UsageSource::Reported),
    }
}

/// One instance of every EventKind variant.
pub fn all_kinds() -> Vec<EventKind> {
    vec![
        EventKind::Started {
            cwd: "/repo".into(),
            model: Some("gpt-6".into()),
            task: Some("fix bug".into()),
        },
        EventKind::State {
            state: SessionState::NeedsApproval,
        },
        EventKind::Message {
            role: Role::Assistant,
            text: "hello".into(),
        },
        EventKind::ToolCall {
            id: "t1".into(),
            name: "bash".into(),
            summary: "ls -la".into(),
        },
        EventKind::ToolResult {
            id: "t1".into(),
            ok: true,
        },
        EventKind::ApprovalRequest {
            id: "a1".into(),
            action: "rm -rf build".into(),
            risk: Some(Risk::High),
        },
        EventKind::SubagentSpawned {
            child_id: "s2".into(),
            task: "explore".into(),
        },
        EventKind::Progress {
            step: Some("tests".into()),
            pct: Some(42.5),
        },
        EventKind::Usage(full_usage()),
        EventKind::Error {
            message: "boom".into(),
        },
        EventKind::Finished {
            summary: Some("done".into()),
        },
    ]
}

pub fn event(kind: EventKind) -> AgentEvent {
    AgentEvent {
        session_id: "s1".into(),
        parent_id: Some("p0".into()),
        agent: AgentKind::Claude,
        ts: 1_764_000_000_000,
        kind,
    }
}

pub fn plan_snapshot() -> PlanUsageSnapshot {
    PlanUsageSnapshot {
        provider: Provider::Anthropic,
        account: "personal".into(),
        plan: Some("Max".into()),
        window: PlanWindow::FiveHour,
        used_pct: Some(63.0),
        used: None,
        limit: None,
        unit: None,
        resets_at: Some(1_764_010_000_000),
        source: UsageSource::Estimated,
        observed_at: 1_764_000_000_000,
    }
}
