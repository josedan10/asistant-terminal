//! Readiness signal consumed by the memory benchmark (`jarvis-bench`).

/// Prefix the benchmark waits for on stdout.
pub const READY_PREFIX: &str = "JARVIS_READY";

/// The benchmark sets `JARVIS_BENCH=1`; nothing is printed otherwise.
pub fn bench_enabled(value: Option<&str>) -> bool {
    matches!(value, Some("1") | Some("true"))
}

pub fn ready_line(ms: u64) -> String {
    format!("{READY_PREFIX} {ms}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ready_line_has_prefix_and_ms() {
        assert_eq!(ready_line(812), "JARVIS_READY 812");
    }

    #[test]
    fn bench_flag_parsing() {
        assert!(bench_enabled(Some("1")));
        assert!(bench_enabled(Some("true")));
        assert!(!bench_enabled(Some("0")));
        assert!(!bench_enabled(Some("")));
        assert!(!bench_enabled(None));
    }
}
