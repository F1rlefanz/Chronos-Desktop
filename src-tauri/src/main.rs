// Hides the console window that Windows would otherwise open behind the app.
// Kept in debug builds so `tauri dev` can still print to the terminal.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    chronos_desktop_lib::run()
}
