use serde::de::DeserializeOwned;
use tauri::{plugin::PluginApi, AppHandle, Runtime};

use crate::models::*;

/// The desktop half exists so the crate compiles and lints everywhere, not
/// because it does anything: a desktop replaces its own install through Tauri's
/// updater. Every call here refuses rather than pretending.
pub fn init<R: Runtime, C: DeserializeOwned>(
    _app: &AppHandle<R>,
    _api: PluginApi<R, C>,
) -> crate::Result<ChronosUpdate<R>> {
    Ok(ChronosUpdate(std::marker::PhantomData))
}

/// `fn() -> R` rather than a plain `R`: Tauri keeps this in managed state,
/// which demands `Send + Sync`, and a bare `PhantomData<R>` inherits neither
/// from a runtime that does not promise them.
pub struct ChronosUpdate<R: Runtime>(std::marker::PhantomData<fn() -> R>);

impl<R: Runtime> ChronosUpdate<R> {
    pub fn fetch_text(&self, _payload: UrlRequest) -> crate::Result<FetchedText> {
        Err(crate::Error::UnsupportedPlatform)
    }

    pub fn download_and_install(&self, _payload: UrlRequest) -> crate::Result<InstallStarted> {
        Err(crate::Error::UnsupportedPlatform)
    }
}
