//! Reading and writing one folder the user picked, on Android.
//!
//! The desktop opens the shared sync folder with `std::fs` over a real path,
//! writes through a temporary file and renames it into place. Android gives no
//! such path: the system picker hands back a *permission on a document tree*
//! (`content://…/tree/…`), and everything after that goes through a content
//! provider. That is a different enough animal to deserve its own plugin
//! rather than a branch inside the app's storage commands.
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
use desktop::ChronosSaf;
#[cfg(mobile)]
use mobile::ChronosSaf;

pub trait ChronosSafExt<R: Runtime> {
    fn chronos_saf(&self) -> &ChronosSaf<R>;
}

impl<R: Runtime, T: Manager<R>> crate::ChronosSafExt<R> for T {
    fn chronos_saf(&self) -> &ChronosSaf<R> {
        self.state::<ChronosSaf<R>>().inner()
    }
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("chronos-saf")
        .invoke_handler(tauri::generate_handler![
            commands::pick_folder,
            commands::configure,
            commands::list_files,
            commands::read_file,
            commands::write_file,
            commands::write_bytes,
            commands::delete_file,
            commands::open_document
        ])
        .setup(|app, api| {
            #[cfg(mobile)]
            let chronos_saf = mobile::init(app, api)?;
            #[cfg(desktop)]
            let chronos_saf = desktop::init(app, api)?;
            app.manage(chronos_saf);
            Ok(())
        })
        .build()
}
