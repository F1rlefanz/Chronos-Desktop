use serde::de::DeserializeOwned;
use tauri::{
    plugin::{PluginApi, PluginHandle},
    AppHandle, Runtime,
};

use crate::models::*;

/// Hands every call to the Kotlin class, which is where the Storage Access
/// Framework actually lives. Nothing is interpreted on the way through: this
/// side knows a handful of command names and nothing about documents, trees or
/// content providers.
pub fn init<R: Runtime, C: DeserializeOwned>(
    _app: &AppHandle<R>,
    api: PluginApi<R, C>,
) -> crate::Result<ChronosSaf<R>> {
    let handle = api.register_android_plugin("de.f1rlefanz.chronos.saf", "ChronosSafPlugin")?;
    Ok(ChronosSaf(handle))
}

pub struct ChronosSaf<R: Runtime>(PluginHandle<R>);

impl<R: Runtime> ChronosSaf<R> {
    pub fn pick_folder(&self) -> crate::Result<PickedFolder> {
        self.0
            .run_mobile_plugin("pickFolder", NoArgs::default())
            .map_err(Into::into)
    }

    pub fn configure(&self, payload: ConfigureRequest) -> crate::Result<Done> {
        self.0
            .run_mobile_plugin("configure", payload)
            .map_err(Into::into)
    }

    pub fn list_files(&self, payload: RoleRequest) -> crate::Result<FileNames> {
        self.0
            .run_mobile_plugin("listFiles", payload)
            .map_err(Into::into)
    }

    pub fn read_file(&self, payload: NameRequest) -> crate::Result<FileContents> {
        self.0
            .run_mobile_plugin("readFile", payload)
            .map_err(Into::into)
    }

    pub fn write_file(&self, payload: WriteRequest) -> crate::Result<Done> {
        self.0
            .run_mobile_plugin("writeFile", payload)
            .map_err(Into::into)
    }

    pub fn write_bytes(&self, payload: WriteBytesRequest) -> crate::Result<Done> {
        self.0
            .run_mobile_plugin("writeBytes", payload)
            .map_err(Into::into)
    }

    pub fn delete_file(&self, payload: NameRequest) -> crate::Result<Done> {
        self.0
            .run_mobile_plugin("deleteFile", payload)
            .map_err(Into::into)
    }

    pub fn open_document(&self, payload: OpenRequest) -> crate::Result<Done> {
        self.0
            .run_mobile_plugin("openDocument", payload)
            .map_err(Into::into)
    }
}
