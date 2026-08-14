//! Every one of these crosses two boundaries, which is why they all derive
//! both halves: a request arrives from the webview (deserialised) and is passed
//! on to Kotlin (serialised); a response comes back from Kotlin (deserialised)
//! and is handed to the webview (serialised). Deriving only the direction that
//! looks obvious fails to compile with a message about `CommandArg`.
//!
//! They are deliberately small and stringly: a folder is a tree URI, a file is
//! a display name inside it, and its contents are JSON text or bytes in base64.
//! Nothing here is a path, because on Android there is no path to be had.

use serde::{Deserialize, Serialize};

/// Which of the two folders a call is about.
///
/// A string rather than an enum because it is only ever passed through, and
/// the Kotlin side is where an unknown one has to be refused anyway. The two
/// that exist are `sync` — shared with another device — and `files`, which is
/// this phone's own and holds what the app produces for its user to find.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RoleRequest {
    pub role: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigureRequest {
    pub role: String,
    /// The `content://…/tree/…` URI a previous `pick_folder` returned.
    pub folder: String,
}

/// `None` when the user backed out of the picker rather than choosing.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PickedFolder {
    pub uri: Option<String>,
}

/// Commands that take nothing still need a payload to send on.
#[derive(Debug, Default, Serialize, Deserialize)]
pub struct NoArgs {}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileNames {
    pub files: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NameRequest {
    pub role: String,
    pub name: String,
}

/// `None` for a file that is not there — a device that has not written yet.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileContents {
    pub contents: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteRequest {
    pub role: String,
    pub name: String,
    pub contents: String,
}

/// A generated report is not text: one of the three formats is a PDF, so the
/// bytes travel base64-encoded rather than pretending to be a string.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteBytesRequest {
    pub role: String,
    pub name: String,
    pub mime_type: String,
    pub base64: String,
}

/// `name` absent means the folder itself.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenRequest {
    pub role: String,
    pub name: Option<String>,
}

/// A command that answers with nothing useful.
#[derive(Debug, Default, Serialize, Deserialize)]
pub struct Done {}
