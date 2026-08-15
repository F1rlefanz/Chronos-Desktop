use serde::de::DeserializeOwned;
use tauri::{
    plugin::{PluginApi, PluginHandle},
    AppHandle, Runtime,
};

use crate::models::*;

/// Hands both calls to the Kotlin class, which is where the download and the
/// system installer actually live. Nothing is interpreted on the way through.
pub fn init<R: Runtime, C: DeserializeOwned>(
    _app: &AppHandle<R>,
    api: PluginApi<R, C>,
) -> crate::Result<ChronosUpdate<R>> {
    let handle = api.register_android_plugin("de.f1rlefanz.chronos.update", "ChronosUpdatePlugin")?;
    Ok(ChronosUpdate(handle))
}

pub struct ChronosUpdate<R: Runtime>(PluginHandle<R>);

impl<R: Runtime> ChronosUpdate<R> {
    pub fn fetch_text(&self, payload: UrlRequest) -> crate::Result<FetchedText> {
        self.0
            .run_mobile_plugin("fetchText", payload)
            .map_err(Into::into)
    }

    pub fn download_and_install(&self, payload: UrlRequest) -> crate::Result<InstallStarted> {
        self.0
            .run_mobile_plugin("downloadAndInstall", payload)
            .map_err(Into::into)
    }
}
