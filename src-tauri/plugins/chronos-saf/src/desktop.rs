use serde::de::DeserializeOwned;
use tauri::{plugin::PluginApi, AppHandle, Runtime};

use crate::models::*;

/// The desktop half exists so the crate compiles and lints everywhere, not
/// because it does anything: a desktop reaches its folders with a real path and
/// an atomic rename, through the app's own commands. Every call here refuses
/// rather than pretending.
pub fn init<R: Runtime, C: DeserializeOwned>(
    _app: &AppHandle<R>,
    _api: PluginApi<R, C>,
) -> crate::Result<ChronosSaf<R>> {
    Ok(ChronosSaf(std::marker::PhantomData))
}

/// `fn() -> R` rather than a plain `R`: Tauri keeps this in managed state,
/// which demands `Send + Sync`, and a bare `PhantomData<R>` inherits neither
/// from a runtime that does not promise them.
pub struct ChronosSaf<R: Runtime>(std::marker::PhantomData<fn() -> R>);

impl<R: Runtime> ChronosSaf<R> {
    pub fn pick_folder(&self) -> crate::Result<PickedFolder> {
        Err(crate::Error::UnsupportedPlatform)
    }

    pub fn configure(&self, _payload: ConfigureRequest) -> crate::Result<Done> {
        Err(crate::Error::UnsupportedPlatform)
    }

    pub fn list_files(&self, _payload: RoleRequest) -> crate::Result<FileNames> {
        Err(crate::Error::UnsupportedPlatform)
    }

    pub fn read_file(&self, _payload: NameRequest) -> crate::Result<FileContents> {
        Err(crate::Error::UnsupportedPlatform)
    }

    pub fn write_file(&self, _payload: WriteRequest) -> crate::Result<Done> {
        Err(crate::Error::UnsupportedPlatform)
    }

    pub fn write_bytes(&self, _payload: WriteBytesRequest) -> crate::Result<Done> {
        Err(crate::Error::UnsupportedPlatform)
    }

    pub fn delete_file(&self, _payload: NameRequest) -> crate::Result<Done> {
        Err(crate::Error::UnsupportedPlatform)
    }

    pub fn open_document(&self, _payload: OpenRequest) -> crate::Result<Done> {
        Err(crate::Error::UnsupportedPlatform)
    }
}
