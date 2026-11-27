mod ready;

#[tauri::command]
fn app_ready(ms: u64) {
    if ready::bench_enabled(std::env::var("JARVIS_BENCH").ok().as_deref()) {
        println!("{}", ready::ready_line(ms));
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![app_ready])
        .run(tauri::generate_context!())
        .expect("error while running Jarvis");
}
