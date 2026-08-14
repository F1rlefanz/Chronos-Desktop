use tauri::{command, AppHandle, Runtime};

use crate::models::*;
use crate::ChronosSafExt;
use crate::Result;

#[command]
pub(crate) async fn pick_folder<R: Runtime>(app: AppHandle<R>) -> Result<PickedFolder> {
    app.chronos_saf().pick_folder()
}

#[command]
pub(crate) async fn configure<R: Runtime>(
    app: AppHandle<R>,
    payload: ConfigureRequest,
) -> Result<Done> {
    app.chronos_saf().configure(payload)
}

#[command]
pub(crate) async fn list_files<R: Runtime>(
    app: AppHandle<R>,
    payload: RoleRequest,
) -> Result<FileNames> {
    app.chronos_saf().list_files(payload)
}

#[command]
pub(crate) async fn read_file<R: Runtime>(
    app: AppHandle<R>,
    payload: NameRequest,
) -> Result<FileContents> {
    app.chronos_saf().read_file(payload)
}

#[command]
pub(crate) async fn write_file<R: Runtime>(
    app: AppHandle<R>,
    payload: WriteRequest,
) -> Result<Done> {
    app.chronos_saf().write_file(payload)
}

#[command]
pub(crate) async fn write_bytes<R: Runtime>(
    app: AppHandle<R>,
    payload: WriteBytesRequest,
) -> Result<Done> {
    app.chronos_saf().write_bytes(payload)
}

#[command]
pub(crate) async fn delete_file<R: Runtime>(
    app: AppHandle<R>,
    payload: NameRequest,
) -> Result<Done> {
    app.chronos_saf().delete_file(payload)
}

#[command]
pub(crate) async fn open_document<R: Runtime>(
    app: AppHandle<R>,
    payload: OpenRequest,
) -> Result<Done> {
    app.chronos_saf().open_document(payload)
}
