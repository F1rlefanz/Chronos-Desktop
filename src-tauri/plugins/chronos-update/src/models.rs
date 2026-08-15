use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UrlRequest {
    pub url: String,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FetchedText {
    pub text: String,
}

/// What came of handing the system an APK.
///
/// `started` is as much as can honestly be reported: Android shows its own
/// installer and answers nothing back to the app that asked. `needsPermission`
/// is the one outcome worth telling apart — the user has not allowed this app
/// to install packages, and the settings screen for that has been opened.
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallStarted {
    pub started: bool,
    pub needs_permission: bool,
}
