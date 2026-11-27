use assert_cmd::Command;
use predicates::prelude::*;

#[test]
fn prints_version() {
    Command::cargo_bin("jarvis-relay")
        .unwrap()
        .arg("--version")
        .assert()
        .success()
        .stdout(predicate::str::contains(env!("CARGO_PKG_VERSION")));
}

#[test]
fn rejects_unknown_flags() {
    Command::cargo_bin("jarvis-relay")
        .unwrap()
        .arg("--nope")
        .assert()
        .failure();
}
