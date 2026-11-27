mod common;
use common::*;

#[test]
fn event_wire_format_is_stable() {
    let events: Vec<_> = all_kinds().into_iter().map(event).collect();
    insta::assert_json_snapshot!("agent_events", events);
}

#[test]
fn plan_snapshot_wire_format_is_stable() {
    insta::assert_json_snapshot!("plan_usage_snapshot", plan_snapshot());
}
