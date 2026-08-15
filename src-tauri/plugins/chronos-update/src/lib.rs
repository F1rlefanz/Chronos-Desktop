//! Updating the app on a phone, which Android reserves to itself.
//!
//! The desktop replaces its own installation: Tauri's updater fetches a signed
//! bundle and swaps the files under the running program. Android does not allow
//! that to anyone. An app may *ask* for a package to be installed — it hands the
//! file to the system installer, which shows its own screen and its own consent
//! — and that asking is all this plugin does. There is no way to make it
//! silent, and a mechanism that installs software behind the user's back is not
//! one that should exist anyway.
//!
//! Tauri's own updater plugin says `Android: x` in its README and excludes
//! mobile by target in its install instructions, which is why this is here and
//! not a configuration of that.
//!
//! Only the Kotlin half does any real work; this crate is the seam that lets
//! the front end reach it, and it is registered on Android only.

use tauri::{
    plugin::{Builder, TauriPlugin},
    Manager, Runtime,
};

pub use models::*;

#[cfg(desktop)]
mod desktop;
#[cfg(mobile)]
mod mobile;

mod commands;
mod error;
mod models;

pub use error::{Error, Result};

#[cfg(desktop)]
use desktop::ChronosUpdate;
#[cfg(mobile)]
use mobile::ChronosUpdate;

pub trait ChronosUpdateExt<R: Runtime> {
    fn chronos_update(&self) -> &ChronosUpdate<R>;
}

impl<R: Runtime, T: Manager<R>> crate::ChronosUpdateExt<R> for T {
    fn chronos_update(&self) -> &ChronosUpdate<R> {
        self.state::<ChronosUpdate<R>>().inner()
    }
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("chronos-update")
        .invoke_handler(tauri::generate_handler![
            commands::fetch_text,
            commands::download_and_install
        ])
        .setup(|app, api| {
            #[cfg(mobile)]
            let chronos_update = mobile::init(app, api)?;
            #[cfg(desktop)]
            let chronos_update = desktop::init(app, api)?;
            app.manage(chronos_update);
            Ok(())
        })
        .build()
}
