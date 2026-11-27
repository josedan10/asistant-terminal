mod common;
use common::*;
use jarvis_protocol::*;

#[test]
fn every_event_variant_roundtrips() {
    for kind in all_kinds() {
        let ev = event(kind);
        let json = serde_json::to_string(&ev).unwrap();
        let back: AgentEvent = serde_json::from_str(&json).unwrap();
        assert_eq!(back, ev, "roundtrip failed for {json}");
    }
}

#[test]
fn plan_snapshot_roundtrips() {
    let s = plan_snapshot();
    let back: PlanUsageSnapshot =
        serde_json::from_str(&serde_json::to_string(&s).unwrap()).unwrap();
    assert_eq!(back, s);
}

#[test]
fn usage_with_only_required_fields() {
    let u: UsageEvent = serde_json::from_str(r#"{"inputTokens":10,"outputTokens":5}"#).unwrap();
    assert_eq!(u.input_tokens, 10);
    assert_eq!(u.output_tokens, 5);
    assert!(
        u.cache_read_tokens.is_none()
            && u.cache_write_tokens.is_none()
            && u.reasoning_tokens.is_none()
    );
    assert!(u.cost_usd.is_none() && u.cost_source.is_none() && u.model.is_none());
}

#[test]
fn unknown_fields_are_ignored() {
    let json = r#"{"sessionId":"s1","agent":"codex","ts":1,"futureField":true,
        "kind":{"type":"tool_result","id":"t1","ok":false,"extra":"x"}}"#;
    let ev: AgentEvent = serde_json::from_str(json).unwrap();
    assert_eq!(
        ev.kind,
        EventKind::ToolResult {
            id: "t1".into(),
            ok: false
        }
    );
    assert_eq!(ev.parent_id, None);
}

mod props {
    use super::*;
    use proptest::prelude::*;

    fn text() -> impl Strategy<Value = String> {
        "[a-zA-Z0-9 _./-]{0,24}"
    }

    fn usage() -> impl Strategy<Value = UsageEvent> {
        (
            any::<u64>(),
            any::<u64>(),
            proptest::option::of(any::<u64>()),
            proptest::option::of(0.0f64..1e6),
        )
            .prop_map(|(i, o, c, cost)| UsageEvent {
                model: None,
                input_tokens: i,
                output_tokens: o,
                cache_read_tokens: c,
                cache_write_tokens: None,
                reasoning_tokens: None,
                cost_usd: cost,
                cost_source: Some(UsageSource::Estimated),
            })
    }

    fn kind() -> impl Strategy<Value = EventKind> {
        prop_oneof![
            (text(), proptest::option::of(text())).prop_map(|(cwd, task)| EventKind::Started {
                cwd,
                model: None,
                task
            }),
            (text(), text(), text()).prop_map(|(id, name, summary)| EventKind::ToolCall {
                id,
                name,
                summary
            }),
            (text(), any::<bool>()).prop_map(|(id, ok)| EventKind::ToolResult { id, ok }),
            (
                proptest::option::of(text()),
                proptest::option::of(0.0f32..=100.0)
            )
                .prop_map(|(step, pct)| EventKind::Progress { step, pct }),
            usage().prop_map(EventKind::Usage),
            text().prop_map(|message| EventKind::Error { message }),
        ]
    }

    proptest! {
        #[test]
        fn serialize_then_deserialize_is_identity(k in kind(), ts in any::<u64>()) {
            let ev = AgentEvent { session_id: "s".into(), parent_id: None, agent: AgentKind::Generic, ts, kind: k };
            let back: AgentEvent = serde_json::from_str(&serde_json::to_string(&ev).unwrap()).unwrap();
            prop_assert_eq!(back, ev);
        }
    }
}
