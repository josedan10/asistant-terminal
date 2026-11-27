mod common;
use common::*;
use jarvis_protocol::*;

#[test]
fn unknown_type_tag_is_an_error_not_a_panic() {
    let json = r#"{"sessionId":"s1","agent":"claude","ts":1,"kind":{"type":"teleport"}}"#;
    assert!(serde_json::from_str::<AgentEvent>(json).is_err());
}

#[test]
fn unknown_agent_kind_is_an_error() {
    let json = r#"{"sessionId":"s1","agent":"skynet","ts":1,"kind":{"type":"finished"}}"#;
    assert!(serde_json::from_str::<AgentEvent>(json).is_err());
}

#[test]
fn negative_token_count_is_rejected() {
    assert!(serde_json::from_str::<UsageEvent>(r#"{"inputTokens":-1,"outputTokens":0}"#).is_err());
}

#[test]
fn valid_values_pass_validation() {
    for k in all_kinds() {
        event(k).validate().unwrap();
    }
    plan_snapshot().validate().unwrap();
}

#[test]
fn empty_session_id_fails_validation() {
    let mut ev = event(EventKind::Finished { summary: None });
    ev.session_id.clear();
    assert_eq!(ev.validate(), Err(ValidationError::Empty("sessionId")));
}

#[test]
fn progress_pct_out_of_range_fails() {
    let ev = event(EventKind::Progress {
        step: None,
        pct: Some(150.0),
    });
    assert!(matches!(
        ev.validate(),
        Err(ValidationError::OutOfRange { field: "pct", .. })
    ));
}

#[test]
fn negative_cost_fails() {
    let mut u = full_usage();
    u.cost_usd = Some(-0.5);
    assert!(matches!(
        u.validate(),
        Err(ValidationError::OutOfRange {
            field: "costUsd",
            ..
        })
    ));
}

#[test]
fn plan_used_pct_out_of_range_fails() {
    let mut s = plan_snapshot();
    s.used_pct = Some(101.0);
    assert!(s.validate().is_err());
}

#[test]
fn plan_reset_before_observation_fails() {
    let mut s = plan_snapshot();
    s.resets_at = Some(s.observed_at - 1);
    assert_eq!(s.validate(), Err(ValidationError::ResetBeforeObserved));
}

#[test]
fn nan_cost_fails() {
    let mut u = full_usage();
    u.cost_usd = Some(f64::NAN);
    assert!(u.validate().is_err());
}
