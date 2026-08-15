use tauri::{command, AppHandle, Runtime};

use crate::models::*;
use crate::ChronosUpdateExt;
use crate::Result;

#[command]
pub(crate) async fn fetch_text<R: Runtime>(
    app: AppHandle<R>,
    payload: UrlRequest,
) -> Result<FetchedText> {
    app.chronos_update().fetch_text(payload)
}

#[command]
pub(crate) async fn download_and_install<R: Runtime>(
    app: AppHandle<R>,
    payload: UrlRequest,
) -> Result<InstallStarted> {
    app.chronos_update().download_and_install(payload)
}
